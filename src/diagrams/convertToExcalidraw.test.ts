// jsdom ships no canvas context and no font APIs, but Excalidraw measures text
// through both while its module graph is still evaluating, so the smallest
// surface it touches is stubbed before the import below runs.
vi.hoisted(() => {
  const context = { filter: "none", measureText: () => ({ width: 10 }) };
  HTMLCanvasElement.prototype.getContext = (() =>
    context) as unknown as HTMLCanvasElement["getContext"];

  (globalThis as { FontFace?: unknown }).FontFace = class {
    load(): Promise<unknown> {
      return Promise.resolve(this);
    }
  };

  if (!("fonts" in document)) {
    Object.defineProperty(document, "fonts", {
      configurable: true,
      value: {
        add: () => {},
        delete: () => {},
        check: () => true,
        load: () => Promise.resolve([]),
      },
    });
  }
});

import {
  accentIndexFor,
  convertLayoutToExcalidraw,
  restyleExcalidrawElements,
} from "@/diagrams/convertToExcalidraw";
import { FIXTURE_LIST, FIXTURES } from "@/diagrams/fixtures";
import { layoutDiagram } from "@/diagrams/layout";
import { NODE_BOX } from "@/diagrams/typography";
import { ACCENT_COUNT, THEME_LIST, THEMES } from "@/themes";
import type { DiagramSpec, DiagramType, NodeEmphasis, NodeShape } from "@/diagrams/schema";
import type { DiagramTheme, NodePalette } from "@/themes";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

const SHAPES: NodeShape[] = ["rectangle", "rounded", "circle", "diamond"];
const TYPES = FIXTURE_LIST.map((spec) => spec.type);
const rendered = new Map<DiagramType, ExcalidrawElement[]>();

/** Every fixture node carrying items, so the item assertions cannot pass vacuously. */
const ITEM_NODES = FIXTURE_LIST.flatMap((spec) =>
  spec.nodes
    .filter((node) => node.items !== undefined && node.items.length > 0)
    .map((node) => ({ type: spec.type, id: node.id, shape: node.shape })),
);

beforeAll(async () => {
  for (const spec of FIXTURE_LIST) {
    const layout = await layoutDiagram(spec);
    rendered.set(spec.type, convertLayoutToExcalidraw(spec, layout, THEMES.minimal));
  }
});

async function render(
  spec: DiagramSpec,
  theme: DiagramTheme,
  options?: { includeTitle: boolean },
): Promise<ExcalidrawElement[]> {
  const layout = await layoutDiagram(spec);
  return convertLayoutToExcalidraw(spec, layout, theme, options);
}

function elementsFor(type: DiagramType): ExcalidrawElement[] {
  const elements = rendered.get(type);
  if (!elements) throw new Error(`fixture ${type} was not rendered`);
  return elements;
}

function byId(elements: ExcalidrawElement[], id: string): ExcalidrawElement {
  const element = elements.find((candidate) => candidate.id === id);
  if (!element) throw new Error(`no element with id ${id}`);
  return element;
}

function boundTextOf(
  elements: ExcalidrawElement[],
  containerId: string,
): ExcalidrawElement | undefined {
  return elements.find(
    (element) =>
      element.type === "text" && "containerId" in element && element.containerId === containerId,
  );
}

/** The text carrying a node's label, whether it is bound or free. */
function labelTextOf(elements: ExcalidrawElement[], nodeId: string): ExcalidrawElement {
  const free = elements.find((element) => element.id === `node-${nodeId}-label`);
  const text = free ?? boundTextOf(elements, `node-${nodeId}`);
  if (!text) throw new Error(`no label text for node ${nodeId}`);
  return text;
}

/** The palette the app should have picked for a node, resolved the same way it does. */
function accentOf(theme: DiagramTheme, spec: DiagramSpec, nodeId: string): NodePalette {
  return theme.node.accents[accentIndexFor(spec, nodeId)];
}

function channels(hex: string): [number, number, number] {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match) throw new Error(`not a six-digit hex colour: ${hex}`);
  return [0, 2, 4].map((offset) => parseInt(match[1].slice(offset, offset + 2), 16)) as [
    number,
    number,
    number,
  ];
}

/**
 * `emphasis` may only modulate how much of the accent fills the box.
 *
 * The blend used for "secondary" is the app's own arithmetic, so it is checked
 * as a property — every channel between the accent and the canvas — rather than
 * recomputed here, which would only assert that the test copied the engine.
 */
