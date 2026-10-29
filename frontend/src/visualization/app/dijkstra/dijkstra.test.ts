import { describe, expect, it } from "vitest";
import {
  compileDijkstra,
  graphAdjacency,
  hasNegativeWeight,
  reconstructPath,
  type GraphModel,
} from "./dijkstra";
import { nextNodeIdentity, nodeLabel } from "./presets";

const graph: GraphModel = {
  directed: false,
  nodes: ["A", "B", "C", "D", "E"].map((label, index) => ({
    id: label.toLowerCase(),
    label,
    x: index * 100,
    y: 100,
  })),
  edges: [
    { id: "ab", from: "a", to: "b", weight: 4 },
    { id: "ac", from: "a", to: "c", weight: 2 },
    { id: "bc", from: "b", to: "c", weight: 1 },
    { id: "bd", from: "b", to: "d", weight: 5 },
    { id: "cd", from: "c", to: "d", weight: 8 },
    { id: "ce", from: "c", to: "e", weight: 10 },
    { id: "de", from: "d", to: "e", weight: 2 },
  ],
};

describe("compileDijkstra", () => {
  it("finds the correct shortest path and distance", () => {
    const run = compileDijkstra(graph, "a", "e");
    expect(run.path).toEqual(["a", "c", "b", "d", "e"]);
    expect(run.distance).toBe(10);
    expect(run.reachable).toBe(true);
  });

  it("emits the full teaching event vocabulary", () => {
    const run = compileDijkstra(graph, "a", "e");
    const types = new Set(run.events.map((item) => item.type));
    expect(types.size).toBeGreaterThanOrEqual(8);
    expect(types.has("INIT")).toBe(true);
    expect(types.has("EXTRACT_MIN")).toBe(true);
    expect(types.has("VISIT_NODE")).toBe(true);
    expect(types.has("EXAMINE_EDGE")).toBe(true);
    expect(types.has("RELAX_SUCCESS")).toBe(true);
    expect(types.has("RELAX_FAIL")).toBe(true);
    expect(types.has("PUSH_QUEUE")).toBe(true);
    expect(types.has("FINISH")).toBe(true);
  });

  it("respects directed edges", () => {
    const directed: GraphModel = {
      ...graph,
      directed: true,
    };
    const run = compileDijkstra(directed, "e", "a");
    expect(run.reachable).toBe(false);
    expect(run.events.some((item) => item.type === "UNREACHABLE")).toBe(true);
  });

  it("rejects negative weights", () => {
    const invalid: GraphModel = {
      ...graph,
      edges: [
        ...graph.edges,
        { id: "negative", from: "d", to: "e", weight: -1 },
      ],
    };
    expect(hasNegativeWeight(invalid)).toBe(true);
    expect(() => compileDijkstra(invalid, "a", "e")).toThrow(
      /non-negative/,
    );
  });

  it("skips stale queue entries deterministically", () => {
    const run = compileDijkstra(graph, "a", "e");
    expect(run.events.some((item) => item.type === "SKIP_VISITED")).toBe(
      true,
    );
  });

  it("builds symmetric adjacency only for undirected graphs", () => {
    expect(graphAdjacency(graph).get("d")?.length).toBe(3);
    expect(
      graphAdjacency({ ...graph, directed: true }).get("e")?.length,
    ).toBe(0);
  });
});

describe("reconstructPath", () => {
  it("returns an empty path for an unreachable target", () => {
    expect(reconstructPath({ a: null, b: null }, "a", "b", {
      a: 0,
      b: Number.POSITIVE_INFINITY,
    })).toEqual([]);
  });
});

describe("node labels", () => {
  it("uses centred A subscript notation for presets and additions", () => {
    expect(nodeLabel(1)).toBe("A₁");
    expect(nodeLabel(9)).toBe("A₉");
    expect(nodeLabel(10)).toBe("A₁₀");
    expect(nodeLabel(20)).toBe("A₂₀");
    expect(nextNodeIdentity(graph).label).toBe("A₆");
  });
});

describe("Dijkstra oracle check", () => {
  function referenceDistances(model: GraphModel, start: string) {
    const dist: Record<string, number> = Object.fromEntries(
      model.nodes.map((item) => [item.id, Number.POSITIVE_INFINITY]),
    );
    dist[start] = 0;
    const directedEdges = model.edges.flatMap((item) =>
      model.directed
        ? [item]
        : item.from === item.to
          ? [item]
          : [
              item,
              {
                ...item,
                id: `${item.id}-reverse`,
                from: item.to,
                to: item.from,
              },
            ],
    );
    for (let pass = 0; pass < model.nodes.length - 1; pass += 1) {
      let changed = false;
      for (const item of directedEdges) {
        const candidate = dist[item.from] + item.weight;
        if (candidate < dist[item.to]) {
          dist[item.to] = candidate;
          changed = true;
        }
      }
      if (!changed) break;
    }
    return dist;
  }

  it("matches a Bellman-Ford oracle on deterministic random graphs", () => {
    let seed = 9127;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 2 ** 32;
    };

    for (let round = 0; round < 18; round += 1) {
      const directed = round % 2 === 0;
      const nodes = Array.from({ length: 7 }, (_, index) => ({
        id: `v${index}`,
        label: `V${index}`,
        x: index * 50,
        y: 100,
      }));
      const edges = nodes.slice(1).map((item, index) => ({
        id: `chain-${index}`,
        from: nodes[index].id,
        to: item.id,
        weight: 1 + Math.floor(random() * 20),
      }));
      for (let extra = 0; extra < 7; extra += 1) {
        const from = Math.floor(random() * nodes.length);
        const to = Math.floor(random() * nodes.length);
        if (from === to) continue;
        edges.push({
          id: `extra-${round}-${extra}`,
          from: nodes[from].id,
          to: nodes[to].id,
          weight: 1 + Math.floor(random() * 20),
        });
      }
      const model: GraphModel = { nodes, edges, directed };
      const expected = referenceDistances(model, "v0");
      const result = compileDijkstra(model, "v0", "v6");
      const finalDist = result.events.at(-1)?.state.dist;
      expect(finalDist).toBeDefined();
      for (const item of nodes) {
        expect(finalDist?.[item.id]).toBe(expected[item.id]);
      }
    }
  });
});
