import {
  type KeyboardEvent,
  type PointerEvent,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  formatDistance,
  type DijkstraSnapshot,
  type GraphEdge,
  type GraphModel,
  type GraphNode,
} from "./dijkstra";

export type GraphTool =
  | "select"
  | "addNode"
  | "addEdge"
  | "delete"
  | "setStart"
  | "setEnd";

interface GraphCanvasProps {
  graph: GraphModel;
  tool: GraphTool;
  pendingEdgeFrom: string | null;
  startId: string;
  endId: string;
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  snapshot: DijkstraSnapshot | null;
  pathNodeIds: string[];
  pathEdgeIds: string[];
  onAddNode: (x: number, y: number) => void;
  onNodeClick: (nodeId: string) => void;
  onEdgeClick: (edgeId: string) => void;
  onNodeMove: (nodeId: string, x: number, y: number) => void;
  onBackgroundClick: () => void;
}

interface Point {
  x: number;
  y: number;
}

interface EdgeGeometry {
  edge: GraphEdge;
  path: string;
  label: Point;
  labelWidth: number;
}

interface HoverState {
  kind: "node" | "edge";
  id: string;
  x: number;
  y: number;
}

const VIEW_WIDTH = 900;
const VIEW_HEIGHT = 600;
const NODE_RADIUS = 25;

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function pointOnQuadratic(
  start: Point,
  control: Point,
  end: Point,
  t: number,
): Point {
  const oneMinus = 1 - t;
  return {
    x:
      oneMinus * oneMinus * start.x +
      2 * oneMinus * t * control.x +
      t * t * end.x,
    y:
      oneMinus * oneMinus * start.y +
      2 * oneMinus * t * control.y +
      t * t * end.y,
  };
}

function makeEdgeGeometries(graph: GraphModel): EdgeGeometry[] {
  const nodeMap = new Map(graph.nodes.map((node) => [node.id, node]));
  const groups = new Map<string, GraphEdge[]>();

  for (const edge of graph.edges) {
    const key = graph.directed
      ? `${edge.from}::${edge.to}`
      : [edge.from, edge.to].sort().join("::");
    groups.set(key, [...(groups.get(key) ?? []), edge]);
  }

  return graph.edges.flatMap((edge) => {
    const from = nodeMap.get(edge.from);
    const to = nodeMap.get(edge.to);
    if (!from || !to) return [];

    const key = graph.directed
      ? `${edge.from}::${edge.to}`
      : [edge.from, edge.to].sort().join("::");
    const siblings = groups.get(key) ?? [edge];
    const siblingIndex = siblings.findIndex((item) => item.id === edge.id);
    const offset =
      (siblingIndex - (siblings.length - 1) / 2) *
      (siblings.length > 1 ? 18 : 0);

    if (from.id === to.id) {
      const path = `M ${round(from.x + 13)} ${round(from.y - 18)} C ${round(
        from.x + 92,
      )} ${round(from.y - 102)}, ${round(from.x + 118)} ${round(
        from.y + 3,
      )}, ${round(from.x + 22)} ${round(from.y + 17)}`;
      return [
        {
          edge,
          path,
          label: { x: from.x + 75, y: from.y - 58 },
          labelWidth: 30,
        },
      ];
    }

    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.hypot(dx, dy) || 1;
    const unit = { x: dx / length, y: dy / length };
    const perpendicular = { x: -unit.y, y: unit.x };
    const startPad = NODE_RADIUS + 4;
    const endPad = NODE_RADIUS + (graph.directed ? 11 : 4);

    const start = {
      x: from.x + unit.x * startPad + perpendicular.x * offset,
      y: from.y + unit.y * startPad + perpendicular.y * offset,
    };
    const end = {
      x: to.x - unit.x * endPad + perpendicular.x * offset,
      y: to.y - unit.y * endPad + perpendicular.y * offset,
    };
    const midpoint = {
      x: (start.x + end.x) / 2,
      y: (start.y + end.y) / 2,
    };
    const curve = siblings.length > 1 ? 8 + Math.abs(offset) * 0.35 : 0;
    const control = {
      x: midpoint.x + perpendicular.x * curve,
      y: midpoint.y + perpendicular.y * curve,
    };
    const label = pointOnQuadratic(start, control, end, 0.5);

    return [
      {
        edge,
        path: `M ${round(start.x)} ${round(start.y)} Q ${round(
          control.x,
        )} ${round(control.y)} ${round(end.x)} ${round(end.y)}`,
        label,
        labelWidth: String(edge.weight).length > 2 ? 38 : 30,
      },
    ];
  });
}