function expectFill(
  element: ExcalidrawElement,
  theme: DiagramTheme,
  accent: NodePalette,
  emphasis: NodeEmphasis,
  where: string,
): void {
  if (emphasis === "primary") {
    expect(element.backgroundColor, where).toBe(accent.background);
    return;
  }
  if (emphasis === "neutral") {
    expect(element.backgroundColor, where).toBe("transparent");
    return;
  }

  const fill = channels(element.backgroundColor);
  const from = channels(accent.background);
  const to = channels(theme.canvas.background);
  fill.forEach((value, index) => {
    const low = Math.min(from[index], to[index]);
    const high = Math.max(from[index], to[index]);
    expect(value, `${where} channel ${index}`).toBeGreaterThanOrEqual(low);
    expect(value, `${where} channel ${index}`).toBeLessThanOrEqual(high);
  });
}

function boxOf(element: ExcalidrawElement): Box {
  return { x: element.x, y: element.y, width: element.width, height: element.height };
}

/**
 * Text that spills out of its node shipped as a real bug once, so containment
 * is asserted edge by edge with the offender named in the failure.
 */
function expectContained(child: Box, parent: Box, where: string): void {
  expect(child.x, `${where} starts left of the node`).toBeGreaterThanOrEqual(parent.x);
  expect(child.y, `${where} starts above the node`).toBeGreaterThanOrEqual(parent.y);
  expect(child.x + child.width, `${where} overflows the right edge`).toBeLessThanOrEqual(
    parent.x + parent.width,
  );
  expect(child.y + child.height, `${where} overflows the bottom edge`).toBeLessThanOrEqual(
    parent.y + parent.height,
  );
}

/**
 * Containment against the *drawn* shape rather than its bounding box.
 *
 * A circle and a diamond both give back less room than their box, and the
 * lowest line of a left-aligned item list is the first thing to cross a
 * diamond's sloping edge, which a bounding-box check cannot see.
 */
function expectInsideShape(child: Box, parent: Box, shape: NodeShape, where: string): void {
  const cx = parent.x + parent.width / 2;
  const cy = parent.y + parent.height / 2;

  for (const corner of [
    { x: child.x, y: child.y, name: "top left" },
    { x: child.x + child.width, y: child.y, name: "top right" },
    { x: child.x, y: child.y + child.height, name: "bottom left" },
    { x: child.x + child.width, y: child.y + child.height, name: "bottom right" },
  ]) {
    const dx = Math.abs(corner.x - cx) / (parent.width / 2);
    const dy = Math.abs(corner.y - cy) / (parent.height / 2);
    const reach =
      shape === "circle" ? Math.sqrt(dx * dx + dy * dy) : shape === "diamond" ? dx + dy : 0;

    expect(reach, `${where} ${corner.name} corner leaves the ${shape}`).toBeLessThanOrEqual(1);
  }
}

