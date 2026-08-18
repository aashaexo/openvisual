import { FIXTURES, FIXTURE_LIST } from "@/diagrams/fixtures";
import { layoutDiagram, overlaps } from "@/diagrams/layout";
import type { DiagramLayout, Point, PositionedNode } from "@/diagrams/layouts/types";
import type { DiagramEdge, DiagramNode, DiagramSpec } from "@/diagrams/schema";

const CASES = FIXTURE_LIST.map((spec) => ({ type: spec.type, spec }));

function centre(node: PositionedNode): Point {
  return { x: node.x + node.width / 2, y: node.y + node.height / 2 };
}

function centroid(nodes: PositionedNode[]): Point {
  return {
    x: nodes.reduce((sum, node) => sum + centre(node).x, 0) / nodes.length,
    y: nodes.reduce((sum, node) => sum + centre(node).y, 0) / nodes.length,
  };
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function byId(layout: DiagramLayout, id: string): PositionedNode {
  const node = layout.nodes.find((candidate) => candidate.id === id);
  if (!node) throw new Error(`layout is missing node "${id}"`);
  return node;
}

/** Fails naming both nodes, so a regression points straight at the pair that collided. */
function expectNoOverlaps(layout: DiagramLayout): void {
  const collisions: string[] = [];

  for (let i = 0; i < layout.nodes.length; i += 1) {
    for (let j = i + 1; j < layout.nodes.length; j += 1) {
      const a = layout.nodes[i];
      const b = layout.nodes[j];
      if (!overlaps(a, b, 0)) continue;
      collisions.push(
        `"${a.id}" [${a.x},${a.y} ${a.width}x${a.height}] overlaps ` +
          `"${b.id}" [${b.x},${b.y} ${b.width}x${b.height}]`,
      );
    }
  }

  expect(collisions, `overlapping nodes:\n${collisions.join("\n")}`).toEqual([]);
}

function positions(layout: DiagramLayout): { id: string; x: number; y: number }[] {
  return layout.nodes.map((node) => ({ id: node.id, x: node.x, y: node.y }));
}

function makeNode(id: string, label: string, extra: Partial<DiagramNode> = {}): DiagramNode {
  return { id, label, emphasis: "neutral", shape: "rectangle", ...extra };
}

function makeEdge(source: string, target: string): DiagramEdge {
  return { id: `${source}-${target}`, source, target, directed: true, style: "solid" };
}

function syntheticFlowchart(count: number): DiagramSpec {
  const nodes = Array.from({ length: count }, (_, index) =>
    makeNode(`n${index}`, `Step number ${index + 1}`, {
      description: index % 2 === 0 ? `What happens during step ${index + 1}.` : undefined,
      shape: index === count - 1 ? "diamond" : "rectangle",
    }),
  );
  const edges = nodes.slice(1).map((node, index) => makeEdge(nodes[index].id, node.id));
  return {
    version: 1,
    title: "Synthetic ten step process",
    type: "flowchart",
    direction: "vertical",
    nodes,
    edges,
  };
}

describe("layoutDiagram fixture invariants", () => {
  it.each(CASES)("$type: no two nodes overlap", async ({ spec }) => {
    const layout = await layoutDiagram(spec);

    expect(layout.nodes).toHaveLength(spec.nodes.length);
    expectNoOverlaps(layout);
  });

  it.each(CASES)("$type: every node sits inside the reported bounds", async ({ spec }) => {
    const layout = await layoutDiagram(spec);

    expect(Number.isFinite(layout.width)).toBe(true);
    expect(Number.isFinite(layout.height)).toBe(true);
    expect(layout.width).toBeGreaterThan(0);
    expect(layout.height).toBeGreaterThan(0);

    for (const node of layout.nodes) {
      expect(Number.isFinite(node.x), `${node.id}.x is not finite`).toBe(true);
      expect(Number.isFinite(node.y), `${node.id}.y is not finite`).toBe(true);
      expect(node.x, `${node.id}.x is negative`).toBeGreaterThanOrEqual(0);
      expect(node.y, `${node.id}.y is negative`).toBeGreaterThanOrEqual(0);
      expect(node.x + node.width, `${node.id} spills past the right edge`).toBeLessThanOrEqual(
        layout.width + 0.01,
      );
      expect(node.y + node.height, `${node.id} spills past the bottom edge`).toBeLessThanOrEqual(
        layout.height + 0.01,
      );
    }
  });

  it.each(CASES)("$type: every spec edge is routed", async ({ spec }) => {
    const layout = await layoutDiagram(spec);

    expect(layout.edges.map((edge) => edge.id).sort()).toEqual(
      spec.edges.map((edge) => edge.id).sort(),
    );

    for (const edge of spec.edges) {
      const routed = layout.edges.find((candidate) => candidate.id === edge.id);
      expect(routed, `edge "${edge.id}" was not routed`).toBeDefined();

      const points = routed!.points;
      expect(points.length, `edge "${edge.id}" has fewer than 2 points`).toBeGreaterThanOrEqual(2);

      for (const point of [points[0], points[points.length - 1]]) {
        expect(Number.isFinite(point.x), `edge "${edge.id}" endpoint x is not finite`).toBe(true);
        expect(Number.isFinite(point.y), `edge "${edge.id}" endpoint y is not finite`).toBe(true);
      }
    }
  });

  it.each(CASES)("$type: laying out twice gives identical positions", async ({ spec }) => {
    const first = await layoutDiagram(spec);
    const second = await layoutDiagram(spec);

    expect(positions(second)).toEqual(positions(first));
    expect(second.width).toBe(first.width);
    expect(second.height).toBe(first.height);
  });
});

describe("layout shapes", () => {
  it("flowchart places the first edge's source left of its target", async () => {
    const spec = FIXTURES.flowchart;
    const layout = await layoutDiagram(spec);
    const first = spec.edges[0];

    const source = centre(byId(layout, first.source));
    const target = centre(byId(layout, first.target));

    // The fixture reads left to right; syntheticFlowchart covers the vertical case.
    expect(source.x).toBeLessThan(target.x);
  });

  it("timeline runs left to right on a shared baseline with an axis", async () => {
    const spec = FIXTURES.timeline;
    const layout = await layoutDiagram(spec);

    const ordered = spec.nodes.map((node) => byId(layout, node.id));
    for (let i = 1; i < ordered.length; i += 1) {
      expect(
        centre(ordered[i]).x,
        `"${ordered[i].id}" is not to the right of "${ordered[i - 1].id}"`,
      ).toBeGreaterThan(centre(ordered[i - 1]).x);
    }

    const centres = ordered.map((node) => centre(node).y);
    expect(Math.max(...centres) - Math.min(...centres)).toBeLessThanOrEqual(1);

    const lines = layout.decorations.filter((decoration) => decoration.kind === "line");
    expect(lines.some((line) => line.id === "timeline-axis")).toBe(true);
    expect(lines.filter((line) => line.id.startsWith("timeline-tick-"))).toHaveLength(
      spec.nodes.length,
    );
  });

  it("hierarchy puts the root above its children", async () => {
    const spec = FIXTURES.hierarchy;
    const layout = await layoutDiagram(spec);

    const root = byId(layout, "system");
    const children = spec.edges
      .filter((edge) => edge.source === root.id)
      .map((edge) => byId(layout, edge.target));

    expect(children.length).toBeGreaterThan(0);
    for (const child of children) {
      expect(centre(root).y, `root is not above "${child.id}"`).toBeLessThan(centre(child).y);
    }
  });

  it("comparison splits the categories into two captioned columns", async () => {
    const spec = FIXTURES.comparison;
    const layout = await layoutDiagram(spec);

    const columns = [...new Set(layout.nodes.map((node) => Math.round(centre(node).x)))].sort(
      (a, b) => a - b,
    );
    expect(columns).toHaveLength(2);

    const categories = [...new Set(spec.nodes.map((node) => node.category))];
    for (const node of layout.nodes) {
      const columnIndex = columns.indexOf(Math.round(centre(node).x));
      expect(node.node.category).toBe(categories[columnIndex]);
    }

    const captions = layout.decorations.filter(
      (decoration) => decoration.kind === "caption" && decoration.role === "column",
    );
    expect(captions).toHaveLength(2);
    expect(captions.map((caption) => (caption.kind === "caption" ? caption.text : ""))).toEqual(
      categories,
    );
  });

  it("cycle spaces every node the same distance from the centroid", async () => {
    const layout = await layoutDiagram(FIXTURES.cycle);
    const middle = centroid(layout.nodes);
    const radii = layout.nodes.map((node) => distance(centre(node), middle));
    const mean = radii.reduce((sum, radius) => sum + radius, 0) / radii.length;

    expect(mean).toBeGreaterThan(0);
    for (const [index, radius] of radii.entries()) {
      expect(
        Math.abs(radius - mean) / mean,
        `"${layout.nodes[index].id}" is off the ring (r=${radius}, mean=${mean})`,
      ).toBeLessThanOrEqual(0.15);
    }
  });

  it("hub_spoke centres the highest-degree node and rings the rest around it", async () => {
    const spec = FIXTURES.hub_spoke;
    const layout = await layoutDiagram(spec);

    const degree = new Map<string, number>(spec.nodes.map((node) => [node.id, 0]));
    for (const edge of spec.edges) {
      degree.set(edge.source, (degree.get(edge.source) ?? 0) + 1);
      degree.set(edge.target, (degree.get(edge.target) ?? 0) + 1);
    }
    const hubId = [...degree.entries()].reduce((best, entry) =>
      entry[1] > best[1] ? entry : best,
    )[0];

    const hub = byId(layout, hubId);
    const middle = centroid(layout.nodes);
    expect(distance(centre(hub), middle)).toBeLessThan(
      Math.max(layout.width, layout.height) * 0.05,
    );

    const spokes = layout.nodes.filter((node) => node.id !== hubId);
    const radii = spokes.map((node) => distance(centre(node), centre(hub)));
    const mean = radii.reduce((sum, radius) => sum + radius, 0) / radii.length;

    expect(mean).toBeGreaterThan(0);
    for (const [index, radius] of radii.entries()) {
      expect(
        Math.abs(radius - mean) / mean,
        `spoke "${spokes[index].id}" sits at r=${radius}, mean=${mean}`,
      ).toBeLessThanOrEqual(0.15);
    }
  });
});

describe("layout edge cases", () => {
  it("keeps a synthetic ten-node flowchart free of overlaps", async () => {
    const spec = syntheticFlowchart(10);
    const layout = await layoutDiagram(spec);

    expect(layout.nodes).toHaveLength(10);
    expectNoOverlaps(layout);
    expect(layout.edges).toHaveLength(spec.edges.length);
  });

  it("lays out a spec with no edges at all", async () => {
    const spec: DiagramSpec = {
      version: 1,
      title: "Unconnected ideas",
      type: "flowchart",
      direction: "vertical",
      nodes: [
        makeNode("a", "First loose idea"),
        makeNode("b", "Second loose idea", { description: "It stands on its own." }),
        makeNode("c", "Third loose idea", { shape: "circle" }),
        makeNode("d", "Fourth loose idea", { shape: "diamond" }),
      ],
      edges: [],
    };

    const layout = await layoutDiagram(spec);

    expect(layout.nodes).toHaveLength(4);
    expect(layout.edges).toEqual([]);
    expectNoOverlaps(layout);
  });

  it.each(CASES)("$type: rejects an already-aborted signal", async ({ spec }) => {
    await expect(layoutDiagram(spec, AbortSignal.abort())).rejects.toThrow();
  });
});
