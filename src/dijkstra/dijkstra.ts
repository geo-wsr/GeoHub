export interface GraphNode {
  id: string;
  label: string;
  x: number;
  y: number;
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  weight: number;
}

export interface GraphModel {
  nodes: GraphNode[];
  edges: GraphEdge[];
  directed: boolean;
}

export interface QueueEntry {
  distance: number;
  node: string;
  stale: boolean;
}

export type EdgeVisualState = "idle" | "examining" | "success" | "fail";

export interface DijkstraSnapshot {
  dist: Record<string, number>;
  prev: Record<string, string | null>;
  visited: string[];
  queue: QueueEntry[];
  activeNode: string | null;
  activeEdge: string | null;
  edgeState: Record<string, EdgeVisualState>;
}

export type DijkstraEventType =
  | "INIT"
  | "EXTRACT_MIN"
  | "SKIP_VISITED"
  | "VISIT_NODE"
  | "EXAMINE_EDGE"
  | "RELAX_SUCCESS"
  | "RELAX_FAIL"
  | "PUSH_QUEUE"
  | "FINISH"
  | "UNREACHABLE";

export interface DijkstraEvent {
  id: string;
  type: DijkstraEventType;
  title: string;
  description: string;
  codeLines: number[];
  nodeId?: string;
  edgeId?: string;
  candidateDistance?: number;
  state: DijkstraSnapshot;
}

export interface DijkstraRun {
  events: DijkstraEvent[];
  path: string[];
  distance: number | null;
  reachable: boolean;
  visitedOrder: string[];
}

interface AdjacencyItem {
  to: string;
  edge: GraphEdge;
}

const EPSILON = 1e-9;
const INFINITY = Number.POSITIVE_INFINITY;

function nodeLabel(graph: GraphModel, nodeId: string): string {
  return graph.nodes.find((node) => node.id === nodeId)?.label ?? nodeId;
}

function copySnapshot(state: DijkstraSnapshot): DijkstraSnapshot {
  return {
    dist: { ...state.dist },
    prev: { ...state.prev },
    visited: [...state.visited],
    queue: state.queue.map((entry) => ({ ...entry })),
    activeNode: state.activeNode,
    activeEdge: state.activeEdge,
    edgeState: { ...state.edgeState },
  };
}

function event(
  type: DijkstraEventType,
  title: string,
  description: string,
  codeLines: number[],
  state: DijkstraSnapshot,
  extras: Partial<
    Pick<
      DijkstraEvent,
      "nodeId" | "edgeId" | "candidateDistance"
    >
  > = {},
): DijkstraEvent {
  return {
    id: `${type}-${state.visited.length}-${state.queue.length}-${state.activeEdge ?? "none"}`,
    type,
    title,
    description,
    codeLines,
    state: copySnapshot(state),
    ...extras,
  };
}

export function hasNegativeWeight(graph: GraphModel): boolean {
  return graph.edges.some((edge) => edge.weight < 0);
}