describe("convertLayoutToExcalidraw", () => {
  it.each(TYPES)("emits one container per node and one arrow per edge for %s", (type) => {
    const spec = FIXTURES[type];
    const elements = elementsFor(type);

    for (const node of spec.nodes) {
      const container = byId(elements, `node-${node.id}`);
      expect(["rectangle", "ellipse", "diamond"], `${type} / node "${node.id}"`).toContain(
        container.type,
      );
    }
    for (const edge of spec.edges) {
      expect(byId(elements, `edge-${edge.id}`).type, `${type} / edge "${edge.id}"`).toBe("arrow");
    }
  });

  it.each(TYPES)("maps every node shape onto an Excalidraw shape for %s", (type) => {
    const spec = FIXTURES[type];
    const elements = elementsFor(type);
    const expected = {
      circle: "ellipse",
      diamond: "diamond",
      rectangle: "rectangle",
      rounded: "rectangle",
    };

    for (const node of spec.nodes) {
      const container = byId(elements, `node-${node.id}`);
      expect(container.type, `${type} / node "${node.id}"`).toBe(expected[node.shape]);
    }
  });

  it.each(TYPES)("rounds only the rounded shapes for %s", (type) => {
    const spec = FIXTURES[type];
    const elements = elementsFor(type);

    for (const node of spec.nodes) {
      const container = byId(elements, `node-${node.id}`);
      if (node.shape === "rounded") {
        expect(container.roundness, `${type} / node "${node.id}"`).not.toBeNull();
      } else {
        expect(container.roundness, `${type} / node "${node.id}"`).toBeNull();
      }
    }
  });

  it.each(TYPES)(
    "binds label-only text and frees text with a description or items for %s",
    (type) => {
      const spec = FIXTURES[type];
      const elements = elementsFor(type);

      for (const node of spec.nodes) {
        const containerId = `node-${node.id}`;
        const where = `${type} / node "${node.id}"`;
        const hasItems = node.items !== undefined && node.items.length > 0;

        if (node.description || hasItems) {
          expect(byId(elements, `${containerId}-label`).type, where).toBe("text");
          expect(boundTextOf(elements, containerId), `${where} should not have bound text`).toBe(
            undefined,
          );
        } else {
          const bound = boundTextOf(elements, containerId);
          expect(bound, `${where} should have bound text`).toBeDefined();
          expect(
            elements.some((element) => element.id === `${containerId}-label`),
            where,
          ).toBe(false);
        }

        expect(
          elements.some((element) => element.id === `${containerId}-description`),
          `${where} description element`,
        ).toBe(Boolean(node.description));
        expect(
          elements.some((element) => element.id === `${containerId}-items`),
          `${where} items element`,
        ).toBe(hasItems);
      }
    },
  );

  it.each(TYPES)("keeps label and description inside the node box for %s", (type) => {
    const spec = FIXTURES[type];
    const elements = elementsFor(type);
    const described = spec.nodes.filter((node) => node.description);
    expect(described.length).toBeGreaterThan(0);

    for (const node of described) {
      const container = boxOf(byId(elements, `node-${node.id}`));
      const label = boxOf(byId(elements, `node-${node.id}-label`));
      const description = boxOf(byId(elements, `node-${node.id}-description`));

      expectContained(label, container, `${type} / node "${node.id}" label`);
      expectContained(description, container, `${type} / node "${node.id}" description`);
      expect(
        label.y + label.height,
        `${type} / node "${node.id}" label overlaps its description`,
      ).toBeLessThanOrEqual(description.y);
    }
  });

  it.each(TYPES)("binds each arrow to the nodes it connects for %s", (type) => {
    const spec = FIXTURES[type];
    const elements = elementsFor(type);

    for (const edge of spec.edges) {
      const arrow = byId(elements, `edge-${edge.id}`);
      const where = `${type} / edge "${edge.id}"`;
      const startBinding = "startBinding" in arrow ? arrow.startBinding : null;
      const endBinding = "endBinding" in arrow ? arrow.endBinding : null;

      expect(startBinding?.elementId, where).toBe(`node-${edge.source}`);
      expect(endBinding?.elementId, where).toBe(`node-${edge.target}`);
    }
  });

  it("takes node colours from the theme's accent table and nowhere else", async () => {
    const spec = FIXTURES.flowchart;
    const minimal = await render(spec, THEMES.minimal);
    const dark = await render(spec, THEMES["dark-technical"]);

    for (const [elements, theme] of [
      [minimal, THEMES.minimal],
      [dark, THEMES["dark-technical"]],
    ] as const) {
      for (const node of spec.nodes) {
        const accent = accentOf(theme, spec, node.id);
        const container = byId(elements, `node-${node.id}`);
        const where = `${theme.id} / node "${node.id}"`;

        expect(container.strokeColor, where).toBe(accent.stroke);
        expectFill(container, theme, accent, node.emphasis, where);
        expect(labelTextOf(elements, node.id).strokeColor, where).toBe(accent.text);
      }
      for (const edge of spec.edges) {
        expect(byId(elements, `edge-${edge.id}`).strokeColor).toBe(theme.edge.stroke);
      }
    }

    expect(byId(minimal, "node-deploy").strokeColor).not.toBe(
      byId(dark, "node-deploy").strokeColor,
    );
    expect(byId(minimal, "node-deploy").backgroundColor).not.toBe(
      byId(dark, "node-deploy").backgroundColor,
    );
    expect(labelTextOf(minimal, "deploy").strokeColor).not.toBe(
      labelTextOf(dark, "deploy").strokeColor,
    );
  });

  it("strokes a node from its accent rather than its emphasis palette", () => {
    const spec = FIXTURES.flowchart;
    const theme = THEMES.minimal;
    const elements = elementsFor("flowchart");

    for (const node of spec.nodes) {
      const container = byId(elements, `node-${node.id}`);
      expect(container.strokeColor, node.id).toBe(accentOf(theme, spec, node.id).stroke);
      expect(container.strokeColor, node.id).not.toBe(theme.node[node.emphasis].stroke);
    }
  });

  it("gives two nodes of the same emphasis different strokes when their categories differ", () => {
    const spec = FIXTURES.flowchart;
    const elements = elementsFor("flowchart");
    const sameEmphasis = spec.nodes.filter((node) => node.emphasis === "secondary");

    expect(sameEmphasis.length).toBeGreaterThan(1);
    expect(new Set(sameEmphasis.map((node) => node.category)).size).toBe(sameEmphasis.length);

    // The emphasis palette would have painted all of these identically.
    const strokes = sameEmphasis.map((node) => byId(elements, `node-${node.id}`).strokeColor);
    expect(new Set(strokes).size).toBe(sameEmphasis.length);

    const accentStrokes = new Set(THEMES.minimal.node.accents.map((accent) => accent.stroke));
    for (const stroke of strokes) {
      expect(accentStrokes.has(stroke), `"${stroke}" is not in the accent table`).toBe(true);
    }
  });

  it("has at least one fixture node carrying items", () => {
    expect(ITEM_NODES.length).toBeGreaterThan(0);
  });

  it.each(ITEM_NODES)("keeps $type node $id's item list inside its box", ({ type, id, shape }) => {
    const elements = elementsFor(type);
    const where = `${type} / node "${id}"`;

    const container = boxOf(byId(elements, `node-${id}`));
    const items = byId(elements, `node-${id}-items`);
    const label = boxOf(labelTextOf(elements, id));

    expect(items.type, where).toBe("text");
    expectContained(boxOf(items), container, `${where} items`);
    expectInsideShape(boxOf(items), container, shape, `${where} items`);
    expectContained(label, container, `${where} label`);
    expectInsideShape(label, container, shape, `${where} label`);

    const description = elements.find((element) => element.id === `node-${id}-description`);
    const above = description ? boxOf(description) : label;
    if (description) {
      expectContained(above, container, `${where} description`);
      expectInsideShape(above, container, shape, `${where} description`);
      expect(label.y + label.height, `${where} label overlaps its description`).toBeLessThanOrEqual(
        above.y,
      );
    }
    expect(
      above.y + above.height,
      `${where} items overlap the text above them`,
    ).toBeLessThanOrEqual(items.y);
  });

  it.each(ITEM_NODES)("draws $type node $id's items as one left-aligned block", ({ type, id }) => {
    const spec = FIXTURES[type];
    const node = spec.nodes.find((candidate) => candidate.id === id);
    if (!node?.items) throw new Error(`fixture node ${id} has no items`);

    const elements = elementsFor(type);
    const items = byId(elements, `node-${id}-items`);
    const text = "text" in items ? items.text : "";
    const lines = text.split("\n");

    // Bullets only read as a list when their markers line up, so the whole list
    // is one left-aligned element with exactly one marker per item.
    expect("textAlign" in items ? items.textAlign : null, `${type} / node "${id}"`).toBe("left");
    expect(lines.length).toBeGreaterThanOrEqual(node.items.length);
    expect(lines.filter((line) => line.startsWith(NODE_BOX.bullet))).toHaveLength(
      node.items.length,
    );
    expect(items.strokeColor).toBe(accentOf(THEMES.minimal, spec, id).text);
  });

  it("emits the title and summary by default and omits them on request", async () => {
    const spec = FIXTURES.flowchart;

    const withTitle = await render(spec, THEMES.minimal);
    expect(byId(withTitle, "diagram-title").strokeColor).toBe(THEMES.minimal.title.color);
    expect(byId(withTitle, "diagram-summary").strokeColor).toBe(THEMES.minimal.title.subtitleColor);

    const without = await render(spec, THEMES.minimal, { includeTitle: false });
    const ids = without.map((element) => element.id);
    expect(ids).not.toContain("diagram-title");
    expect(ids).not.toContain("diagram-summary");
    expect(without.length).toBe(withTitle.length - 2);
  });
});

