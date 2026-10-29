import {
  type ChangeEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Icon } from "../home/Icons";
import { BrandMark } from "../home/Icons";
import { ATMOSPHERE_ENABLED } from "../platformFeatures";
import type { Theme } from "../theme";
import {
  compileDijkstra,
  formatDistance,
  hasNegativeWeight,
  type DijkstraEvent,
  type DijkstraRun,
  type GraphEdge,
  type GraphModel,
  type GraphNode,
} from "./dijkstra";
import GraphCanvas, { type GraphTool } from "./GraphCanvas";
import {
  DEFAULT_PRESET,
  GRAPH_PRESETS,
  autoArrangeGraph,
  cloneGraph,
  generateRandomGraph,
  getPreset,
  nextNodeIdentity,
  type GraphPreset,
} from "./presets";
import "./dijkstra.css";

interface DijkstraLabProps {
  theme: Theme;
  onToggleTheme: () => void;
  onBackHome: () => void;
  onOpenVonThunen: () => void;
  onOpenAtmosphere: () => void;
}

type NoticeKind = "info" | "success" | "warning" | "error";

interface Notice {
  text: string;
  kind: NoticeKind;
}

type PositionSnapshot = Pick<GraphNode, "id" | "x" | "y">;

const PSEUDOCODE = [
  "dist[s] = 0; dist[v] = ∞ for v ≠ s",
  "pq = {(0, s)}",
  "while pq not empty:",
  "    u = extract_min(pq)",
  "    if u is visited: continue",
  "    mark u visited",
  "    for each edge (u, v, w):",
  "        if dist[u] + w < dist[v]:",
  "            dist[v] = dist[u] + w",
  "            prev[v] = u",
  "            push (dist[v], v) into pq",
];

const INITIAL_GRAPH = cloneGraph(DEFAULT_PRESET.graph);
const INITIAL_RUN = compileDijkstra(
  INITIAL_GRAPH,
  DEFAULT_PRESET.start,
  DEFAULT_PRESET.target,
);

const TOOL_ITEMS: { id: GraphTool; label: string; hint: string }[] = [
  { id: "select", label: "选择 / 拖动", hint: "V" },
  { id: "addNode", label: "添加节点", hint: "N" },
  { id: "addEdge", label: "连接边", hint: "E" },
  { id: "setStart", label: "设为起点", hint: "S" },
  { id: "setEnd", label: "设为终点", hint: "T" },
  { id: "delete", label: "删除", hint: "⌫" },
];

const EVENT_LABELS: Partial<Record<DijkstraEvent["type"], string>> = {
  INIT: "INITIALIZE",
  EXTRACT_MIN: "EXTRACT MIN",
  SKIP_VISITED: "SKIP",
  VISIT_NODE: "VISIT",
  EXAMINE_EDGE: "EXAMINE",
  RELAX_SUCCESS: "RELAX ✓",
  RELAX_FAIL: "NO UPDATE",
  PUSH_QUEUE: "PUSH",
  FINISH: "FINISH",
  UNREACHABLE: "UNREACHABLE",
};

const SPEED_OPTIONS = [0.5, 1, 1.5, 2] as const;
type PlaybackSpeed = (typeof SPEED_OPTIONS)[number];

function snapshotPositions(graph: GraphModel): PositionSnapshot[] {
  return graph.nodes.map(({ id, x, y }) => ({ id, x, y }));
}