function edgeMarkerSuffix(
  edgeId: string,
  activeEdge: string | null,
  activeState: string | undefined,
  pathEdgeSet: Set<string>,
): string {
  if (pathEdgeSet.has(edgeId)) return "path";
  if (activeEdge === edgeId) {
    if (activeState === "success") return "success";
    if (activeState === "fail") return "fail";
    return "examining";
  }
  return "idle";
}

export default function GraphCanvas({
  graph,
  tool,
  pendingEdgeFrom,
  startId,
  endId,
  selectedNodeId,
  selectedEdgeId,
  snapshot,
  pathNodeIds,
  pathEdgeIds,
  onAddNode,
  onNodeClick,
  onEdgeClick,
  onNodeMove,
  onBackgroundClick,
}: GraphCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    nodeId: string;
    pointerId: number;
    start: Point;
    moved: boolean;
  } | null>(null);
  const suppressClickRef = useRef(false);
  const [hover, setHover] = useState<HoverState | null>(null);
  const geometries = useMemo(() => makeEdgeGeometries(graph), [graph]);
  const nodeMap = useMemo(
    () => new Map(graph.nodes.map((node) => [node.id, node])),
    [graph.nodes],
  );
  const edgeMap = useMemo(
    () => new Map(graph.edges.map((edge) => [edge.id, edge])),
    [graph.edges],
  );
  const pathNodeSet = useMemo(
    () => new Set(pathNodeIds),
    [pathNodeIds],
  );
  const pathEdgeSet = useMemo(
    () => new Set(pathEdgeIds),
    [pathEdgeIds],
  );
  const queuedNodes = useMemo(
    () =>
      new Set(
        snapshot?.queue
          .filter((entry) => !entry.stale)
          .map((entry) => entry.node) ?? [],
      ),
    [snapshot],
  );
  const visitedNodes = useMemo(
    () => new Set(snapshot?.visited ?? []),
    [snapshot],
  );

  function clientToSvg(clientX: number, clientY: number): Point {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const point = svg.createSVGPoint();
    point.x = clientX;
    point.y = clientY;
    const transformed = point.matrixTransform(svg.getScreenCTM()?.inverse());
    return {
      x: Math.min(VIEW_WIDTH - 28, Math.max(28, transformed.x)),
      y: Math.min(VIEW_HEIGHT - 28, Math.max(28, transformed.y)),
    };
  }

  function tooltipPosition(clientX: number, clientY: number): Point {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: clientX, y: clientY };
    return {
      x: Math.min(rect.width - 178, Math.max(12, clientX - rect.left + 16)),
      y: Math.min(rect.height - 110, Math.max(12, clientY - rect.top + 16)),
    };
  }

  function handleNodePointerDown(
    event: PointerEvent<SVGGElement>,
    node: GraphNode,
  ) {
    if (tool !== "select") return;
    event.stopPropagation();
    const point = clientToSvg(event.clientX, event.clientY);
    dragRef.current = {
      nodeId: node.id,
      pointerId: event.pointerId,
      start: point,
      moved: false,
    };
    suppressClickRef.current = false;
    onNodeClick(node.id);
  }

  function handlePointerMove(event: PointerEvent<SVGSVGElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const point = clientToSvg(event.clientX, event.clientY);
    if (
      Math.hypot(point.x - drag.start.x, point.y - drag.start.y) > 4
    ) {
      drag.moved = true;
      suppressClickRef.current = true;
      if (!svgRef.current?.hasPointerCapture(event.pointerId)) {
        svgRef.current?.setPointerCapture(event.pointerId);
      }
    }
    if (drag.moved) onNodeMove(drag.nodeId, point.x, point.y);
  }

  function handlePointerUp(event: PointerEvent<SVGSVGElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (svgRef.current?.hasPointerCapture(event.pointerId)) {
      svgRef.current.releasePointerCapture(event.pointerId);
    }
    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);
  }

  function handleNodeClickInternal(nodeId: string) {
    if (suppressClickRef.current) return;
    onNodeClick(nodeId);
  }

  function handleNodeKeyDown(
    event: KeyboardEvent<SVGGElement>,
    node: GraphNode,
  ) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onNodeClick(node.id);
      return;
    }
    if (tool !== "select") return;
    const step = event.shiftKey ? 18 : 6;
    const offsets: Record<string, Point> = {
      ArrowLeft: { x: -step, y: 0 },
      ArrowRight: { x: step, y: 0 },
      ArrowUp: { x: 0, y: -step },
      ArrowDown: { x: 0, y: step },
    };
    const offset = offsets[event.key];
    if (!offset) return;
    event.preventDefault();
    onNodeMove(
      node.id,
      Math.min(VIEW_WIDTH - 28, Math.max(28, node.x + offset.x)),
      Math.min(VIEW_HEIGHT - 28, Math.max(28, node.y + offset.y)),
    );
  }

  function handleSurfaceClick(event: React.MouseEvent<SVGSVGElement>) {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    const target = event.target as SVGElement;
    if (target.closest("[data-graph-entity]")) return;
    if (tool === "addNode") {
      const point = clientToSvg(event.clientX, event.clientY);
      onAddNode(point.x, point.y);
      return;
    }
    onBackgroundClick();
  }

  const hoveredNode =
    hover?.kind === "node" ? nodeMap.get(hover.id) ?? null : null;
  const hoveredEdge =
    hover?.kind === "edge" ? edgeMap.get(hover.id) ?? null : null;
  const hoveredNodeStatus = hoveredNode
    ? snapshot?.visited.includes(hoveredNode.id)
      ? "已访问"
      : queuedNodes.has(hoveredNode.id)
        ? "候选 / 优先队列中"
        : "未访问"
    : "";

  return (
    <div className="dk-graph-canvas" ref={containerRef}>
      <svg
        ref={svgRef}
        aria-label="Dijkstra 可编辑图。节点可拖动，边权显示在边中部。"
        className={`dk-graph-svg is-tool-${tool}`}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClick={handleSurfaceClick}
        preserveAspectRatio="xMidYMid meet"
        role="group"
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
      >
        <defs>
          <pattern
            id="dk-grid"
            height="30"
            patternUnits="userSpaceOnUse"
            width="30"
          >
            <path className="dk-grid-dot" d="M 30 0 L 0 0 0 30" />
          </pattern>
          {[
            ["idle", "dk-arrow-idle"],
            ["examining", "dk-arrow-examining"],
            ["success", "dk-arrow-success"],
            ["fail", "dk-arrow-fail"],
            ["path", "dk-arrow-path"],
          ].map(([state, id]) => (
            <marker
              id={id}
              key={id}
              markerHeight="8"
              markerUnits="strokeWidth"
              markerWidth="8"
              orient="auto"
              refX="7"
              refY="4"
              viewBox="0 0 8 8"
            >
              <path className={`dk-arrow dk-arrow--${state}`} d="M0,0 L8,4 L0,8 Z" />
            </marker>
          ))}
        </defs>

        <rect
          className="dk-graph-paper"
          height={VIEW_HEIGHT}
          width={VIEW_WIDTH}
          x="0"
          y="0"
        />
        <rect
          className="dk-graph-grid"
          fill="url(#dk-grid)"
          height={VIEW_HEIGHT}
          pointerEvents="none"
          width={VIEW_WIDTH}
          x="0"
          y="0"
        />

        <g className="dk-edge-layer">
          {geometries.map(({ edge, path, label, labelWidth }) => {
            const id = edge.id;
            const from = nodeMap.get(edge.from);
            const to = nodeMap.get(edge.to);
            if (!from || !to) return null;
            const isPath = pathEdgeSet.has(id);
            const activeState =
              snapshot?.activeEdge === id
                ? snapshot.edgeState[id]
                : undefined;
            const markerState = edgeMarkerSuffix(
              id,
              snapshot?.activeEdge ?? null,
              activeState,
              pathEdgeSet,
            );
            const stateClass = isPath
              ? "is-path"
              : activeState === "success"
                ? "is-success"
                : activeState === "fail"
                  ? "is-fail"
                  : snapshot?.activeEdge === id
                    ? "is-examining"
                    : "is-idle";

            return (
              <g
                className={`dk-edge ${stateClass} ${
                  selectedEdgeId === id ? "is-selected" : ""
                }`}
                key={id}
                onPointerEnter={(event) => {
                  if (dragRef.current) return;
                  setHover({
                    kind: "edge",
                    id,
                    ...tooltipPosition(event.clientX, event.clientY),
                  });
                }}
                onPointerLeave={() => setHover(null)}
              >
                {isPath && (
                  <path className="dk-edge-underlay" d={path} fill="none" />
                )}
                <path
                  className="dk-edge-stroke"
                  d={path}
                  fill="none"
                  markerEnd={
                    graph.directed ? `url(#dk-arrow-${markerState})` : undefined
                  }
                />
                <path
                  aria-label={`边 ${from.label} 到 ${to.label}，权重 ${edge.weight}`}
                  className="dk-edge-hit"
                  data-graph-entity="edge"
                  d={path}
                  fill="none"
                  onClick={(event) => {
                    event.stopPropagation();
                    onEdgeClick(id);
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onEdgeClick(id);
                    }
                  }}
                />
                <g
                  className="dk-edge-weight"
                  pointerEvents="none"
                  style={{ transform: `translate(${label.x}px, ${label.y}px)` }}
                >
                  <rect
                    height="22"
                    rx="5"
                    width={labelWidth}
                    x={-labelWidth / 2}
                    y="-11"
                  />
                  <text
                    className="dk-edge-weight-text"
                    dominantBaseline="central"
                    textAnchor="middle"
                    x="0"
                    y="0"
                  >
                    {edge.weight}
                  </text>
                </g>
              </g>
            );
          })}
        </g>

        <g className="dk-node-layer">
          {graph.nodes.map((node) => {
            const isStart = node.id === startId;
            const isEnd = node.id === endId;
            const isCurrent = snapshot?.activeNode === node.id;
            const isVisited = visitedNodes.has(node.id);
            const isCandidate = queuedNodes.has(node.id);
            const isPath = pathNodeSet.has(node.id);
            const isSelected = selectedNodeId === node.id;
            const isPending = pendingEdgeFrom === node.id;
            const status = isPath
              ? "path"
              : isCurrent
                ? "current"
                : isVisited
                  ? "visited"
                  : isCandidate
                    ? "candidate"
                    : "idle";

            return (
              <g
                aria-label={`节点 ${node.label}${
                  isStart ? "，起点" : ""
                }${isEnd ? "，终点" : ""}`}
                className={`dk-node is-${status} ${
                  isSelected ? "is-selected" : ""
                } ${isPending ? "is-pending-edge" : ""}`}
                data-graph-entity="node"
                key={node.id}
                onClick={(event) => {
                  event.stopPropagation();
                  handleNodeClickInternal(node.id);
                }}
                onKeyDown={(event) => handleNodeKeyDown(event, node)}
                onPointerDown={(event) => handleNodePointerDown(event, node)}
                onPointerEnter={(event) => {
                  if (dragRef.current) return;
                  setHover({
                    kind: "node",
                    id: node.id,
                    ...tooltipPosition(event.clientX, event.clientY),
                  });
                }}
                onPointerLeave={() => setHover(null)}
                role="button"
                tabIndex={0}
                transform={`translate(${node.x} ${node.y})`}
              >
                {isCurrent && <circle className="dk-node-pulse" r="34" />}
                {isPending && (
                  <circle className="dk-node-pending-ring" r="33" />
                )}
                <circle className="dk-node-halo" r="31" />
                <circle className="dk-node-body" r={NODE_RADIUS} />
                <text
                  className="dk-node-label"
                  dominantBaseline="central"
                  textAnchor="middle"
                  x="0"
                  y="0"
                >
                  {node.label}
                </text>
                {(isStart || isEnd) && (
                  <g
                    className={`dk-node-role ${
                      isStart ? "is-start" : "is-end"
                    }`}
                    transform="translate(18 -19)"
                  >
                    <circle r="8" />
                    <text
                      dominantBaseline="central"
                      textAnchor="middle"
                      x="0"
                      y="0"
                    >
                      {isStart ? "S" : "T"}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      {hover && (hoveredNode || hoveredEdge) && (
        <div
          className="dk-graph-tooltip"
          role="status"
          style={{ left: hover.x, top: hover.y }}
        >
          {hoveredNode && (
            <>
              <strong>节点 {hoveredNode.label}</strong>
              <span>编号 · {hoveredNode.label}</span>
              <span>
                dist ·{" "}
                {formatDistance(snapshot?.dist[hoveredNode.id] ?? Infinity)}
              </span>
              <span>
                prev ·{" "}
                {snapshot?.prev[hoveredNode.id]
                  ? nodeMap.get(snapshot.prev[hoveredNode.id] as string)
                      ?.label
                  : "—"}
              </span>
              <span>状态 · {hoveredNodeStatus}</span>
            </>
          )}
          {hoveredEdge && (
            <>
              <strong>
                边 {nodeMap.get(hoveredEdge.from)?.label} →{" "}
                {nodeMap.get(hoveredEdge.to)?.label}
              </strong>
              <span>权重 · {hoveredEdge.weight}</span>
              <span>{graph.directed ? "有向松弛" : "双向松弛"}</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