describe("node text geometry", () => {
  /**
   * Every combination of shape, item count and description that a node can
   * carry.
   *
   * The fixtures only exercise the shapes a real explainer uses, but the text
   * block is centred against a box whose height a circle and a diamond both
   * inflate, so the tight cases are built here on purpose. One item per node is
   * long enough to wrap, which is what puts an indented runover line — the line
   * most likely to escape the box — in front of the assertions.
   */
  function shapeSpec(shape: NodeShape): DiagramSpec {
    const nodes = [1, 3, 6].flatMap((count) =>
      [false, true].map((described) => ({
        id: `${shape}-${count}-${described ? "described" : "bare"}`,
        label: "Investigate the failing requests",
        ...(described
          ? { description: "The evidence that explains what changed in production." }
          : {}),
        items: Array.from({ length: count }, (_, index) =>
          index === 0 ? "Latency and error rates everywhere" : `Check number ${index + 1}`,
        ),
        emphasis: "secondary" as const,
        shape,
      })),
    );

    return {
      version: 1,
      title: "Text geometry check",
      type: "flowchart",
      direction: "vertical",
      nodes,
      edges: [],
    };
  }

  it.each(SHAPES)("stacks label, description and items inside a %s node", async (shape) => {
    const spec = shapeSpec(shape);
    const elements = await render(spec, THEMES.minimal);

    for (const node of spec.nodes) {
      const where = `${node.id}`;
      const container = boxOf(byId(elements, `node-${node.id}`));
      const label = boxOf(byId(elements, `node-${node.id}-label`));
      const items = boxOf(byId(elements, `node-${node.id}-items`));

      expectContained(label, container, `${where} label`);
      expectInsideShape(label, container, shape, `${where} label`);
      expectContained(items, container, `${where} items`);
      expectInsideShape(items, container, shape, `${where} items`);

      let above = label;
      if (node.description) {
        const description = boxOf(byId(elements, `node-${node.id}-description`));
        expectContained(description, container, `${where} description`);
        expectInsideShape(description, container, shape, `${where} description`);
        expect(
          above.y + above.height,
          `${where} label overlaps its description`,
        ).toBeLessThanOrEqual(description.y);
        above = description;
      }

      expect(above.y + above.height, `${where} items overlap the text above`).toBeLessThanOrEqual(
        items.y,
      );
    }
  });
});

