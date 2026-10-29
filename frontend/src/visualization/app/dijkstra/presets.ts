import type { GraphEdge, GraphModel, GraphNode } from "./dijkstra";

export interface GraphPreset {
  id: "chain" | "cycle" | "branch";
  name: string;
  description: string;
  graph: GraphModel;
  start: string;
  target: string;
}

function node(id: string, label: string, x: number, y: number): GraphNode {
  return { id, label, x, y };
}

function edge(
  id: string,
  from: string,
  to: string,
  weight: number,
): GraphEdge {
  return { id, from, to, weight };
}

const SUBSCRIPT_DIGITS = ["₀", "₁", "₂", "₃", "₄", "₅", "₆", "₇", "₈", "₉"];

export function toSubscript(value: number | string): string {
  return String(value)
    .split("")
    .map((character) => SUBSCRIPT_DIGITS[Number(character)] ?? character)
    .join("");
}

export function nodeLabel(index: number): string {
  return `A${toSubscript(index)}`;
}

export const GRAPH_PRESETS: GraphPreset[] = [
  {
    id: "chain",
    name: "简单链",
    description: "一条无分支路径，适合先理解初始化、访问和连续松弛。",
    directed: false,
    graph: {
      directed: false,
      nodes: [
        node("a", nodeLabel(1), 105, 310),
        node("b", nodeLabel(2), 245, 238),
        node("c", nodeLabel(3), 392, 310),
        node("d", nodeLabel(4), 538, 238),
        node("e", nodeLabel(5), 690, 310),
        node("f", nodeLabel(6), 812, 238),
      ],
      edges: [
        edge("ab", "a", "b", 4),
        edge("bc", "b", "c", 3),
        edge("cd", "c", "d", 2),
        edge("de", "d", "e", 5),
        edge("ef", "e", "f", 3),
      ],
    },
    start: "a",
    target: "f",
  } as GraphPreset,
  {
    id: "cycle",
    name: "带环图",
    description: "多条路径形成环，可观察候选距离被更短路径替换。",
    graph: {
      directed: false,
      nodes: [
        node("a", nodeLabel(1), 116, 300),
        node("b", nodeLabel(2), 290, 150),
        node("c", nodeLabel(3), 502, 152),
        node("d", nodeLabel(4), 660, 295),
        node("e", nodeLabel(5), 508, 456),
        node("f", nodeLabel(6), 274, 445),
      ],
      edges: [
        edge("ab", "a", "b", 4),
        edge("ac", "a", "c", 2),
        edge("bc", "b", "c", 1),
        edge("bd", "b", "d", 5),
        edge("cd", "c", "d", 8),
        edge("ce", "c", "e", 10),
        edge("de", "d", "e", 2),
        edge("ef", "e", "f", 3),
        edge("fa", "f", "a", 7),
      ],
    },
    start: "a",
    target: "e",
  } as GraphPreset,
  {
    id: "branch",
    name: "多分支",
    description: "不同分支以不同代价汇合，适合比较优先队列的取数顺序。",
    graph: {
      directed: false,
      nodes: [
        node("a", nodeLabel(1), 95, 300),
        node("b", nodeLabel(2), 225, 155),
        node("c", nodeLabel(3), 220, 447),
        node("d", nodeLabel(4), 400, 95),
        node("e", nodeLabel(5), 407, 275),
        node("f", nodeLabel(6), 406, 492),
        node("g", nodeLabel(7), 620, 172),
        node("h", nodeLabel(8), 620, 405),
        node("i", nodeLabel(9), 804, 286),
      ],
      edges: [
        edge("ab", "a", "b", 4),
        edge("ac", "a", "c", 2),
        edge("bd", "b", "d", 5),
        edge("be", "b", "e", 10),
        edge("cd", "c", "d", 9),
        edge("ce", "c", "f", 3),
        edge("de", "d", "e", 2),
        edge("ef", "e", "f", 4),
        edge("eg", "e", "g", 7),
        edge("fg", "f", "g", 6),
        edge("fh", "f", "h", 2),
        edge("gh", "g", "h", 1),
        edge("gi", "g", "i", 3),
        edge("hi", "h", "i", 4),
      ],
    },
    start: "a",
    target: "i",
  } as GraphPreset,
];

