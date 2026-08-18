import { FIXTURE_LIST } from "@/diagrams/fixtures";
import { measureNode, measureSpec } from "@/diagrams/measure";
import type { DiagramNode, NodeShape } from "@/diagrams/schema";
import {
  NODE_BOX,
  TEXT_WIDTH_RATIO,
  TYPOGRAPHY,
  measureText,
  wrapText,
} from "@/diagrams/typography";

const SHAPES: NodeShape[] = ["rectangle", "rounded", "circle", "diamond"];

/** Every fixture node carrying an item list, so the item assertions cannot pass vacuously. */
const ITEM_NODES: DiagramNode[] = FIXTURE_LIST.flatMap((spec) =>
  spec.nodes.filter((node) => node.items !== undefined && node.items.length > 0),
);

function makeNode(overrides: Partial<DiagramNode> = {}): DiagramNode {
  return {
    id: "n1",
    label: "Plan the next step",
    emphasis: "neutral",
    shape: "rectangle",
    ...overrides,
  };
}

/** Widest rendered line of a measured node, in the same units as node.width. */
function widestMeasuredLine(lines: string[], fontSize: number): number {
  return lines.reduce((max, line) => Math.max(max, measureText(line, fontSize)), 0);
}

describe("wrapText", () => {
  it("returns a single line when the text fits the budget", () => {
    expect(wrapText("Read the result", 600, TYPOGRAPHY.label.fontSize)).toEqual([
      "Read the result",
    ]);
  });

  it("keeps every line inside the pixel budget", () => {
    const budget = 200;
    const lines = wrapText("alpha beta gamma delta epsilon zeta", budget, 20);

    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) {
      expect(measureText(line, 20)).toBeLessThanOrEqual(budget);
    }
  });

  it("never splits a word", () => {
    const text = "the agent decides which tool to call next";
    const lines = wrapText(text, 140, 20);

    expect(lines.join(" ")).toBe(text);
    for (const line of lines) {
      expect(line).not.toBe("");
    }
  });

  it("gives a word longer than the budget its own unbroken line", () => {
    const long = "supercalifragilisticexpialidocious";
    const lines = wrapText(`short ${long} tail`, 100, 20);

    expect(measureText(long, 20)).toBeGreaterThan(100);
    expect(lines).toContain(long);
    expect(lines.join(" ")).toBe(`short ${long} tail`);
  });

  it("collapses surrounding and repeated whitespace", () => {
    expect(wrapText("  spaced   out  ", 600, 20)).toEqual(["spaced out"]);
  });
});

describe("measureNode", () => {
  it("keeps a normal label inside the configured width range", () => {
    const measured = measureNode(makeNode());

    expect(measured.width).toBeGreaterThanOrEqual(NODE_BOX.minWidth);
    expect(measured.width).toBeLessThanOrEqual(NODE_BOX.maxWidth);
    expect(measured.height).toBeGreaterThanOrEqual(NODE_BOX.minHeight);
    expect(measured.labelLines).toEqual(["Plan the next step"]);
  });

  it("never falls below the minimum box for a very short label", () => {
    const measured = measureNode(makeNode({ label: "Go" }));

    expect(measured.width).toBe(NODE_BOX.minWidth);
    expect(measured.height).toBe(NODE_BOX.minHeight);
  });

  it("wraps a long label onto several lines and grows taller", () => {
    const short = measureNode(makeNode({ label: "Rank" }));
    const long = measureNode(
      makeNode({ label: "Coordinate the downstream retrieval and ranking services" }),
    );

    expect(short.labelLines).toHaveLength(1);
    expect(long.labelLines.length).toBeGreaterThan(1);
    expect(long.height).toBeGreaterThan(short.height);
  });

  it("makes a node with a description taller than the same node without one", () => {
    const bare = measureNode(makeNode());
    const described = measureNode(makeNode({ description: "The agent decides what to do first." }));

    expect(described.descriptionLines.length).toBeGreaterThan(0);
    expect(described.height).toBeGreaterThan(bare.height);
    expect(bare.descriptionLines).toEqual([]);
  });

  it("makes a node with items taller than the same node without them", () => {
    const bare = measureNode(makeNode());
    const listed = measureNode(makeNode({ items: ["First check", "Second check"] }));

    expect(bare.itemLines).toEqual([]);
    expect(listed.itemLines.length).toBeGreaterThan(0);
    expect(listed.height).toBeGreaterThan(bare.height);
  });

  it("adds items on top of a description rather than replacing it", () => {
    const described = measureNode(makeNode({ description: "The agent decides what to do first." }));
    const both = measureNode(
      makeNode({
        description: "The agent decides what to do first.",
        items: ["First check", "Second check"],
      }),
    );

    expect(both.descriptionLines).toEqual(described.descriptionLines);
    expect(both.height).toBeGreaterThan(described.height);
  });

  it("gives every short item its own bullet-prefixed line", () => {
    const items = ["Error rate spikes", "Latency climbs", "Eval scores drop"];
    const measured = measureNode(makeNode({ items }));

    expect(measured.itemLines).toHaveLength(items.length);
    measured.itemLines.forEach((line, index) => {
      expect(line).toBe(`${NODE_BOX.bullet}${items[index]}`);
    });
  });

  it("wraps a long item and keeps every line inside the inner text width", () => {
    const innerMax = NODE_BOX.maxWidth - NODE_BOX.paddingX * 2;
    const measured = measureNode(
      makeNode({ items: ["Latency and error rates across every region"] }),
    );

    expect(measured.itemLines.length).toBeGreaterThan(1);
    for (const line of measured.itemLines) {
      expect(measureText(line, TYPOGRAPHY.item.fontSize)).toBeLessThanOrEqual(innerMax);
    }
  });

  it("widens the box for an item longer than the label", () => {
    const narrow = measureNode(makeNode({ label: "Check" }));
    const wide = measureNode(makeNode({ label: "Check", items: ["Latency and error metrics"] }));

    expect(wide.width).toBeGreaterThan(narrow.width);
  });

  it("produces a square box for circle nodes", () => {
    for (const label of ["Hub", "Local model runtime", "Runs entirely on the machine"]) {
      const circle = measureNode(makeNode({ label, shape: "circle" }));
      expect(circle.width).toBe(circle.height);
    }
  });

  it("inflates a diamond relative to a rectangle with the same text", () => {
    const node = makeNode({ label: "Goal reached?", description: "Check the exit condition." });
    const rectangle = measureNode({ ...node, shape: "rectangle" });
    const diamond = measureNode({ ...node, shape: "diamond" });

    expect(diamond.width).toBeGreaterThan(rectangle.width);
    expect(diamond.height).toBeGreaterThan(rectangle.height);
  });

  it("returns even dimensions so centres land on whole pixels", () => {
    for (const shape of SHAPES) {
      const measured = measureNode(
        makeNode({ shape, label: "Adjust the next one", description: "Feed the lesson forward." }),
      );
      expect(measured.width % 2).toBe(0);
      expect(measured.height % 2).toBe(0);
    }
  });

  it("is deterministic for the same node", () => {
    const node = makeNode({
      label: "Watch the response carefully",
      description: "Note what people read, share and ignore.",
      shape: "diamond",
    });

    expect(measureNode(node)).toEqual(measureNode(node));
  });
});