describe("accentIndexFor", () => {
  /** A spec whose only interesting property is which nodes carry which category. */
  function specWithCategories(categories: (string | undefined)[]): DiagramSpec {
    return {
      version: 1,
      title: "Accent assignment check",
      type: "flowchart",
      direction: "horizontal",
      nodes: categories.map((category, index) => ({
        id: `n${index}`,
        label: `Step ${index + 1}`,
        ...(category === undefined ? {} : { category }),
        emphasis: "neutral",
        shape: "rectangle",
      })),
      edges: [],
    };
  }

  it("gives nodes that share a category the same accent", () => {
    const spec = FIXTURES.comparison;
    const byCategory = new Map<string, number>();

    for (const node of spec.nodes) {
      const category = node.category;
      expect(category, `node "${node.id}" carries no category`).toBeDefined();

      const index = accentIndexFor(spec, node.id);
      const first = byCategory.get(category ?? "");
      if (first === undefined) byCategory.set(category ?? "", index);
      else expect(index, `node "${node.id}"`).toBe(first);
    }

    expect(byCategory.size).toBeGreaterThan(1);
    expect(new Set(byCategory.values()).size, "two categories share an accent").toBe(
      byCategory.size,
    );
  });

  it("numbers categories in first-seen order", () => {
    const spec = specWithCategories(["Alpha", undefined, "Alpha", "Beta"]);

    expect(spec.nodes.map((node) => accentIndexFor(spec, node.id))).toEqual([0, 1, 0, 2]);
  });

  it("follows node order when nothing carries a category", () => {
    const spec = FIXTURES.hierarchy;
    expect(spec.nodes.every((node) => node.category === undefined)).toBe(true);

    spec.nodes.forEach((node, index) => {
      expect(accentIndexFor(spec, node.id), node.id).toBe(index % ACCENT_COUNT);
    });
  });

  it("wraps around when a spec has more categories than the theme has accents", () => {
    const spec = specWithCategories(
      Array.from({ length: ACCENT_COUNT + 2 }, (_, index) => `Category ${index}`),
    );

    expect(spec.nodes.map((node) => accentIndexFor(spec, node.id))).toEqual(
      spec.nodes.map((_, index) => index % ACCENT_COUNT),
    );
  });

  it.each(THEME_LIST.map((theme) => theme.id))(
    "has exactly one accent per index in the %s theme",
    (id) => {
      const theme = THEMES[id];
      expect(theme.node.accents).toHaveLength(ACCENT_COUNT);

      // A repeated palette would silently merge two categories into one colour.
      const strokes = theme.node.accents.map((accent) => accent.stroke);
      expect(new Set(strokes).size, `${id} repeats an accent stroke`).toBe(ACCENT_COUNT);
    },
  );

  it("stays inside the accent table for every fixture node", () => {
    for (const spec of FIXTURE_LIST) {
      for (const node of spec.nodes) {
        const index = accentIndexFor(spec, node.id);
        const where = `${spec.type} / node "${node.id}"`;

        expect(Number.isInteger(index), where).toBe(true);
        expect(index, where).toBeGreaterThanOrEqual(0);
        expect(index, where).toBeLessThan(ACCENT_COUNT);
      }
    }
  });

  it("depends only on the spec, not on the theme", () => {
    const spec = FIXTURES.flowchart;
    for (const node of spec.nodes) {
      const index = accentIndexFor(spec, node.id);
      expect(index).toBe(accentIndexFor(structuredClone(spec), node.id));
    }
  });
});