export const DEFAULT_PRESET = GRAPH_PRESETS[2];

export function cloneGraph(graph: GraphModel): GraphModel {
  return {
    directed: graph.directed,
    nodes: graph.nodes.map((item) => ({ ...item })),
    edges: graph.edges.map((item) => ({ ...item })),
  };
}

export function getPreset(id: GraphPreset["id"]): GraphPreset {
  return GRAPH_PRESETS.find((preset) => preset.id === id) ?? DEFAULT_PRESET;
}

export function nextNodeIdentity(graph: GraphModel): {
  id: string;
  label: string;
} {
  const usedLabels = new Set(graph.nodes.map((item) => item.label));
  const usedIds = new Set(graph.nodes.map((item) => item.id));
  let sequential = graph.nodes.length;

  while (true) {
    const label = nodeLabel(sequential + 1);
    const id = `node-${sequential + 1}`;
    if (!usedLabels.has(label) && !usedIds.has(id)) return { id, label };
    sequential += 1;
  }
}

export function autoArrangeGraph(graph: GraphModel): GraphModel {
  if (graph.nodes.length === 0) return cloneGraph(graph);
  const center = { x: 450, y: 300 };
  const count = graph.nodes.length;
  const radiusX = count <= 5 ? 245 : Math.min(335, 210 + count * 11);
  const radiusY = count <= 5 ? 175 : Math.min(225, 145 + count * 8);

  return {
    ...cloneGraph(graph),
    nodes: graph.nodes.map((item, index) => {
      const angle = -Math.PI / 2 + (index / count) * Math.PI * 2;
      return {
        ...item,
        x: Math.round(center.x + Math.cos(angle) * radiusX),
        y: Math.round(center.y + Math.sin(angle) * radiusY),
      };
    }),
  };
}

export function generateRandomGraph(
  count: number,
  directed: boolean,
): GraphModel {
  const safeCount = Math.max(6, Math.min(20, Math.round(count)));
  const cycle = Array.from({ length: safeCount }, (_, index) => {
    const identity = (() => {
      return {
        id: `random-${index + 1}`,
        label: nodeLabel(index + 1),
      };
    })();
    const angle = -Math.PI / 2 + (index / safeCount) * Math.PI * 2;
    const jitter = ((index * 37) % 31) - 15;
    return {
      id: identity.id,
      label: identity.label,
      x:
        450 +
        Math.cos(angle) * (250 + jitter) +
        (index % 2 === 0 ? 12 : -12),
      y:
        300 +
        Math.sin(angle) * (170 + jitter * 0.45) +
        (index % 3 === 0 ? 10 : -8),
    } satisfies GraphNode;
  });

  const edges: GraphEdge[] = [];
  const seen = new Set<string>();
  const addEdge = (fromIndex: number, toIndex: number) => {
    const from = cycle[fromIndex].id;
    const to = cycle[toIndex].id;
    const key = directed
      ? `${from}->${to}`
      : [from, to].sort().join("--");
    if (seen.has(key) || from === to) return;
    seen.add(key);
    edges.push(
      edge(
        `random-edge-${edges.length + 1}`,
        from,
        to,
        1 + ((fromIndex * 7 + toIndex * 11 + edges.length * 3) % 20),
      ),
    );
  };

  for (let index = 1; index < safeCount; index += 1) {
    addEdge(index - 1, index);
  }

  const extraCount = Math.round(safeCount * 0.7);
  for (let index = 0; index < extraCount; index += 1) {
    const fromIndex = (index * 5 + 2) % safeCount;
    const toIndex = (fromIndex + 2 + (index % Math.max(1, safeCount - 3))) % safeCount;
    addEdge(fromIndex, toIndex);
  }

  return { nodes: cycle, edges, directed };
}
