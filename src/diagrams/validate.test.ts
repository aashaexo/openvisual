import { FIXTURES, FIXTURE_LIST } from "@/diagrams/fixtures";
import type { DiagramSpec } from "@/diagrams/schema";
import {
  collectWarnings,
  formatIssues,
  summariseIssues,
  validateDiagramSpec,
  type ValidationIssue,
} from "@/diagrams/validate";

function issuesOf(input: unknown): ValidationIssue[] {
  const result = validateDiagramSpec(input);
  if (result.ok) {
    throw new Error("expected validateDiagramSpec to reject this input");
  }
  return result.issues;
}

function acceptanceOf(input: unknown): { spec: DiagramSpec; warnings: string[] } {
  const result = validateDiagramSpec(input);
  if (!result.ok) {
    throw new Error(
      `expected validateDiagramSpec to accept this input:\n${formatIssues(result.issues)}`,
    );
  }
  return { spec: result.spec, warnings: result.warnings };
}

const clone = (type: keyof typeof FIXTURES): DiagramSpec => structuredClone(FIXTURES[type]);

/** Rewrites a node id and every edge endpoint that referred to it. */
function renameNode(spec: DiagramSpec, from: string, to: string): DiagramSpec {
  for (const node of spec.nodes) {
    if (node.id === from) node.id = to;
  }
  for (const edge of spec.edges) {
    if (edge.source === from) edge.source = to;
    if (edge.target === from) edge.target = to;
  }
  return spec;
}

const minimalSpec = () => ({
  version: 1,
  title: "A three step process",
  type: "flowchart",
  direction: "vertical",
  nodes: [
    { id: "a", label: "Start", emphasis: "primary", shape: "rounded" },
    { id: "b", label: "Do the work", emphasis: "secondary", shape: "rectangle" },
    { id: "c", label: "Finish", emphasis: "primary", shape: "rounded" },
  ],
  edges: [
    { id: "e1", source: "a", target: "b", directed: true, style: "solid" },
    { id: "e2", source: "b", target: "c", directed: true, style: "solid" },
  ],
});

describe("validateDiagramSpec", () => {
  it.each(FIXTURE_LIST)("accepts the $type fixture unchanged", (fixture) => {
    const { spec, warnings } = acceptanceOf(structuredClone(fixture));
    expect(spec).toEqual(fixture);
    expect(warnings).toEqual([]);
  });

  it("accepts a hand-written minimal spec and returns the parsed data", () => {
    const { spec, warnings } = acceptanceOf(minimalSpec());
    expect(spec).toEqual(minimalSpec());
    expect(spec.nodes).toHaveLength(3);
    expect(spec.nodes[1].label).toBe("Do the work");
    expect(spec.nodes[0].description).toBeUndefined();
    expect(warnings).toEqual([]);
  });

  it("rejects a non-object input", () => {
    expect(issuesOf("not a spec").length).toBeGreaterThan(0);
    expect(issuesOf(null).length).toBeGreaterThan(0);
  });

  describe("identity rules", () => {
    it("rejects duplicate node ids and points at the offending node", () => {
      const spec = renameNode(clone("flowchart"), "tool", "goal");
      expect(issuesOf(spec)).toEqual([{ path: "nodes.2.id", message: 'duplicate node id "goal"' }]);
    });

    it("rejects duplicate edge ids", () => {
      const spec = clone("flowchart");
      spec.edges[3].id = spec.edges[0].id;
      expect(issuesOf(spec)).toEqual([{ path: "edges.3.id", message: 'duplicate edge id "e1"' }]);
    });

    it("rejects an edge whose source does not exist", () => {
      const spec = clone("flowchart");
      spec.edges[0].source = "ghost";
      expect(issuesOf(spec)).toEqual([
        { path: "edges.0.source", message: 'edge source "ghost" does not match any node id' },
      ]);
    });

    it("rejects an edge whose target does not exist", () => {
      const spec = clone("flowchart");
      spec.edges[0].target = "ghost";
      expect(issuesOf(spec)).toEqual([
        { path: "edges.0.target", message: 'edge target "ghost" does not match any node id' },
      ]);
    });

    it("rejects a self-referencing edge", () => {
      const spec = clone("flowchart");
      spec.edges[0].target = spec.edges[0].source;
      expect(issuesOf(spec)).toEqual([
        {
          path: "edges.0",
          message: 'edge "e1" points at itself; self-referencing edges are not allowed',
        },
      ]);
    });
  });

  // The validator is the only door to the canvas, so appearance data must not
  // survive it even when the rest of the spec is perfectly well formed.
  describe("styling never gets through the door", () => {
    it("rejects an extra top-level key", () => {
      const issues = issuesOf({ ...clone("flowchart"), theme: "dark" });
      expect(issues).toHaveLength(1);
      expect(issues[0].path).toBe("(root)");
      expect(issues[0].message).toMatch(/unrecognized key/i);
    });

    it("rejects a node carrying colour and geometry", () => {
      const spec = clone("flowchart");
      const [first, ...rest] = spec.nodes;
      const issues = issuesOf({
        ...spec,
        nodes: [{ ...first, color: "#ff0000", fontSize: 24, x: 10, y: 20, width: 200 }, ...rest],
      });
      expect(issues).toHaveLength(1);
      expect(issues[0].path).toBe("nodes.0");
      expect(issues[0].message).toMatch(/unrecognized key/i);
    });

    it("rejects an edge carrying strokeColor", () => {
      const spec = clone("flowchart");
      const [first, ...rest] = spec.edges;
      const issues = issuesOf({ ...spec, edges: [{ ...first, strokeColor: "#000" }, ...rest] });
      expect(issues).toHaveLength(1);
      expect(issues[0].path).toBe("edges.0");
      expect(issues[0].message).toContain("strokeColor");
    });

    it("rejects markup smuggled into a label", () => {
      const spec = clone("flowchart");
      const [first, ...rest] = spec.nodes;
      const issues = issuesOf({
        ...spec,
        nodes: [{ ...first, label: "<script>alert(1)</script>" }, ...rest],
      });
      expect(issues).toContainEqual({
        path: "nodes.0.label",
        message: "label must be plain text (no HTML, SVG, script or template syntax)",
      });
    });
  });
});