describe("restyleExcalidrawElements", () => {
  const userElement = {
    id: "user-1",
    type: "rectangle",
    x: 12,
    y: 34,
    width: 56,
    height: 78,
    strokeColor: "#123456",
    backgroundColor: "#654321",
    version: 1,
  } as unknown as ExcalidrawElement;

  async function restyled(): Promise<{
    before: ExcalidrawElement[];
    after: ExcalidrawElement[];
    spec: DiagramSpec;
  }> {
    const spec = FIXTURES.flowchart;
    const before = [...(await render(spec, THEMES.minimal)), userElement];
    return {
      before,
      after: restyleExcalidrawElements(before, spec, THEMES["dark-technical"]),
      spec,
    };
  }

  it("preserves the id and geometry of every element while repainting it", async () => {
    const { before, after, spec } = await restyled();

    expect(after.length).toBe(before.length);
    after.forEach((element, index) => {
      const original = before[index];
      expect(element.id).toBe(original.id);
      expect(element.x, original.id).toBe(original.x);
      expect(element.y, original.id).toBe(original.y);
      expect(element.width, original.id).toBe(original.width);
      expect(element.height, original.id).toBe(original.height);
    });

    const unchanged = spec.nodes.filter(
      (node) =>
        byId(before, `node-${node.id}`).strokeColor === byId(after, `node-${node.id}`).strokeColor,
    );
    expect(
      unchanged.map((node) => node.id),
      "these nodes kept their old accent",
    ).toEqual([]);
  });

  it("repaints generated elements from the new theme's accents", async () => {
    const { after, spec } = await restyled();
    const theme = THEMES["dark-technical"];

    for (const node of spec.nodes) {
      const accent = accentOf(theme, spec, node.id);
      const container = byId(after, `node-${node.id}`);

      expect(container.strokeColor, node.id).toBe(accent.stroke);
      expectFill(container, theme, accent, node.emphasis, node.id);
      expect(labelTextOf(after, node.id).strokeColor, node.id).toBe(accent.text);

      if (node.description) {
        expect(byId(after, `node-${node.id}-description`).strokeColor, node.id).toBe(accent.text);
      }
      if (node.items?.length) {
        expect(byId(after, `node-${node.id}-items`).strokeColor, node.id).toBe(accent.text);
      }
    }
    for (const edge of spec.edges) {
      expect(byId(after, `edge-${edge.id}`).strokeColor).toBe(theme.edge.stroke);
    }
    expect(byId(after, "diagram-title").strokeColor).toBe(theme.title.color);
    expect(byId(after, "diagram-summary").strokeColor).toBe(theme.title.subtitleColor);
  });

  it("leaves user-drawn elements untouched", async () => {
    const { after } = await restyled();
    const user = byId(after, "user-1");

    expect(user).toBe(userElement);
    expect(user.strokeColor).toBe("#123456");
    expect(user.backgroundColor).toBe("#654321");
  });
});