function uniqueEdgeId(): string {
  return `edge-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}

function edgeBetween(
  graph: GraphModel,
  from: string,
  to: string,
): GraphEdge | null {
  return (
    graph.edges.find(
      (edge) =>
        edge.from === from &&
        edge.to === to,
    ) ??
    (!graph.directed
      ? graph.edges.find(
          (edge) => edge.from === to && edge.to === from,
        )
      : null) ??
    null
  );
}

function pathEdgeIdsFor(graph: GraphModel, path: string[]): string[] {
  const ids: string[] = [];
  for (let index = 0; index < path.length - 1; index += 1) {
    const edge = edgeBetween(graph, path[index], path[index + 1]);
    if (edge) ids.push(edge.id);
  }
  return ids;
}

function statusText(
  node: GraphNode,
  event: DijkstraEvent | null,
): "未访问" | "候选" | "已访问" {
  if (!event) return "未访问";
  if (event.state.visited.includes(node.id)) return "已访问";
  if (
    event.state.queue.some(
      (entry) => entry.node === node.id && !entry.stale,
    )
  ) {
    return "候选";
  }
  return "未访问";
}

function PanelToggle({
  open,
  label,
  onClick,
}: {
  open: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-expanded={open}
      className="dk-panel-toggle"
      onClick={onClick}
      type="button"
    >
      {open ? "收起" : "展开"}
      <span className="sr-only">{label}</span>
      <Icon name={open ? "chevronLeft" : "chevronRight"} size={14} />
    </button>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="dk-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function HelpDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      className="dk-dialog"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={onClose}
      ref={ref}
    >
      <div className="dk-dialog-heading">
        <div>
          <span className="dk-mono-label">PRINCIPLE / 原理说明</span>
          <h2>为什么 Dijkstra 能确定最短距离？</h2>
        </div>
        <button
          aria-label="关闭原理说明"
          className="dk-icon-button"
          onClick={onClose}
          type="button"
        >
          <Icon name="close" size={18} />
        </button>
      </div>

      <div className="dk-help-grid">
        <section>
          <h3>1 · 贪心选择</h3>
          <p>
            每一步从优先队列取出当前 <code>dist</code> 最小的未访问节点。
            它是本轮“最接近起点”的边界，因此最适合先向外扩展。
          </p>
        </section>
        <section>
          <h3>2 · 松弛</h3>
          <p>
            对边 <code>(u, v, w)</code> 检查{" "}
            <code>dist[u] + w &lt; dist[v]</code>。若成立，说明经过{" "}
            <code>u</code> 能更快到达 <code>v</code>，于是更新距离和前驱。
          </p>
        </section>
        <section>
          <h3>3 · 为什么已访问可确定</h3>
          <p>
            当前取出的节点是所有未确认节点中距离最小的。若之后还有更短路径，
            它必须经过某个距离更大的中间节点，再借助非负边权到达这里，这不可能
            比当前距离更小。
          </p>
        </section>
        <section>
          <h3>4 · 适用条件</h3>
          <p>
            仅适用于边权非负的图。负权边会破坏“最小距离不会再被改写”的贪心前提，
            应改用 Bellman–Ford 等方法。
          </p>
        </section>
      </div>

      <div className="dk-help-operation">
        <h3>操作路径</h3>
        <ol>
          <li>在左侧选择示例，或使用“添加节点 / 连接边”编辑图。</li>
          <li>在右侧选择起点与终点；负权边会立即阻止运行。</li>
          <li>初始化后用上一步、下一步、播放或跳到结束逐事件观察。</li>
          <li>结束时查看最短路径，再播放反向回溯动画。</li>
        </ol>
      </div>

      <div className="dk-dialog-footer">
        <p>
          事件模型：算法先把执行过程编译为 <code>INIT → EXTRACT → VISIT → EXAMINE → RELAX → PUSH → FINISH</code>{" "}
          的不可变快照，再由播放器逐步消费。
        </p>
        <button className="dk-button dk-button--primary" onClick={onClose} type="button">
          返回实验
        </button>
      </div>
    </dialog>
  );
}

export default function DijkstraLab({
  theme,
  onToggleTheme,
  onBackHome,
  onOpenVonThunen,
  onOpenAtmosphere,
}: DijkstraLabProps) {
  const [graph, setGraph] = useState<GraphModel>(INITIAL_GRAPH);
  const [startId, setStartId] = useState(DEFAULT_PRESET.start);
  const [endId, setEndId] = useState(DEFAULT_PRESET.target);
  const [activePreset, setActivePreset] = useState<
    GraphPreset["id"] | "random" | "custom"
  >(DEFAULT_PRESET.id);
  const [run, setRun] = useState<DijkstraRun | null>(INITIAL_RUN);
  const [cursor, setCursor] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<PlaybackSpeed>(1);
  const [dirty, setDirty] = useState(false);
  const [notice, setNotice] = useState<Notice>({
    kind: "info",
    text: "多分支示例已载入。选择“下一步”开始逐事件观察。",
  });
  const [tool, setTool] = useState<GraphTool>("select");
  const [pendingEdgeFrom, setPendingEdgeFrom] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [layoutSnapshot, setLayoutSnapshot] = useState<PositionSnapshot[]>(
    snapshotPositions(INITIAL_GRAPH),
  );
  const [randomCount, setRandomCount] = useState(10);
  const [helpOpen, setHelpOpen] = useState(false);
  const [showPseudocode, setShowPseudocode] = useState(true);
  const [editorOpen, setEditorOpen] = useState(
    () => window.innerWidth > 820,
  );
  const [runnerOpen, setRunnerOpen] = useState(true);
  const [pathReplay, setPathReplay] = useState<{
    stage: number;
  } | null>(null);
  const noticeTimer = useRef<number | null>(null);
  const workspaceRef = useRef<HTMLElement>(null);

  const negative = hasNegativeWeight(graph);
  const currentEvent =
    run && cursor > 0
      ? run.events[Math.min(cursor, run.events.length) - 1] ?? null
      : null;
  const snapshot = currentEvent?.state ?? null;
  const finished = !dirty && currentEvent?.type === "FINISH";
  const selectedNode =
    graph.nodes.find((node) => node.id === selectedNodeId) ?? null;
  const selectedEdge =
    graph.edges.find((edge) => edge.id === selectedEdgeId) ?? null;
  const nodeMap = useMemo(
    () => new Map(graph.nodes.map((node) => [node.id, node])),
    [graph.nodes],
  );

  const allPathEdgeIds = useMemo(
    () => (run?.reachable ? pathEdgeIdsFor(graph, run.path) : []),
    [graph, run],
  );

  const visiblePath = useMemo(() => {
    if (!finished || !run?.reachable) return [];
    if (!pathReplay) return run.path;
    return run.path.slice(-Math.max(1, pathReplay.stage));
  }, [finished, pathReplay, run]);

  const visiblePathEdgeIds = useMemo(() => {
    if (!visiblePath.length) return [];
    return pathEdgeIdsFor(graph, visiblePath);
  }, [graph, visiblePath]);

  const pathNodeIds =
    finished && run?.reachable
      ? pathReplay
        ? visiblePath
        : run.path
      : [];
  const pathEdgeIds =
    finished && run?.reachable
      ? pathReplay
        ? visiblePathEdgeIds
        : allPathEdgeIds
      : [];

  const notify = useCallback((text: string, kind: NoticeKind = "info") => {
    setNotice({ text, kind });
    if (noticeTimer.current !== null) {
      window.clearTimeout(noticeTimer.current);
    }
    noticeTimer.current = window.setTimeout(() => {
      setNotice((current) =>
        current.text === text
          ? {
              kind: "info",
              text: "图与算法状态会实时同步；可随时打开右侧原理说明。",
            }
          : current,
      );
    }, 6500);
  }, []);

  useEffect(
    () => () => {
      if (noticeTimer.current !== null) {
        window.clearTimeout(noticeTimer.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (!playing) return;
    if (!run || dirty || negative) {
      setPlaying(false);
      return;
    }
    if (cursor >= run.events.length) {
      setPlaying(false);
      return;
    }
    const delay = Math.round(1100 / speed);
    const timer = window.setTimeout(() => {
      setCursor((current) =>
        Math.min(current + 1, run.events.length),
      );
    }, delay);
    return () => window.clearTimeout(timer);
  }, [cursor, dirty, negative, playing, run, speed]);

  useEffect(() => {
    if (!playing) return;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const workspace = workspaceRef.current;
    if (workspace) {
      window.scrollTo({
        behavior: reduced ? "auto" : "smooth",
        top: workspace.getBoundingClientRect().top + window.scrollY,
      });
    }
  }, [playing]);

  useEffect(() => {
    if (!pathReplay || !run?.reachable) return;
    if (pathReplay.stage >= run.path.length) {
      const finishTimer = window.setTimeout(
        () => setPathReplay(null),
        380,
      );
      return () => window.clearTimeout(finishTimer);
    }
    const timer = window.setTimeout(
      () =>
        setPathReplay((current) =>
          current ? { stage: current.stage + 1 } : null,
        ),
      Math.round(700 / speed),
    );
    return () => window.clearTimeout(timer);
  }, [pathReplay, run, speed]);

  const resetRunFor = useCallback(
    (
      nextGraph: GraphModel,
      nextStart = startId,
      nextTarget = endId,
      message = "执行已重置；事件位置回到初始化。",
    ) => {
      setPlaying(false);
      setPathReplay(null);
      setDirty(false);
      if (
        nextGraph.nodes.length === 0 ||
        hasNegativeWeight(nextGraph) ||
        !nextGraph.nodes.some((node) => node.id === nextStart) ||
        !nextGraph.nodes.some((node) => node.id === nextTarget)
      ) {
        setRun(null);
        setCursor(0);
        if (hasNegativeWeight(nextGraph)) {
          notify(
            "存在负权边，Dijkstra 不保证正确。请把权重改为非负数后再运行。",
            "error",
          );
        } else {
          notify(message, "info");
        }
        return;
      }

      try {
        const nextRun = compileDijkstra(nextGraph, nextStart, nextTarget);
        setRun(nextRun);
        setCursor(1);
        notify(message, "success");
      } catch {
        setRun(null);
        setCursor(0);
        notify("当前图无法初始化，请检查起点、终点与边权。", "error");
      }
    },
    [endId, notify, startId],
  );

  const applyGraphEdit = useCallback(
    (
      nextGraph: GraphModel,
      message: string,
      nextStart = startId,
      nextTarget = endId,
    ) => {
      setGraph(nextGraph);
      setStartId(nextStart);
      setEndId(nextTarget);
      setSelectedNodeId((current) =>
        nextGraph.nodes.some((node) => node.id === current) ? current : null,
      );
      setSelectedEdgeId((current) =>
        nextGraph.edges.some((edge) => edge.id === current) ? current : null,
      );

      if (cursor > 1) {
        setPlaying(false);
        setPathReplay(null);
        setDirty(true);
        notify(
          `图已修改，请重置执行。${message ? ` ${message}` : ""}`,
          "warning",
        );
        return;
      }

      resetRunFor(nextGraph, nextStart, nextTarget, message);
    },
    [cursor, endId, notify, resetRunFor, startId],
  );

  const loadPresetById = useCallback(
    (presetId: GraphPreset["id"]) => {
      const preset = getPreset(presetId);
      const nextGraph = cloneGraph(preset.graph);
      setGraph(nextGraph);
      setActivePreset(preset.id);
      setStartId(preset.start);
      setEndId(preset.target);
      setLayoutSnapshot(snapshotPositions(nextGraph));
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
      setPendingEdgeFrom(null);
      setTool("select");
      resetRunFor(
        nextGraph,
        preset.start,
        preset.target,
        `已载入“${preset.name}”：${preset.description}`,
      );
    },
    [resetRunFor],
  );

  const resetPage = useCallback(() => {
    loadPresetById(DEFAULT_PRESET.id);
  }, [loadPresetById]);

  const updateLayout = useCallback((nodeId: string, x: number, y: number) => {
    setGraph((current) => ({
      ...current,
      nodes: current.nodes.map((node) =>
        node.id === nodeId ? { ...node, x, y } : node,
      ),
    }));
  }, []);

  const arrangeLayout = useCallback(
    (mode: "auto" | "reset") => {
      const nextGraph =
        mode === "auto"
          ? autoArrangeGraph(graph)
          : {
              ...graph,
              nodes: graph.nodes.map((node) => {
                const saved = layoutSnapshot.find(
                  (item) => item.id === node.id,
                );
                return saved ? { ...node, ...saved } : node;
              }),
            };
      setGraph(nextGraph);
      if (mode === "auto") {
        setLayoutSnapshot(snapshotPositions(nextGraph));
      }
      notify(
        mode === "auto"
          ? "已按环形布局自动整理节点。拖动节点仍可继续微调。"
          : "节点位置已恢复为最近一次示例或自动布局。",
        "success",
      );
    },
    [graph, layoutSnapshot, notify],
  );

  const addNodeAt = useCallback(
    (x?: number, y?: number) => {
      if (graph.nodes.length >= 30) {
        notify("节点上限为 30 个；请先删除部分节点。", "warning");
        return;
      }
      const identity = nextNodeIdentity(graph);
      const fallbackX = 450 + ((graph.nodes.length * 87) % 300) - 150;
      const fallbackY = 300 + ((graph.nodes.length * 53) % 210) - 105;
      const newNode: GraphNode = {
        ...identity,
        x: x ?? fallbackX,
        y: y ?? fallbackY,
      };
      const nextGraph = { ...graph, nodes: [...graph.nodes, newNode] };
      setLayoutSnapshot((current) => [
        ...current,
        { id: newNode.id, x: newNode.x, y: newNode.y },
      ]);
      setSelectedNodeId(newNode.id);
      setSelectedEdgeId(null);
      setActivePreset("custom");
      applyGraphEdit(
        nextGraph,
        `已添加节点 ${newNode.label}。`,
        startId || newNode.id,
        endId || newNode.id,
      );
    },
    [applyGraphEdit, endId, graph, notify, startId],
  );

  const deleteNode = useCallback(
    (nodeId: string) => {
      const node = graph.nodes.find((item) => item.id === nodeId);
      if (!node) return;
      const nodes = graph.nodes.filter((item) => item.id !== nodeId);
      const edges = graph.edges.filter(
        (edge) => edge.from !== nodeId && edge.to !== nodeId,
      );
      const nextStart = startId === nodeId ? nodes[0]?.id ?? "" : startId;
      const nextTarget = endId === nodeId ? nodes[0]?.id ?? "" : endId;
      setLayoutSnapshot((current) =>
        current.filter((item) => item.id !== nodeId),
      );
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
      setActivePreset("custom");
      applyGraphEdit(
        { ...graph, nodes, edges },
        `已删除节点 ${node.label} 及其相连边。`,
        nextStart,
        nextTarget,
      );
    },
    [applyGraphEdit, endId, graph, startId],
  );

  const deleteEdge = useCallback(
    (edgeId: string) => {
      const edge = graph.edges.find((item) => item.id === edgeId);
      if (!edge) return;
      const from = nodeMap.get(edge.from)?.label ?? edge.from;
      const to = nodeMap.get(edge.to)?.label ?? edge.to;
      setSelectedEdgeId(null);
      setActivePreset("custom");
      applyGraphEdit(
        {
          ...graph,
          edges: graph.edges.filter((item) => item.id !== edgeId),
        },
        `已删除边 ${from} → ${to}。`,
      );
    },
    [applyGraphEdit, graph, nodeMap],
  );

  const handleNodeClick = useCallback(
    (nodeId: string) => {
      const node = graph.nodes.find((item) => item.id === nodeId);
      if (!node) return;

      if (tool === "delete") {
        deleteNode(nodeId);
        return;
      }
      if (tool === "setStart") {
        setStartId(nodeId);
        setActivePreset("custom");
        resetRunFor(
          graph,
          nodeId,
          endId,
          `起点已设为 ${node.label}，执行位置已回到初始化。`,
        );
        return;
      }
      if (tool === "setEnd") {
        setEndId(nodeId);
        setActivePreset("custom");
        resetRunFor(
          graph,
          startId,
          nodeId,
          `终点已设为 ${node.label}，执行位置已回到初始化。`,
        );
        return;
      }
      if (tool === "addEdge") {
        if (!pendingEdgeFrom) {
          setPendingEdgeFrom(nodeId);
          setSelectedNodeId(nodeId);
          notify(`已选择 ${node.label} 作为边起点，再点击目标节点。`);
          return;
        }
        if (
          edgeBetween(graph, pendingEdgeFrom, nodeId)
        ) {
          setPendingEdgeFrom(null);
          notify("这两个节点之间已有一条边，可直接选择它修改权重。", "warning");
          return;
        }
        const edge: GraphEdge = {
          id: uniqueEdgeId(),
          from: pendingEdgeFrom,
          to: nodeId,
          weight: 1,
        };
        const fromLabel =
          graph.nodes.find((item) => item.id === pendingEdgeFrom)?.label ??
          pendingEdgeFrom;
        setPendingEdgeFrom(null);
        setSelectedNodeId(null);
        setSelectedEdgeId(edge.id);
        setActivePreset("custom");
        applyGraphEdit(
          { ...graph, edges: [...graph.edges, edge] },
          `已创建边 ${fromLabel} → ${node.label}，默认权重为 1；可选中该边修改。`,
          startId,
          endId,
        );
        return;
      }

      setSelectedNodeId(nodeId);
      setSelectedEdgeId(null);
      setPendingEdgeFrom(null);
    },
    [
      applyGraphEdit,
      deleteNode,
      endId,
      graph,
      notify,
      pendingEdgeFrom,
      resetRunFor,
      startId,
      tool,
    ],
  );

  const handleEdgeClick = useCallback(
    (edgeId: string) => {
      if (tool === "delete") {
        deleteEdge(edgeId);
        return;
      }
      setSelectedEdgeId(edgeId);
      setSelectedNodeId(null);
      setPendingEdgeFrom(null);
    },
    [deleteEdge, tool],
  );

  const handleToolChange = useCallback(
    (nextTool: GraphTool) => {
      setTool(nextTool);
      setPendingEdgeFrom(null);
      if (nextTool === "addNode") {
        notify("点击画布空白处放置节点；也可使用面板中的“添加节点”。");
      } else if (nextTool === "addEdge") {
        notify("依次点击两个节点创建边；有向图按第一次到第二次点击定向。");
      } else if (nextTool === "delete") {
        notify("删除模式：点击节点会连同相连边删除，点击边只删除该边。");
      } else if (nextTool === "setStart") {
        notify("点击任意节点设为起点。");
      } else if (nextTool === "setEnd") {
        notify("点击任意节点设为终点。");
      }
    },
    [notify],
  );

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (
        target?.closest(
          "input, select, textarea, button, [contenteditable='true']",
        )
      ) {
        return;
      }
      const shortcuts: Record<string, GraphTool> = {
        v: "select",
        n: "addNode",
        e: "addEdge",
        s: "setStart",
        t: "setEnd",
      };
      const nextTool =
        shortcuts[event.key.toLowerCase()] ??
        (event.key === "Backspace" || event.key === "Delete"
          ? "delete"
          : null);
      if (!nextTool || event.metaKey || event.ctrlKey || event.altKey) return;
      event.preventDefault();
      handleToolChange(nextTool);
    }
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [handleToolChange]);

  const updateWeight = (edgeId: string, value: number) => {
    if (!Number.isFinite(value)) return;
    const edge = graph.edges.find((item) => item.id === edgeId);
    if (!edge || edge.weight === value) return;
    const nextGraph = {
      ...graph,
      edges: graph.edges.map((item) =>
        item.id === edgeId ? { ...item, weight: value } : item,
      ),
    };
    setActivePreset("custom");
    applyGraphEdit(
      nextGraph,
      value < 0
        ? "检测到负权边：Dijkstra 不保证正确，算法已阻止。"
        : `边权已更新为 ${value}。`,
    );
  };

  const updateNodeLabel = (nodeId: string, value: string) => {
    const label = value.slice(0, 8);
    const node = graph.nodes.find((item) => item.id === nodeId);
    if (!node || node.label === label) return;
    setActivePreset("custom");
    applyGraphEdit(
      {
        ...graph,
        nodes: graph.nodes.map((item) =>
          item.id === nodeId ? { ...item, label } : item,
        ),
      },
      "节点名称已更新。",
    );
  };

  const toggleDirected = () => {
    const nextDirected = !graph.directed;
    let edges = graph.edges;
    if (!nextDirected) {
      const seen = new Set<string>();
      edges = graph.edges.filter((edge) => {
        const key = [edge.from, edge.to].sort().join("::");
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }
    setActivePreset("custom");
    applyGraphEdit(
      { ...graph, directed: nextDirected, edges },
      nextDirected
        ? "已切换为有向图。现有边会按创建方向解释，算法只沿箭头松弛。"
        : "已切换为无向图。互为反向的重复边已合并为一条。",
    );
  };

  const clearGraph = () => {
    setGraph({ directed: graph.directed, nodes: [], edges: [] });
    setStartId("");
    setEndId("");
    setRun(null);
    setCursor(0);
    setPlaying(false);
    setDirty(false);
    setLayoutSnapshot([]);
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setPendingEdgeFrom(null);
    setActivePreset("custom");
    notify("图已清空。使用“添加节点”重新开始。", "info");
  };

  const randomizeGraph = () => {
    const nextGraph = generateRandomGraph(randomCount, graph.directed);
    const nextStart = nextGraph.nodes[0].id;
    const nextTarget = nextGraph.nodes[nextGraph.nodes.length - 1].id;
    setGraph(nextGraph);
    setStartId(nextStart);
    setEndId(nextTarget);
    setLayoutSnapshot(snapshotPositions(nextGraph));
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setPendingEdgeFrom(null);
    setActivePreset("random");
    resetRunFor(
      nextGraph,
      nextStart,
      nextTarget,
      `已生成 ${randomCount} 个节点的连通随机图，权重范围 1–20。`,
    );
  };

  const changeStart = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    setStartId(value);
    setActivePreset("custom");
    resetRunFor(
      graph,
      value,
      endId,
      `起点已改为 ${nodeMap.get(value)?.label ?? "—"}。`,
    );
  };

  const changeEnd = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    setEndId(value);
    setActivePreset("custom");
    resetRunFor(
      graph,
      startId,
      value,
      `终点已改为 ${nodeMap.get(value)?.label ?? "—"}。`,
    );
  };

  const resetExecution = () => {
    resetRunFor(graph, startId, endId);
  };

  const nextStep = () => {
    if (!run || dirty || negative) return;
    setPathReplay(null);
    setCursor((current) => Math.min(current + 1, run.events.length));
  };

  const previousStep = () => {
    if (!run || dirty || negative) return;
    setPlaying(false);
    setPathReplay(null);
    setCursor((current) => Math.max(1, current - 1));
  };

  const jumpToEnd = () => {
    if (!run || dirty || negative) return;
    setPlaying(false);
    setPathReplay(null);
    setCursor(run.events.length);
  };

  const togglePlayback = () => {
    if (!run || dirty || negative) return;
    if (playing) {
      setPlaying(false);
      return;
    }
    if (cursor >= run.events.length) {
      setPathReplay(null);
      setCursor(1);
    }
    setPlaying(true);
  };

  const replayPath = () => {
    if (!run?.reachable || !finished) return;
    setPlaying(false);
    setPathReplay({ stage: 1 });
  };

  const progress =
    run && run.events.length > 0
      ? Math.max(0, Math.min(1, cursor / run.events.length))
      : 0;

  return (
    <div className="dk-page" data-theme={theme}>
      <a className="dk-skip-link" href="#dijkstra-workspace">
        跳到图工作台
      </a>

      <header className="dk-topbar">
        <div className="dk-shell dk-topbar-inner">
          <button
            aria-label="返回平台首页"
            className="dk-brand"
            onClick={onBackHome}
            type="button"
          >
            <BrandMark className="dk-brand-mark" />
            <span>
              <strong>泉盒子的GeoHub</strong>
              <small>QUANHEZI GEO VISUAL PLATFORM</small>
            </span>
          </button>
          <nav aria-label="实验室导航" className="dk-topnav">
            <button onClick={onBackHome} type="button">
              平台首页
            </button>
            <button onClick={onOpenVonThunen} type="button">
              杜能环
            </button>
            <span aria-current="page">Dijkstra</span>
            <button onClick={onOpenAtmosphere} type="button">
              大气受力{ATMOSPHERE_ENABLED ? "" : " · 维护中"}
            </button>
          </nav>
          <div className="dk-top-actions">
            <button className="dk-button dk-button--quiet" onClick={resetPage} type="button">
              重置
            </button>
            <button
              className="dk-button dk-button--quiet"
              onClick={() => setHelpOpen(true)}
              type="button"
            >
              帮助 / 原理
            </button>
            <button
              aria-pressed={showPseudocode}
              className="dk-button dk-button--quiet dk-pseudocode-toggle"
              onClick={() => setShowPseudocode((current) => !current)}
              type="button"
            >
              {showPseudocode ? "隐藏伪代码" : "显示伪代码"}
            </button>
            <button
              aria-label={theme === "dark" ? "切换到浅色主题" : "切换到深色主题"}
              className="dk-icon-button"
              onClick={onToggleTheme}
              type="button"
            >
              <Icon name={theme === "dark" ? "sun" : "moon"} size={17} />
            </button>
          </div>
        </div>
      </header>

      <main>
        <section className="dk-hero dk-shell">
          <div className="dk-hero-copy">
            <p className="dk-route-label">
              <span>02</span>
              网络分析与空间可达性 / INTERACTIVE LAB
            </p>
            <h1>Dijkstra 最短路径算法可视化实验室</h1>
            <p className="dk-hero-subtitle">
              编辑图、设置起点终点，逐步观察优先队列、距离表和松弛过程。
            </p>
          </div>
          <div className="dk-principle-strip">
            <div>
              <span>01 / 输入</span>
              <strong>非负权图 + 单一起点</strong>
              <p>有向边只沿箭头方向；无向边双向松弛。</p>
            </div>
            <div>
              <span>02 / 策略</span>
              <strong>贪心取最小 + 松弛</strong>
              <p>距离表、前驱表与优先队列同步演进。</p>
            </div>
            <div>
              <span>03 / 输出</span>
              <strong>最短距离 + 路径</strong>
              <p>结束后从 prev 反向回溯，还原路径。</p>
            </div>
          </div>
        </section>

        <div className="dk-shell">
          <div className={`dk-notice is-${notice.kind}`} aria-live="polite" role="status">
            <span className="dk-notice-mark" aria-hidden="true" />
            <p>{notice.text}</p>
            {dirty && (
              <button onClick={resetExecution} type="button">
                重置执行
              </button>
            )}
          </div>
        </div>

        <section
          className={`dk-workspace dk-shell ${playing ? "is-playing" : ""}`}
          id="dijkstra-workspace"
          aria-label="Dijkstra 图工作台"
          ref={workspaceRef}
        >
          <aside
            aria-label="图编辑面板"
            className={`dk-panel dk-editor-panel ${
              editorOpen ? "is-open" : "is-collapsed"
            }`}
          >
            <div className="dk-panel-heading">
              <div>
                <span className="dk-mono-label">GRAPH / 图结构</span>
                <h2>编辑图</h2>
              </div>
              <PanelToggle
                label="图编辑面板"
                onClick={() => setEditorOpen((current) => !current)}
                open={editorOpen}
              />
            </div>
            <div className="dk-panel-body">
              <div className="dk-segmented" role="group" aria-label="图类型">
                <button
                  aria-pressed={!graph.directed}
                  className={!graph.directed ? "is-active" : ""}
                  onClick={() => graph.directed && toggleDirected()}
                  type="button"
                >
                  无向图
                </button>
                <button
                  aria-pressed={graph.directed}
                  className={graph.directed ? "is-active" : ""}
                  onClick={() => !graph.directed && toggleDirected()}
                  type="button"
                >
                  有向图
                </button>
              </div>
              <p className="dk-small-copy">
                切换类型会重建边的方向解释。无向图合并反向重复边，有向图保留创建方向。
              </p>

              <button
                className="dk-button dk-button--primary dk-add-node-button"
                disabled={graph.nodes.length >= 30}
                onClick={() => addNodeAt()}
                type="button"
              >
                <span aria-hidden="true">＋</span>
                添加节点
                <small>{graph.nodes.length}/30</small>
              </button>

              <div className="dk-tool-grid" role="group" aria-label="图编辑工具">
                {TOOL_ITEMS.map((item) => (
                  <button
                    aria-pressed={tool === item.id}
                    className={tool === item.id ? "is-active" : ""}
                    key={item.id}
                    onClick={() => handleToolChange(item.id)}
                    type="button"
                  >
                    <span>{item.label}</span>
                    <kbd>{item.hint}</kbd>
                  </button>
                ))}
              </div>

              <div className="dk-editor-section">
                <div className="dk-section-heading">
                  <span>示例与生成</span>
                  <small>3 EXAMPLES</small>
                </div>
                <div className="dk-preset-list">
                  {GRAPH_PRESETS.map((preset) => (
                    <button
                      aria-pressed={activePreset === preset.id}
                      className={activePreset === preset.id ? "is-active" : ""}
                      key={preset.id}
                      onClick={() => loadPresetById(preset.id)}
                      type="button"
                    >
                      <span>{preset.name}</span>
                      <small>
                        {preset.graph.nodes.length} 点 ·{" "}
                        {preset.graph.edges.length} 边
                      </small>
                    </button>
                  ))}
                </div>
                <Field label={`随机图节点数 · ${randomCount}`}>
                  <input
                    aria-label="随机图节点数"
                    max="20"
                    min="6"
                    onChange={(event) =>
                      setRandomCount(Number(event.target.value))
                    }
                    type="range"
                    value={randomCount}
                  />
                </Field>
                <button className="dk-button" onClick={randomizeGraph} type="button">
                  生成连通随机图
                </button>
              </div>

              {selectedNode || selectedEdge ? (
                <div className="dk-editor-section dk-inspector">
                  <div className="dk-section-heading">
                    <span>选中对象</span>
                    <small>{selectedNode ? "NODE" : "EDGE"}</small>
                  </div>
                  {selectedNode && (
                    <>
                      <Field label={`节点 ${selectedNode.label}`}>
                        <input
                          maxLength={8}
                          onChange={(event) =>
                            updateNodeLabel(selectedNode.id, event.target.value)
                          }
                          type="text"
                          value={selectedNode.label}
                        />
                      </Field>
                      <div className="dk-inline-actions">
                        <button
                          className={startId === selectedNode.id ? "is-active" : ""}
                          onClick={() => {
                            setStartId(selectedNode.id);
                            resetRunFor(
                              graph,
                              selectedNode.id,
                              endId,
                              `起点已设为 ${selectedNode.label}。`,
                            );
                          }}
                          type="button"
                        >
                          {startId === selectedNode.id ? "当前起点" : "设为起点"}
                        </button>
                        <button
                          className={endId === selectedNode.id ? "is-active" : ""}
                          onClick={() => {
                            setEndId(selectedNode.id);
                            resetRunFor(
                              graph,
                              startId,
                              selectedNode.id,
                              `终点已设为 ${selectedNode.label}。`,
                            );
                          }}
                          type="button"
                        >
                          {endId === selectedNode.id ? "当前终点" : "设为终点"}
                        </button>
                      </div>
                      <button
                        className="dk-text-danger"
                        onClick={() => deleteNode(selectedNode.id)}
                        type="button"
                      >
                        删除此节点及相连边
                      </button>
                    </>
                  )}
                  {selectedEdge && (
                    <>
                      <div className="dk-edge-caption">
                        <strong>
                          {nodeMap.get(selectedEdge.from)?.label} →{" "}
                          {nodeMap.get(selectedEdge.to)?.label}
                        </strong>
                        <span>{graph.directed ? "有向边" : "无向边"}</span>
                      </div>
                      <Field label="边权重">
                        <input
                          aria-label="边权重"
                          onChange={(event) =>
                            updateWeight(
                              selectedEdge.id,
                              Number(event.target.value),
                            )
                          }
                          step="1"
                          type="number"
                          value={selectedEdge.weight}
                        />
                      </Field>
                      <button
                        className="dk-text-danger"
                        onClick={() => deleteEdge(selectedEdge.id)}
                        type="button"
                      >
                        删除此边
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <div className="dk-empty-inspector">
                  <strong>尚未选择对象</strong>
                  <p>点击节点可改名称或设起终点；点击边可修改权重。</p>
                </div>
              )}

              <div className="dk-layout-actions">
                <button onClick={() => arrangeLayout("auto")} type="button">
                  自动整理布局
                </button>
                <button onClick={() => arrangeLayout("reset")} type="button">
                  重置布局
                </button>
              </div>
              <button className="dk-clear-button" onClick={clearGraph} type="button">
                清空图
              </button>
              <p className="dk-keyboard-note">
                节点支持键盘聚焦；选择模式下可用方向键微调，按住 Shift 移动更远。
              </p>
            </div>
          </aside>

          <article className="dk-panel dk-graph-panel">
            <div className="dk-panel-heading dk-graph-heading">
              <div>
                <span className="dk-mono-label">NETWORK / 网络画布</span>
                <h2>图网络与状态</h2>
              </div>
              <div className="dk-graph-meta">
                <span>{graph.nodes.length} 节点</span>
                <span>{graph.edges.length} 边</span>
                <span>{graph.directed ? "有向" : "无向"}</span>
              </div>
            </div>

            <div className="dk-graph-command-row">
              <p>
                {tool === "addEdge" && pendingEdgeFrom
                  ? `边起点：${nodeMap.get(pendingEdgeFrom)?.label} · 请点击目标节点`
                  : tool === "select"
                    ? "拖动节点调整布局，点击选择对象"
                    : tool === "addNode"
                      ? "点击画布空白处添加节点"
                      : tool === "delete"
                        ? "点击节点或边进行删除"
                        : tool === "setStart"
                          ? "点击节点设置起点"
                          : "点击节点设置终点"}
              </p>
              <span>
                SVG · 900 × 600
              </span>
            </div>

            {negative && (
              <div className="dk-negative-banner" role="alert">
                <strong>警示：存在负权边</strong>
                <span>Dijkstra 不保证正确。请将所有权重改为 ≥ 0 后再运行。</span>
              </div>
            )}

            <GraphCanvas
              endId={endId}
              graph={graph}
              onAddNode={addNodeAt}
              onBackgroundClick={() => {
                setSelectedNodeId(null);
                setSelectedEdgeId(null);
                setPendingEdgeFrom(null);
              }}
              onEdgeClick={handleEdgeClick}
              onNodeClick={handleNodeClick}
              onNodeMove={updateLayout}
              pathEdgeIds={pathEdgeIds}
              pathNodeIds={pathNodeIds}
              pendingEdgeFrom={pendingEdgeFrom}
              selectedEdgeId={selectedEdgeId}
              selectedNodeId={selectedNodeId}
              snapshot={snapshot}
              startId={startId}
              tool={tool}
            />

            <div className="dk-legend" aria-label="图例">
              <div>
                <span className="dk-legend-title">节点</span>
                <span><i className="dk-swatch dk-swatch--idle" />未访问</span>
                <span><i className="dk-swatch dk-swatch--candidate" />候选</span>
                <span><i className="dk-swatch dk-swatch--current" />当前</span>
                <span><i className="dk-swatch dk-swatch--visited" />已访问</span>
                <span><i className="dk-swatch dk-swatch--path" />最短路径</span>
              </div>
              <div>
                <span className="dk-legend-title">边</span>
                <span><i className="dk-line-swatch" />普通</span>
                <span><i className="dk-line-swatch dk-line-swatch--examine" />检查中</span>
                <span><i className="dk-line-swatch dk-line-swatch--success" />松弛成功</span>
                <span><i className="dk-line-swatch dk-line-swatch--fail" />未更新</span>
                <span><i className="dk-line-swatch dk-line-swatch--path" />路径</span>
              </div>
            </div>
          </article>

          <aside
            aria-label="算法执行面板"
            className={`dk-panel dk-runner-panel ${
              runnerOpen ? "is-open" : "is-collapsed"
            }`}
          >
            <div className="dk-panel-heading">
              <div>
                <span className="dk-mono-label">RUN / 执行状态机</span>
                <h2>逐步执行</h2>
              </div>
              <PanelToggle
                label="算法执行面板"
                onClick={() => setRunnerOpen((current) => !current)}
                open={runnerOpen}
              />
            </div>
            <div className="dk-panel-body">
              {!playing && (
                <div className="dk-endpoint-grid">
                  <Field label="起点 S">
                    <select
                      disabled={graph.nodes.length === 0}
                      onChange={changeStart}
                      value={startId}
                    >
                      {graph.nodes.map((node) => (
                        <option key={node.id} value={node.id}>
                          {node.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="终点 T">
                    <select
                      disabled={graph.nodes.length === 0}
                      onChange={changeEnd}
                      value={endId}
                    >
                      {graph.nodes.map((node) => (
                        <option key={node.id} value={node.id}>
                          {node.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
              )}

              <div className="dk-progress">
                <div>
                  <span>执行进度</span>
                  <strong>
                    {run ? `${cursor} / ${run.events.length}` : "0 / 0"}
                  </strong>
                </div>
                <div
                  aria-label={`执行进度 ${Math.round(progress * 100)}%`}
                  className="dk-progress-track"
                  role="progressbar"
                  aria-valuemax={100}
                  aria-valuemin={0}
                  aria-valuenow={Math.round(progress * 100)}
                >
                  <span style={{ width: `${progress * 100}%` }} />
                </div>
              </div>

              <div className="dk-run-buttons">
                <button
                  className="dk-button dk-button--primary"
                  disabled={negative || graph.nodes.length === 0}
                  onClick={resetExecution}
                  type="button"
                >
                  初始化
                </button>
                <button
                  className="dk-button"
                  disabled={!run || dirty || negative || cursor <= 1}
                  onClick={previousStep}
                  type="button"
                >
                  上一步
                </button>
                <button
                  className="dk-button dk-button--primary"
                  disabled={!run || dirty || negative || cursor >= run.events.length}
                  onClick={nextStep}
                  type="button"
                >
                  下一步
                </button>
                <button
                  className={`dk-button dk-play-button ${
                    playing ? "is-playing" : ""
                  }`}
                  disabled={!run || dirty || negative}
                  onClick={togglePlayback}
                  type="button"
                >
                  <span aria-hidden="true">{playing ? "Ⅱ" : "▶"}</span>
                  {playing ? "暂停" : "播放"}
                </button>
                <button
                  className="dk-button"
                  disabled={!run || dirty || negative || cursor >= run.events.length}
                  onClick={jumpToEnd}
                  type="button"
                >
                  跳到结束
                </button>
                <button
                  className="dk-button"
                  disabled={!run}
                  onClick={resetExecution}
                  type="button"
                >
                  重置执行
                </button>
              </div>

              {!playing && (
                <div className="dk-speed-control">
                  <span>播放速度</span>
                  <div
                    aria-label="播放速度"
                    className="dk-speed-options"
                    role="group"
                  >
                    {SPEED_OPTIONS.map((option) => (
                      <button
                        aria-pressed={speed === option}
                        className={speed === option ? "is-active" : ""}
                        key={option}
                        onClick={() => setSpeed(option)}
                        type="button"
                      >
                        {option}×
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {playing ? (
                <section
                  aria-label="播放中的算法状态"
                  className="dk-playback-live"
                >
                  <div className="dk-live-heading">
                    <span>LIVE TRACE</span>
                    <small>
                      事件 {cursor} / {run?.events.length ?? 0}
                    </small>
                  </div>
                  <div className="dk-live-event" aria-live="polite">
                    <span className="dk-event-kind">
                      {currentEvent
                        ? EVENT_LABELS[currentEvent.type] ?? currentEvent.type
                        : "WAITING"}
                    </span>
                    <strong>{currentEvent?.title ?? "等待初始化"}</strong>
                    <p>
                      {currentEvent?.description ??
                        "当前图为空或存在负权边。"}
                    </p>
                  </div>
                  <div className="dk-live-code">
                    <div className="dk-live-section-title">
                      <span>当前算法行</span>
                      <small>PSEUDOCODE</small>
                    </div>
                    {currentEvent?.codeLines.map((lineIndex) => (
                      <div className="dk-live-code-line" key={lineIndex}>
                        <span>{String(lineIndex + 1).padStart(2, "0")}</span>
                        <code>{PSEUDOCODE[lineIndex].trimStart()}</code>
                      </div>
                    ))}
                  </div>
                  <div className="dk-live-table-wrap">
                    <div className="dk-live-section-title">
                      <span>距离表</span>
                      <small>DIST / PREV / STATE</small>
                    </div>
                    <table className="dk-live-table">
                      <thead>
                        <tr>
                          <th scope="col">节点</th>
                          <th scope="col">dist</th>
                          <th scope="col">prev</th>
                          <th scope="col">状态</th>
                        </tr>
                      </thead>
                      <tbody>
                        {graph.nodes.map((node) => {
                          const state = statusText(node, currentEvent);
                          return (
                            <tr
                              className={
                                state === "候选" ? "is-candidate" : ""
                              }
                              key={node.id}
                            >
                              <th scope="row">{node.label}</th>
                              <td>
                                {formatDistance(
                                  snapshot?.dist[node.id] ?? Infinity,
                                )}
                              </td>
                              <td>
                                {snapshot?.prev[node.id]
                                  ? nodeMap.get(
                                      snapshot.prev[node.id] as string,
                                    )?.label ?? "—"
                                  : "—"}
                              </td>
                              <td>
                                <span
                                  className={`dk-live-status ${
                                    state === "已访问"
                                      ? "is-visited"
                                      : state === "候选"
                                        ? "is-candidate"
                                        : ""
                                  }`}
                                >
                                  {state}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>
              ) : (
                <div className="dk-step-card" aria-live="polite">
                  <div>
                    <span className="dk-event-kind">
                      {currentEvent
                        ? EVENT_LABELS[currentEvent.type] ?? currentEvent.type
                        : "WAITING"}
                    </span>
                    <small>{currentEvent?.title ?? "等待初始化"}</small>
                  </div>
                  <p>
                    {dirty
                      ? "图已修改，当前事件快照来自修改前的图。请点击“重置执行”重新编译事件序列。"
                      : currentEvent?.description ??
                        "当前图为空或存在负权边。请编辑图后初始化。"}
                  </p>
                </div>
              )}

              <div className="dk-queue-section">
                <div className="dk-section-heading">
                  <span>优先队列</span>
                  <small>MIN-HEAP / LAZY DELETE</small>
                </div>
                <div className="dk-queue-list">
                  {snapshot && snapshot.queue.length > 0 ? (
                    [...snapshot.queue]
                      .sort((a, b) => a.distance - b.distance)
                      .map((entry, index) => (
                        <span
                          className={`dk-queue-item ${
                            entry.stale ? "is-stale" : ""
                          } ${
                            index === 0 && !entry.stale ? "is-next" : ""
                          }`}
                          key={`${entry.node}-${eventIndexKey(entry)}-${index}`}
                        >
                          <small>
                            {entry.stale
                              ? "过期"
                              : index === 0
                                ? "下一项"
                                : "待处理"}
                          </small>
                          <code>
                            ({formatDistance(entry.distance)},{" "}
                            {nodeMap.get(entry.node)?.label ?? entry.node})
                          </code>
                        </span>
                      ))
                  ) : (
                    <span className="dk-queue-empty">队列为空</span>
                  )}
                </div>
              </div>

              <div className="dk-visited-line">
                <span>访问顺序</span>
                <p>
                  {snapshot && snapshot.visited.length > 0
                    ? snapshot.visited
                        .map((id) => nodeMap.get(id)?.label ?? id)
                        .join(" → ")
                    : "—"}
                </p>
              </div>
            </div>
          </aside>
        </section>

        <section
          className="dk-intro dk-shell"
          aria-labelledby="dk-intro-title"
        >
          <div className="dk-intro-copy">
            <span className="dk-mono-label">ABOUT THE MODEL / 模型说明</span>
            <h2 id="dk-intro-title">
              Dijkstra 用于非负权图单源最短路径；每次选择当前距离最小的未访问节点，松弛其邻边。
            </h2>
            <p>
              距离表保存“目前已知的最短距离”，前驱表记录最短路径从哪来，
              优先队列决定下一步先看谁，已访问集合保存已经确认的距离。
            </p>
          </div>
          <dl className="dk-intro-facts">
            <div>
              <dt>数据结构</dt>
              <dd>最小优先队列 + 距离/前驱表</dd>
            </div>
            <div>
              <dt>朴素实现</dt>
              <dd>
                <code>O(V²)</code>
              </dd>
            </div>
            <div>
              <dt>优先队列实现</dt>
              <dd>
                <code>O((V+E) log V)</code>
              </dd>
            </div>
          </dl>
          <div className={`dk-condition ${negative ? "is-error" : ""}`}>
            <strong>
              {negative ? "负权边已阻止运行" : "适用条件：边权必须非负"}
            </strong>
            <p>
              {negative
                ? "当前图中存在负权边。Dijkstra 不保证正确；请移除负权边或改用 Bellman–Ford。"
                : "负权边会破坏贪心确认，若输入后出现负权，界面会给出警告并禁用算法。"}
            </p>
          </div>
        </section>

        <section className="dk-shell dk-state-grid" aria-label="表格与伪代码">
          <article className="dk-panel dk-table-panel">
            <div className="dk-panel-heading">
              <div>
                <span className="dk-mono-label">DISTANCE / 状态总览</span>
                <h2>距离表与前驱表</h2>
              </div>
              <span className="dk-table-caption">
                {dirty ? "等待重置" : currentEvent ? "与当前事件同步" : "未初始化"}
              </span>
            </div>
            <div className="dk-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th scope="col">节点</th>
                    <th scope="col">dist</th>
                    <th scope="col">prev</th>
                    <th scope="col">状态</th>
                  </tr>
                </thead>
                <tbody>
                  {graph.nodes.map((node) => {
                    const state = statusText(node, currentEvent);
                    return (
                      <tr
                        className={state === "候选" ? "is-candidate" : ""}
                        key={node.id}
                      >
                        <th scope="row">
                          <span className="dk-table-node">{node.label}</span>
                        </th>
                        <td>
                          {snapshot
                            ? formatDistance(
                                snapshot.dist[node.id] ?? Infinity,
                              )
                            : "—"}
                        </td>
                        <td>
                          {snapshot?.prev[node.id]
                            ? nodeMap.get(snapshot.prev[node.id] as string)
                                ?.label ?? "—"
                            : "—"}
                        </td>
                        <td>
                          <span
                            className={`dk-status-tag ${
                              state === "已访问"
                                ? "is-visited"
                                : state === "候选"
                                  ? "is-candidate"
                                  : ""
                            }`}
                          >
                            {state}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {graph.nodes.length === 0 && (
                <p className="dk-table-empty">图为空。先添加节点开始实验。</p>
              )}
            </div>
          </article>

          {showPseudocode && (
            <article className="dk-panel dk-code-panel">
              <div className="dk-panel-heading">
                <div>
                  <span className="dk-mono-label">PSEUDOCODE / 同步高亮</span>
                  <h2>算法事件对应行</h2>
                </div>
                <button
                  className="dk-icon-button"
                  aria-label="隐藏伪代码"
                  onClick={() => setShowPseudocode(false)}
                  type="button"
                >
                  <Icon name="close" size={16} />
                </button>
              </div>
              <ol className="dk-pseudocode">
                {PSEUDOCODE.map((line, index) => (
                  <li
                    className={
                      currentEvent?.codeLines.includes(index)
                        ? "is-active"
                        : ""
                    }
                    key={line}
                  >
                    <span aria-hidden="true">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <code>{line.trimStart()}</code>
                  </li>
                ))}
              </ol>
              <p className="dk-code-note">
                绿色行与当前事件同步。成功松弛会跨两行显示；入队是随后一个独立事件。
              </p>
            </article>
          )}
        </section>

        <section
          className={`dk-shell dk-outcome ${
            finished && run?.reachable ? "is-reachable" : ""
          }`}
          aria-live="polite"
        >
          <div className="dk-outcome-main">
            <span className="dk-mono-label">RESULT / 路径结果</span>
            {run?.reachable && finished ? (
              <>
                <div className="dk-path-line">
                  {(pathReplay ? visiblePath : run.path).map((id, index) => (
                    <span key={id}>
                      {nodeMap.get(id)?.label ?? id}
                      {index <
                        (pathReplay ? visiblePath : run.path).length - 1 && (
                        <i aria-hidden="true">→</i>
                      )}
                    </span>
                  ))}
                </div>
                <dl>
                  <div>
                    <dt>总距离</dt>
                    <dd>{formatDistance(run.distance ?? Infinity)}</dd>
                  </div>
                  <div>
                    <dt>访问节点数</dt>
                    <dd>{run.visitedOrder.length}</dd>
                  </div>
                  <div>
                    <dt>访问顺序</dt>
                    <dd>
                      {run.visitedOrder
                        .map((id) => nodeMap.get(id)?.label ?? id)
                        .join(" → ")}
                    </dd>
                  </div>
                </dl>
              </>
            ) : finished && run && !run.reachable ? (
              <>
                <h2>不可达</h2>
                <p>
                  优先队列已空，但从{" "}
                  {nodeMap.get(startId)?.label ?? "起点"} 无法沿允许方向到达{" "}
                  {nodeMap.get(endId)?.label ?? "终点"}。
                </p>
              </>
            ) : (
              <>
                <h2>尚未完成搜索</h2>
                <p>执行到 FINISH 事件后，这里会显示路径序列、总距离和访问顺序。</p>
              </>
            )}
          </div>
          <div className="dk-outcome-actions">
            <button
              className="dk-button dk-button--primary"
              disabled={!finished || !run?.reachable}
              onClick={replayPath}
              type="button"
            >
              路径回溯动画
            </button>
            <p>
              {pathReplay
                ? `正在从终点反向回溯 · 已显现 ${pathReplay.stage}/${run?.path.length ?? 0} 个节点`
                : "沿 prev 从终点走到起点，金色边逐段亮起。"}
            </p>
          </div>
        </section>

        <section className="dk-shell dk-teaching" aria-labelledby="dk-teaching-title">
          <div className="dk-teaching-heading">
            <span className="dk-mono-label">WHY IT WORKS / 原理解释</span>
            <h2 id="dk-teaching-title">把“为什么可以确定”拆成四件事</h2>
          </div>
          <div className="dk-teaching-grid">
            <article>
              <span>01</span>
              <h3>距离表记录已知上界</h3>
              <p>
                <code>dist[v]</code> 并不是一开始就知道的最终答案。它随着每次成功松弛变小，
                表示“到目前为止找到的最短路线”。
              </p>
            </article>
            <article>
              <span>02</span>
              <h3>优先队列决定观察顺序</h3>
              <p>
                最小堆每次给出当前 <code>dist</code> 最小的候选。惰性删除允许保留旧记录，
                取出时发现节点已访问就跳过。
              </p>
            </article>
            <article>
              <span>03</span>
              <h3>松弛是比较与更新</h3>
              <p>
                检查 <code>dist[u] + w &lt; dist[v]</code>；若成立，就同时更新距离与{" "}
                <code>prev[v]</code>。只有严格更短才更新，同长路径保持已有前驱。
              </p>
            </article>
            <article>
              <span>04</span>
              <h3>非负边权保证贪心成立</h3>
              <p>
                已访问节点的距离最小，之后任何绕行都要加上非负权重，不会产生更短结果。
                负权边会推翻这一步，因此必须阻止运行。
              </p>
            </article>
          </div>
          <div className="dk-limits">
            <strong>局限与边界</strong>
            <p>
              本页只求单一源点的最短距离；不处理负权、负环、路径数量统计或多目标优化。
              优先队列实现的时间复杂度为 <code>O((V+E) log V)</code>，
              朴素数组实现为 <code>O(V²)</code>。空间复杂度为 <code>O(V+E)</code>。
            </p>
          </div>
        </section>
      </main>

      <footer className="dk-footer">
        <div className="dk-shell dk-footer-inner">
          <div>
            <BrandMark className="dk-footer-mark" />
            <span>
              <strong>Dijkstra 最短路径算法可视化实验室</strong>
              <small>平台第二个项目 · 网络分析与空间可达性</small>
            </span>
          </div>
          <p>教学用图与距离仅用于解释算法，不代表真实道路网络。</p>
          <button onClick={onBackHome} type="button">
            返回平台首页 ↑
          </button>
        </div>
      </footer>

      <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}

function eventIndexKey(entry: { node: string; distance: number }): string {
  return `${entry.node}-${entry.distance}`;
}
