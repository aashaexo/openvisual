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
  convertLayoutToExcalidraw,
  restyleExcalidrawElements,
} from "@/diagrams/convertToExcalidraw";
import { FIXTURE_LIST, FIXTURES } from "@/diagrams/fixtures";
import { layoutDiagram } from "@/diagrams/layout";
import { THEMES } from "@/themes";
import type { DiagramSpec, DiagramType } from "@/diagrams/schema";
import type { DiagramTheme } from "@/themes";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

const TYPES = FIXTURE_LIST.map((spec) => spec.type);
const rendered = new Map<DiagramType, ExcalidrawElement[]>();

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

  it.each(TYPES)("binds label-only text and frees described text for %s", (type) => {
    const spec = FIXTURES[type];
    const elements = elementsFor(type);

    for (const node of spec.nodes) {
      const containerId = `node-${node.id}`;
      const where = `${type} / node "${node.id}"`;

      if (node.description) {
        expect(byId(elements, `${containerId}-label`).type, where).toBe("text");
        expect(byId(elements, `${containerId}-description`).type, where).toBe("text");
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
    }
  });

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

  it("takes node colours from the theme table and nowhere else", async () => {
    const spec = FIXTURES.flowchart;
    const minimal = await render(spec, THEMES.minimal);
    const dark = await render(spec, THEMES["dark-technical"]);

    for (const [elements, theme] of [
      [minimal, THEMES.minimal],
      [dark, THEMES["dark-technical"]],
    ] as const) {
      for (const node of spec.nodes) {
        const palette = theme.node[node.emphasis];
        const container = byId(elements, `node-${node.id}`);
        const where = `${theme.id} / node "${node.id}"`;

        expect(container.strokeColor, where).toBe(palette.stroke);
        expect(container.backgroundColor, where).toBe(palette.background);
        expect(labelTextOf(elements, node.id).strokeColor, where).toBe(palette.text);
      }
      for (const edge of spec.edges) {
        expect(byId(elements, `edge-${edge.id}`).strokeColor).toBe(theme.edge.stroke);
      }
    }

    expect(byId(minimal, "node-goal").strokeColor).not.toBe(byId(dark, "node-goal").strokeColor);
    expect(byId(minimal, "node-goal").backgroundColor).not.toBe(
      byId(dark, "node-goal").backgroundColor,
    );
    expect(labelTextOf(minimal, "goal").strokeColor).not.toBe(
      labelTextOf(dark, "goal").strokeColor,
    );
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

  it("preserves the id and geometry of every element", async () => {
    const { before, after } = await restyled();

    expect(after.length).toBe(before.length);
    after.forEach((element, index) => {
      const original = before[index];
      expect(element.id).toBe(original.id);
      expect(element.x, original.id).toBe(original.x);
      expect(element.y, original.id).toBe(original.y);
      expect(element.width, original.id).toBe(original.width);
      expect(element.height, original.id).toBe(original.height);
    });
  });

  it("repaints generated elements in the new theme", async () => {
    const { after, spec } = await restyled();
    const theme = THEMES["dark-technical"];

    for (const node of spec.nodes) {
      const palette = theme.node[node.emphasis];
      const container = byId(after, `node-${node.id}`);
      expect(container.strokeColor, node.id).toBe(palette.stroke);
      expect(container.backgroundColor, node.id).toBe(palette.background);
      expect(labelTextOf(after, node.id).strokeColor, node.id).toBe(palette.text);
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