describe("collectWarnings", () => {
  it("warns about a single disconnected node in a flowchart", () => {
    const spec = clone("flowchart");
    spec.nodes.push({
      id: "lonely",
      label: "Lonely step",
      emphasis: "neutral",
      shape: "rectangle",
    });
    expect(collectWarnings(spec)).toEqual(['"Lonely step" is not connected to anything.']);
  });

  it("counts several disconnected nodes instead of naming them", () => {
    const spec = clone("flowchart");
    spec.nodes.push(
      { id: "lonely1", label: "First stray", emphasis: "neutral", shape: "rectangle" },
      { id: "lonely2", label: "Second stray", emphasis: "neutral", shape: "rectangle" },
    );
    expect(collectWarnings(spec)).toEqual(["2 nodes are not connected to anything."]);
  });

  it("does not warn about disconnected nodes in a comparison", () => {
    const spec = clone("comparison");
    spec.edges.push({ id: "x1", source: "c1", target: "c2", directed: false, style: "solid" });
    const orphans = spec.nodes.filter((node) => node.id !== "c1" && node.id !== "c2");
    expect(orphans.length).toBeGreaterThan(0);
    expect(collectWarnings(spec)).toEqual([]);
  });

  it("warns when a non-comparison diagram has no edges at all", () => {
    const spec = clone("timeline");
    spec.edges = [];
    expect(collectWarnings(spec)).toEqual(["This diagram has no connections between its nodes."]);
  });

  it("does not warn when a comparison has no edges", () => {
    expect(collectWarnings(clone("comparison"))).toEqual([]);
  });

  it("surfaces warnings through validateDiagramSpec", () => {
    const spec = clone("flowchart");
    spec.nodes.push({
      id: "lonely",
      label: "Lonely step",
      emphasis: "neutral",
      shape: "rectangle",
    });
    const { warnings } = acceptanceOf(spec);
    expect(warnings).toEqual(['"Lonely step" is not connected to anything.']);
  });
});

describe("issue reporting", () => {
  /** Three independent base-level failures, so the superRefine pass never runs. */
  function multipleIssues(): ValidationIssue[] {
    const spec = clone("flowchart");
    const [first, second, ...rest] = spec.nodes;
    return issuesOf({
      ...spec,
      version: 2,
      nodes: [{ ...first, label: "" }, { ...second, shape: "hexagon" }, ...rest],
    });
  }

  it("formats every issue as its own readable line", () => {
    const issues = multipleIssues();
    expect(issues.length).toBeGreaterThan(1);

    const text = formatIssues(issues);
    expect(text.length).toBeGreaterThan(0);
    expect(text.split("\n")).toHaveLength(issues.length);
    expect(text).toContain(`- ${issues[0].path}: ${issues[0].message}`);
    expect(text.startsWith("- ")).toBe(true);
  });

  it("formats an empty issue list as an empty string", () => {
    expect(formatIssues([])).toBe("");
  });

  it("summarises the first issue and says how many more there are", () => {
    const issues = multipleIssues();
    const summary = summariseIssues(issues);
    expect(summary).toBe(`${issues[0].path}: ${issues[0].message} (and ${issues.length - 1} more)`);
    expect(summary).toMatch(/\(and \d+ more\)$/);
  });

  it("omits the counter when there is a single issue", () => {
    const issues = issuesOf({ ...clone("flowchart"), type: "mindmap" });
    expect(issues).toHaveLength(1);
    const summary = summariseIssues(issues);
    expect(summary.startsWith("type: ")).toBe(true);
    expect(summary).not.toContain("(and");
  });

  it("falls back to a plain sentence when there are no issues", () => {
    expect(summariseIssues([])).toBe(
      "The model returned data that did not match the diagram format.",
    );
  });
});