describe("TEXT_WIDTH_RATIO invariant", () => {
  const cases: { shape: NodeShape; node: DiagramNode }[] = SHAPES.flatMap((shape) =>
    FIXTURE_LIST.flatMap((spec) => spec.nodes.map((node) => ({ shape, node: { ...node, shape } }))),
  );

  it("fits the widest wrapped line inside every shape's text box", () => {
    expect(cases.length).toBeGreaterThan(0);

    for (const { shape, node } of cases) {
      const measured = measureNode(node);
      const widest = Math.max(
        widestMeasuredLine(measured.labelLines, TYPOGRAPHY.label.fontSize),
        widestMeasuredLine(measured.descriptionLines, TYPOGRAPHY.description.fontSize),
        widestMeasuredLine(measured.itemLines, TYPOGRAPHY.item.fontSize),
      );
      const budget = measured.width * TEXT_WIDTH_RATIO[shape];

      expect(
        budget >= widest,
        `${shape} node "${node.label}": text box ${budget.toFixed(2)} < widest line ${widest.toFixed(2)}`,
      ).toBe(true);
    }
  });

  it("fits every wrapped item line of every fixture node inside its text box", () => {
    expect(ITEM_NODES.length).toBeGreaterThan(0);

    for (const node of ITEM_NODES) {
      const measured = measureNode(node);
      const budget = measured.width * TEXT_WIDTH_RATIO[node.shape];

      expect(measured.itemLines.length).toBeGreaterThanOrEqual(node.items?.length ?? 0);
      for (const line of measured.itemLines) {
        const width = measureText(line, TYPOGRAPHY.item.fontSize);
        expect(
          budget >= width,
          `node "${node.id}" item line "${line}": text box ${budget.toFixed(2)} < ${width.toFixed(2)}`,
        ).toBe(true);
      }
    }
  });

  it("fits the widest item the wrapper will ever emit inside every shape", () => {
    // Six maximum-length items of the widest words that still wrap, i.e. the worst case.
    const items = Array.from({ length: 6 }, () => "abcdefghij abcdefghij abcdefghij");

    for (const shape of SHAPES) {
      const measured = measureNode(makeNode({ shape, items }));
      const widest = widestMeasuredLine(measured.itemLines, TYPOGRAPHY.item.fontSize);
      const budget = measured.width * TEXT_WIDTH_RATIO[shape];

      expect(budget >= widest, `${shape}: ${budget} < ${widest}`).toBe(true);
    }
  });

  it("fits the longest label the wrapper will ever emit", () => {
    // A label made of the widest words that still wrap, i.e. the worst realistic case.
    const label = "abcdefghijklmnop abcdefghijklmnop abcdefghijklmnop";

    for (const shape of SHAPES) {
      const measured = measureNode(makeNode({ label, shape }));
      const widest = widestMeasuredLine(measured.labelLines, TYPOGRAPHY.label.fontSize);

      expect(
        measured.width * TEXT_WIDTH_RATIO[shape] >= widest,
        `${shape}: ${measured.width * TEXT_WIDTH_RATIO[shape]} < ${widest}`,
      ).toBe(true);
    }
  });
});

describe("measureSpec", () => {
  it("measures every node of every fixture, preserving order", () => {
    for (const spec of FIXTURE_LIST) {
      const measured = measureSpec(spec);

      expect(measured.map((node) => node.id)).toEqual(spec.nodes.map((node) => node.id));
      for (const node of measured) {
        expect(Number.isFinite(node.width)).toBe(true);
        expect(Number.isFinite(node.height)).toBe(true);
        expect(node.width).toBeGreaterThan(0);
        expect(node.height).toBeGreaterThan(0);
      }
    }
  });

  it("is deterministic across runs", () => {
    for (const spec of FIXTURE_LIST) {
      expect(measureSpec(spec)).toEqual(measureSpec(spec));
    }
  });
});
