import { FIXTURES } from "@/diagrams/fixtures";
import {
  DIAGRAM_DIRECTIONS,
  DIAGRAM_TYPES,
  EDGE_STYLES,
  MAX_DESCRIPTION_WORDS,
  MAX_ITEMS,
  MAX_ITEM_WORDS,
  MAX_LABEL_WORDS,
  MAX_NODES,
  MIN_NODES,
  NODE_EMPHASIS,
  NODE_SHAPES,
  countWords,
  diagramEdgeSchema,
  diagramJsonSchema,
  diagramNodeSchema,
  diagramSpecSchema,
  type DiagramEdge,
  type DiagramNode,
  type DiagramSpec,
} from "@/diagrams/schema";

interface Rejection {
  path: string;
  message: string;
}

function rejectionOf(input: unknown): Rejection[] {
  const result = diagramSpecSchema.safeParse(input);
  if (result.success) {
    throw new Error("expected diagramSpecSchema to reject this input");
  }
  return result.error.issues.map((issue) => ({
    path: issue.path.length ? issue.path.join(".") : "(root)",
    message: issue.message,
  }));
}

function acceptanceOf(input: unknown): DiagramSpec {
  const result = diagramSpecSchema.safeParse(input);
  if (!result.success) {
    throw new Error(
      `expected diagramSpecSchema to accept this input, got: ${JSON.stringify(result.error.issues)}`,
    );
  }
  return result.data;
}

const cloneFlowchart = (): DiagramSpec => structuredClone(FIXTURES.flowchart);

/** Returns the flowchart fixture with arbitrary keys merged into its first node. */
function specWithNodePatch(patch: Record<string, unknown>): unknown {
  const spec = cloneFlowchart();
  const [first, ...rest] = spec.nodes;
  return { ...spec, nodes: [{ ...first, ...patch }, ...rest] };
}

/** Returns the flowchart fixture with arbitrary keys merged into its first edge. */
function specWithEdgePatch(patch: Record<string, unknown>): unknown {
  const spec = cloneFlowchart();
  const [first, ...rest] = spec.edges;
  return { ...spec, edges: [{ ...first, ...patch }, ...rest] };
}

function makeNode(index: number): DiagramNode {
  return {
    id: `n${index}`,
    label: `Step ${index + 1}`,
    emphasis: "neutral",
    shape: "rectangle",
  };
}

function makeEdge(index: number, source: string, target: string): DiagramEdge {
  return { id: `e${index}`, source, target, directed: true, style: "solid" };
}

function specWithNodeCount(count: number): DiagramSpec {
  const spec = cloneFlowchart();
  spec.nodes = Array.from({ length: count }, (_, index) => makeNode(index));
  spec.edges = spec.nodes
    .slice(1)
    .map((node, index) => makeEdge(index, spec.nodes[index].id, node.id));
  return spec;
}

const words = (count: number): string =>
  Array.from({ length: count }, (_, index) => `word${index + 1}`).join(" ");

interface ParsableField {
  safeParse(value: unknown): { success: boolean };
}

/** Optional fields are the ones that accept `undefined`; everything else is required. */
function requiredKeys(shape: Record<string, ParsableField>): string[] {
  return Object.entries(shape)
    .filter(([, field]) => !field.safeParse(undefined).success)
    .map(([key]) => key)
    .sort();
}

const sorted = (values: readonly string[]): string[] => [...values].sort();

describe("countWords", () => {
  it("counts whitespace-separated words and ignores padding", () => {
    expect(countWords("one two three")).toBe(3);
    expect(countWords("  one   two  ")).toBe(2);
    expect(countWords("")).toBe(0);
    expect(countWords("   ")).toBe(0);
  });
});