export function formatDistance(value: number): string {
  if (!Number.isFinite(value)) return "∞";
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

export function graphAdjacency(graph: GraphModel): Map<string, AdjacencyItem[]> {
  const adjacency = new Map<string, AdjacencyItem[]>(
    graph.nodes.map((node) => [node.id, []]),
  );

  for (const edge of graph.edges) {
    if (!adjacency.has(edge.from)) adjacency.set(edge.from, []);
    if (!adjacency.has(edge.to)) adjacency.set(edge.to, []);
    adjacency.get(edge.from)?.push({ to: edge.to, edge });
    if (!graph.directed && edge.from !== edge.to) {
      adjacency.get(edge.to)?.push({ to: edge.from, edge });
    }
  }

  return adjacency;
}

export function reconstructPath(
  prev: Record<string, string | null>,
  start: string,
  target: string,
  dist: Record<string, number>,
): string[] {
  if (!Number.isFinite(dist[target])) return [];

  const path = [target];
  const seen = new Set<string>();
  let cursor = target;

  while (cursor !== start) {
    if (seen.has(cursor)) return [];
    seen.add(cursor);
    const parent = prev[cursor];
    if (!parent) return [];
    path.push(parent);
    cursor = parent;
  }

  return path.reverse();
}

/**
 * Compiles Dijkstra into immutable visual events. The event snapshots are the
 * single source of truth for tables, graph states, explanations and playback.
 */
export function compileDijkstra(
  graph: GraphModel,
  start: string,
  target: string,
): DijkstraRun {
  if (hasNegativeWeight(graph)) {
    throw new Error("Dijkstra requires non-negative edge weights.");
  }
  if (!graph.nodes.some((node) => node.id === start)) {
    throw new Error("The start node is missing from the graph.");
  }
  if (!graph.nodes.some((node) => node.id === target)) {
    throw new Error("The target node is missing from the graph.");
  }

  const adjacency = graphAdjacency(graph);
  const dist: Record<string, number> = {};
  const prev: Record<string, string | null> = {};
  for (const node of graph.nodes) {
    dist[node.id] = INFINITY;
    prev[node.id] = null;
  }
  dist[start] = 0;

  const queue: QueueEntry[] = [
    { distance: 0, node: start, stale: false },
  ];
  const visited = new Set<string>();
  const visitedOrder: string[] = [];
  const events: DijkstraEvent[] = [];

  const baseState = (): DijkstraSnapshot => ({
    dist: { ...dist },
    prev: { ...prev },
    visited: [...visited],
    queue: queue.map((item) => ({ ...item })),
    activeNode: null,
    activeEdge: null,
    edgeState: {},
  });

  events.push(
    event(
      "INIT",
      "初始化距离",
      `初始化：dist[${nodeLabel(graph, start)}]=0，其余节点为 ∞；优先队列中只有起点 ${nodeLabel(graph, start)}。`,
      [0, 1],
      baseState(),
      { nodeId: start },
    ),
  );

  while (queue.length > 0) {
    queue.sort((a, b) => {
      if (Math.abs(a.distance - b.distance) > EPSILON) {
        return a.distance - b.distance;
      }
      return nodeLabel(graph, a.node).localeCompare(
        nodeLabel(graph, b.node),
        "zh-CN",
      );
    });

    const extracted = queue.shift();
    if (!extracted) break;
    const u = extracted.node;
    const label = nodeLabel(graph, u);

    if (visited.has(u)) {
      const skippedState = baseState();
      events.push(
        event(
          "SKIP_VISITED",
          "跳过过期队列项",
          `从优先队列取出 ${label}，但它已访问；惰性删除策略跳过这条旧记录。`,
          [3, 4],
          skippedState,
          { nodeId: u, candidateDistance: extracted.distance },
        ),
      );
      continue;
    }

    visited.add(u);
    visitedOrder.push(u);

    const extractState = baseState();
    events.push(
      event(
        "EXTRACT_MIN",
        "取出最小距离节点",
        `从优先队列取出节点 ${label}，当前 dist[${label}]=${formatDistance(extracted.distance)}。`,
        [3],
        extractState,
        { nodeId: u, candidateDistance: extracted.distance },
      ),
    );

    const visitState = baseState();
    visitState.activeNode = u;
    events.push(
      event(
        "VISIT_NODE",
        "确认最短距离",
        `标记 ${label} 为已访问。因为这是队列中未确认节点里的最小距离，且边权非负，dist[${label}] 已可确定。`,
        [5],
        visitState,
        { nodeId: u },
      ),
    );

    for (const item of adjacency.get(u) ?? []) {
      const v = item.to;
      const edge = item.edge;
      const vLabel = nodeLabel(graph, v);
      const edgeText = `${label} → ${vLabel}`;
      const candidate = dist[u] + edge.weight;

      const examineState = baseState();
      examineState.activeNode = u;
      examineState.activeEdge = edge.id;
      examineState.edgeState[edge.id] = "examining";
      events.push(
        event(
          "EXAMINE_EDGE",
          "检查邻边",
          `检查边 ${edgeText}，权重 ${edge.weight}：候选距离为 ${formatDistance(dist[u])} + ${edge.weight} = ${formatDistance(candidate)}。`,
          [6, 7],
          examineState,
          { nodeId: u, edgeId: edge.id, candidateDistance: candidate },
        ),
      );

      if (candidate + EPSILON < dist[v]) {
        const oldDistance = dist[v];
        dist[v] = candidate;
        prev[v] = u;

        const successState = baseState();
        successState.activeNode = u;
        successState.activeEdge = edge.id;
        successState.edgeState[edge.id] = "success";
        events.push(
          event(
            "RELAX_SUCCESS",
            "松弛成功",
            `松弛成功：${formatDistance(candidate)} < ${formatDistance(oldDistance)}，更新 dist[${vLabel}]=${formatDistance(candidate)}，prev[${vLabel}]=${label}。`,
            [8, 9],
            successState,
            {
              nodeId: v,
              edgeId: edge.id,
              candidateDistance: candidate,
            },
          ),
        );

        queue.push({ distance: candidate, node: v, stale: false });
        const pushState = baseState();
        pushState.activeNode = u;
        pushState.activeEdge = edge.id;
        pushState.edgeState[edge.id] = "success";
        events.push(
          event(
            "PUSH_QUEUE",
            "加入优先队列",
            `将 (${formatDistance(candidate)}, ${vLabel}) 加入优先队列；旧记录若存在，稍后会被惰性删除。`,
            [10],
            pushState,
            {
              nodeId: v,
              edgeId: edge.id,
              candidateDistance: candidate,
            },
          ),
        );
      } else {
        const failState = baseState();
        failState.activeNode = u;
        failState.activeEdge = edge.id;
        failState.edgeState[edge.id] = "fail";
        events.push(
          event(
            "RELAX_FAIL",
            "不更新",
            `不更新：${formatDistance(candidate)} ≥ dist[${vLabel}]=${formatDistance(dist[v])}。现有路径已经更短或同样短。`,
            [7],
            failState,
            { nodeId: v, edgeId: edge.id, candidateDistance: candidate },
          ),
        );
      }
    }
  }

  const finalState = baseState();
  const reachable = Number.isFinite(dist[target]);
  if (!reachable) {
    events.push(
      event(
        "UNREACHABLE",
        "终点不可达",
        `优先队列已空，dist[${nodeLabel(graph, target)}] 仍为 ∞：从 ${nodeLabel(graph, start)} 到 ${nodeLabel(graph, target)} 不可达。`,
        [2],
        finalState,
        { nodeId: target },
      ),
    );
  }

  events.push(
    event(
      "FINISH",
      reachable ? "搜索完成" : "搜索结束",
      reachable
        ? `Dijkstra 搜索完成。最短距离为 ${formatDistance(dist[target])}，共访问 ${visitedOrder.length} 个节点。`
        : `Dijkstra 搜索结束；终点 ${nodeLabel(graph, target)} 未进入已访问集合。`,
      [2],
      finalState,
      { nodeId: target },
    ),
  );

  return {
    events,
    path: reconstructPath(prev, start, target, dist),
    distance: reachable ? dist[target] : null,
    reachable,
    visitedOrder,
  };
}