describe("diagramSpecSchema", () => {
  it("accepts the flowchart fixture and returns trimmed data", () => {
    const spec = acceptanceOf({ ...cloneFlowchart(), title: "  Padded title  " });
    expect(spec.title).toBe("Padded title");
  });

  describe("label limits", () => {
    it(`accepts a ${MAX_LABEL_WORDS}-word label`, () => {
      const label = words(MAX_LABEL_WORDS);
      const spec = acceptanceOf(specWithNodePatch({ label }));
      expect(spec.nodes[0].label).toBe(label);
    });

    it(`rejects a ${MAX_LABEL_WORDS + 1}-word label`, () => {
      expect(rejectionOf(specWithNodePatch({ label: words(MAX_LABEL_WORDS + 1) }))).toContainEqual({
        path: "nodes.0.label",
        message: `label must be ${MAX_LABEL_WORDS} words or fewer`,
      });
    });

    it("rejects an empty label", () => {
      expect(rejectionOf(specWithNodePatch({ label: "" }))).toContainEqual({
        path: "nodes.0.label",
        message: "label must not be empty",
      });
    });

    it("rejects a whitespace-only label", () => {
      expect(rejectionOf(specWithNodePatch({ label: "   \t\n  " }))).toContainEqual({
        path: "nodes.0.label",
        message: "label must not be empty",
      });
    });
  });

  describe("description limits", () => {
    it(`accepts a ${MAX_DESCRIPTION_WORDS}-word description`, () => {
      const description = words(MAX_DESCRIPTION_WORDS);
      const spec = acceptanceOf(specWithNodePatch({ description }));
      expect(spec.nodes[0].description).toBe(description);
    });

    it(`rejects a ${MAX_DESCRIPTION_WORDS + 1}-word description`, () => {
      const input = specWithNodePatch({ description: words(MAX_DESCRIPTION_WORDS + 1) });
      expect(rejectionOf(input)).toContainEqual({
        path: "nodes.0.description",
        message: `description must be ${MAX_DESCRIPTION_WORDS} words or fewer`,
      });
    });
  });

  describe("item limits", () => {
    const items = (count: number): string[] =>
      Array.from({ length: count }, (_, index) => `item ${index + 1}`);

    it("leaves a node without items alone", () => {
      expect(acceptanceOf(cloneFlowchart()).nodes[0].items).toBeUndefined();
    });

    it("accepts an empty list as no list at all", () => {
      expect(acceptanceOf(specWithNodePatch({ items: [] })).nodes[0].items).toEqual([]);
    });

    it(`accepts a node with ${MAX_ITEMS} items`, () => {
      const spec = acceptanceOf(specWithNodePatch({ items: items(MAX_ITEMS) }));
      expect(spec.nodes[0].items).toEqual(items(MAX_ITEMS));
    });

    it(`rejects a node with ${MAX_ITEMS + 1} items`, () => {
      expect(rejectionOf(specWithNodePatch({ items: items(MAX_ITEMS + 1) }))).toContainEqual({
        path: "nodes.0.items",
        message: `a node may not have more than ${MAX_ITEMS} items`,
      });
    });

    it(`accepts a ${MAX_ITEM_WORDS}-word item`, () => {
      const item = words(MAX_ITEM_WORDS);
      expect(acceptanceOf(specWithNodePatch({ items: [item] })).nodes[0].items).toEqual([item]);
    });

    it(`rejects a ${MAX_ITEM_WORDS + 1}-word item and names its position`, () => {
      const input = specWithNodePatch({ items: ["fine", words(MAX_ITEM_WORDS + 1)] });
      expect(rejectionOf(input)).toContainEqual({
        path: "nodes.0.items.1",
        message: `item must be ${MAX_ITEM_WORDS} words or fewer`,
      });
    });

    it("rejects an empty item", () => {
      expect(rejectionOf(specWithNodePatch({ items: ["fine", "   "] }))).toContainEqual({
        path: "nodes.0.items.1",
        message: "item must not be empty",
      });
    });

    it("trims every item", () => {
      const spec = acceptanceOf(specWithNodePatch({ items: ["  padded item  "] }));
      expect(spec.nodes[0].items).toEqual(["padded item"]);
    });

    it("rejects a non-string item", () => {
      expect(rejectionOf(specWithNodePatch({ items: [42] })).map((issue) => issue.path)).toContain(
        "nodes.0.items.0",
      );
    });
  });

  describe("closed vocabularies", () => {
    it("rejects an unknown diagram type", () => {
      const issues = rejectionOf({ ...cloneFlowchart(), type: "mindmap" });
      expect(issues).toHaveLength(1);
      expect(issues[0].path).toBe("type");
      expect(issues[0].message).toMatch(/invalid option/i);
    });

    it("rejects an unknown node shape", () => {
      const issues = rejectionOf(specWithNodePatch({ shape: "hexagon" }));
      expect(issues).toHaveLength(1);
      expect(issues[0].path).toBe("nodes.0.shape");
      expect(issues[0].message).toMatch(/invalid option/i);
    });

    it("rejects an unknown emphasis", () => {
      const issues = rejectionOf(specWithNodePatch({ emphasis: "loud" }));
      expect(issues).toHaveLength(1);
      expect(issues[0].path).toBe("nodes.0.emphasis");
      expect(issues[0].message).toMatch(/invalid option/i);
    });

    it("rejects an unknown edge style", () => {
      const issues = rejectionOf(specWithEdgePatch({ style: "dotted" }));
      expect(issues).toHaveLength(1);
      expect(issues[0].path).toBe("edges.0.style");
      expect(issues[0].message).toMatch(/invalid option/i);
    });

    it("rejects an unknown direction", () => {
      const issues = rejectionOf({ ...cloneFlowchart(), direction: "diagonal" });
      expect(issues).toHaveLength(1);
      expect(issues[0].path).toBe("direction");
    });
  });

  describe("node count", () => {
    it(`accepts exactly ${MIN_NODES} nodes`, () => {
      expect(acceptanceOf(specWithNodeCount(MIN_NODES)).nodes).toHaveLength(MIN_NODES);
    });

    it(`accepts exactly ${MAX_NODES} nodes`, () => {
      expect(acceptanceOf(specWithNodeCount(MAX_NODES)).nodes).toHaveLength(MAX_NODES);
    });

    it(`rejects fewer than ${MIN_NODES} nodes`, () => {
      expect(rejectionOf(specWithNodeCount(MIN_NODES - 1))).toContainEqual({
        path: "nodes",
        message: `a diagram needs at least ${MIN_NODES} nodes`,
      });
    });

    it(`rejects more than ${MAX_NODES} nodes`, () => {
      expect(rejectionOf(specWithNodeCount(MAX_NODES + 1))).toContainEqual({
        path: "nodes",
        message: `a diagram may not have more than ${MAX_NODES} nodes`,
      });
    });
  });

  describe("version", () => {
    it("accepts version 1", () => {
      expect(acceptanceOf(cloneFlowchart()).version).toBe(1);
    });

    it.each([2, 0, "1", true, null])("rejects version %p", (version) => {
      const issues = rejectionOf({ ...cloneFlowchart(), version });
      expect(issues).toHaveLength(1);
      expect(issues[0].path).toBe("version");
      expect(issues[0].message).toMatch(/expected 1/i);
    });

    it("rejects a missing version", () => {
      const { version: _version, ...withoutVersion } = cloneFlowchart();
      expect(rejectionOf(withoutVersion).map((issue) => issue.path)).toContain("version");
    });
  });

  // The model is allowed to describe meaning, never appearance. `strictObject`
  // is the mechanism, so these assertions guard a security property rather than
  // a style preference.
  describe("styling is rejected", () => {
    it("rejects an extra top-level key", () => {
      const issues = rejectionOf({ ...cloneFlowchart(), theme: "dark" });
      expect(issues).toHaveLength(1);
      expect(issues[0].path).toBe("(root)");
      expect(issues[0].message).toMatch(/unrecognized key/i);
      expect(issues[0].message).toContain("theme");
    });

    it.each<[string, unknown]>([
      ["color", "#ff0000"],
      ["fill", "solid"],
      ["fontSize", 28],
      ["x", 120],
      ["y", 240],
      ["width", 320],
    ])("rejects a node carrying %s", (key, value) => {
      const issues = rejectionOf(specWithNodePatch({ [key]: value }));
      expect(issues).toHaveLength(1);
      expect(issues[0].path).toBe("nodes.0");
      expect(issues[0].message).toMatch(/unrecognized key/i);
      expect(issues[0].message).toContain(key);
    });

    it("rejects an edge carrying strokeColor", () => {
      const issues = rejectionOf(specWithEdgePatch({ strokeColor: "#000000" }));
      expect(issues).toHaveLength(1);
      expect(issues[0].path).toBe("edges.0");
      expect(issues[0].message).toMatch(/unrecognized key/i);
      expect(issues[0].message).toContain("strokeColor");
    });

    it("rejects a node carrying several styling keys at once", () => {
      const issues = rejectionOf(
        specWithNodePatch({ color: "#fff", fontSize: 12, x: 0, y: 0, width: 100 }),
      );
      expect(issues).toHaveLength(1);
      expect(issues[0].path).toBe("nodes.0");
      for (const key of ["color", "fontSize", "x", "y", "width"]) {
        expect(issues[0].message).toContain(key);
      }
    });
  });

  describe("markup injection", () => {
    const plainText = "label must be plain text (no HTML, SVG, script or template syntax)";

    it.each<[string, string]>([
      ["a script tag", "<script>alert(1)</script>"],
      ["an inline svg handler", "<svg onload=alert(1)>"],
      ["template syntax", "Total ${x} items"],
    ])("rejects a label containing %s", (_name, label) => {
      expect(rejectionOf(specWithNodePatch({ label }))).toContainEqual({
        path: "nodes.0.label",
        message: plainText,
      });
    });

    it("rejects markup in an edge label", () => {
      expect(rejectionOf(specWithEdgePatch({ label: "<b>yes</b>" }))).toContainEqual({
        path: "edges.0.label",
        message: "edge label must be plain text (no HTML, SVG, script or template syntax)",
      });
    });

    it("rejects markup in an item", () => {
      const input = specWithNodePatch({ items: ["safe item", "<script>alert(1)</script>"] });
      expect(rejectionOf(input)).toContainEqual({
        path: "nodes.0.items.1",
        message: "item must be plain text (no HTML, SVG, script or template syntax)",
      });
    });

    it("rejects a template expression in an item", () => {
      const input = specWithNodePatch({ items: ["Total ${count} errors"] });
      expect(rejectionOf(input)).toContainEqual({
        path: "nodes.0.items.0",
        message: "item must be plain text (no HTML, SVG, script or template syntax)",
      });
    });

    it("rejects markup in a description", () => {
      const input = specWithNodePatch({ description: "javascript:alert(1)" });
      expect(rejectionOf(input)).toContainEqual({
        path: "nodes.0.description",
        message: "description must be plain text (no HTML, SVG, script or template syntax)",
      });
    });
  });
});

describe("diagramJsonSchema", () => {
  it("requires exactly the fields the Zod schema requires", () => {
    expect([...diagramJsonSchema.required]).toEqual([
      "version",
      "title",
      "type",
      "direction",
      "nodes",
      "edges",
    ]);
    expect(sorted(diagramJsonSchema.required)).toEqual(requiredKeys(diagramSpecSchema.shape));
  });

  it("offers exactly the top-level properties the Zod schema knows about", () => {
    expect(sorted(Object.keys(diagramJsonSchema.properties))).toEqual(
      sorted(Object.keys(diagramSpecSchema.shape)),
    );
  });

  it("keeps its type enum in step with DIAGRAM_TYPES", () => {
    expect([...diagramJsonSchema.properties.type.enum]).toEqual([...DIAGRAM_TYPES]);
  });

  it("keeps its direction enum in step with DIAGRAM_DIRECTIONS", () => {
    expect([...diagramJsonSchema.properties.direction.enum]).toEqual([...DIAGRAM_DIRECTIONS]);
  });

  it("keeps its node enums, properties and required list in step with the node schema", () => {
    const items = diagramJsonSchema.properties.nodes.items;
    expect([...items.properties.shape.enum]).toEqual([...NODE_SHAPES]);
    expect([...items.properties.emphasis.enum]).toEqual([...NODE_EMPHASIS]);
    expect(sorted(Object.keys(items.properties))).toEqual(
      sorted(Object.keys(diagramNodeSchema.shape)),
    );
    expect(sorted(items.required)).toEqual(requiredKeys(diagramNodeSchema.shape));
  });

  it("keeps its edge enum, properties and required list in step with the edge schema", () => {
    const items = diagramJsonSchema.properties.edges.items;
    expect([...items.properties.style.enum]).toEqual([...EDGE_STYLES]);
    expect(sorted(Object.keys(items.properties))).toEqual(
      sorted(Object.keys(diagramEdgeSchema.shape)),
    );
    expect(sorted(items.required)).toEqual(requiredKeys(diagramEdgeSchema.shape));
  });

  it("offers items as a bounded array of plain strings", () => {
    const items = diagramJsonSchema.properties.nodes.items.properties.items;
    expect(items.type).toBe("array");
    expect(items.maxItems).toBe(MAX_ITEMS);
    expect(items.items.type).toBe("string");
  });

  it("carries the same node-count bounds as the Zod schema", () => {
    expect(diagramJsonSchema.properties.nodes.minItems).toBe(MIN_NODES);
    expect(diagramJsonSchema.properties.nodes.maxItems).toBe(MAX_NODES);
  });
});
