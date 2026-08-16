import { normalize, routeAll } from "@/diagrams/layouts/geometry";
import { SPACING } from "@/diagrams/layouts/types";
import type {
  DiagramLayout,
  LayoutContext,
  LayoutDecoration,
  MeasuredNode,
  PositionedNode,
} from "@/diagrams/layouts/types";

const COLUMN_GAP = 96;
const ROW_GAP = 40;
const HEADER_HEIGHT = 44;

/**
 * Comparison: a deterministic multi-column layout.
 *
 * Columns come from the nodes' `category` when the model supplied one — that is
 * exactly what "compare A against B" means semantically. Without categories the
 * nodes are dealt into two balanced columns in declaration order.
 */
export function comparisonLayout(ctx: LayoutContext): DiagramLayout {
  const { spec, nodes } = ctx;
  const columns = buildColumns(nodes);
  const hasHeaders = columns.some((column) => column.title !== null);

  const columnWidths = columns.map((column) => Math.max(...column.nodes.map((node) => node.width)));

  const positioned: PositionedNode[] = [];
  const decorations: LayoutDecoration[] = [];
  const top = hasHeaders ? HEADER_HEIGHT + 18 : 0;

  let x = 0;
  columns.forEach((column, columnIndex) => {
    const columnWidth = columnWidths[columnIndex];

    if (column.title) {
      decorations.push({
        kind: "caption",
        id: `comparison-header-${columnIndex}`,
        x,
        y: 0,
        width: columnWidth,
        text: column.title,
        align: "center",
        role: "column",
      });
    }

    let y = top;
    for (const node of column.nodes) {
      // Centre each node inside its column so ragged widths still read as a column.
      positioned.push({ ...node, x: x + (columnWidth - node.width) / 2, y });
      y += node.height + ROW_GAP;
    }

    if (columnIndex < columns.length - 1) {
      const dividerX = x + columnWidth + COLUMN_GAP / 2;
      decorations.push({
        kind: "line",
        id: `comparison-divider-${columnIndex}`,
        points: [
          { x: dividerX, y: 0 },
          { x: dividerX, y: y - ROW_GAP },
        ],
        dashed: true,
      });
    }

    x += columnWidth + COLUMN_GAP;
  });

  return normalize(positioned, routeAll(positioned, spec.edges), decorations);
}

interface Column {
  title: string | null;
  nodes: MeasuredNode[];
}

function buildColumns(nodes: MeasuredNode[]): Column[] {
  const categorised = new Map<string, MeasuredNode[]>();
  let missing = 0;

  for (const node of nodes) {
    const key = node.node.category?.trim();
    if (!key) {
      missing += 1;
      continue;
    }
    const list = categorised.get(key) ?? [];
    list.push(node);
    categorised.set(key, list);
  }

  // Categories are only trustworthy as columns when every node carries one and
  // they actually split the set.
  if (missing === 0 && categorised.size >= 2 && categorised.size <= 4) {
    return [...categorised.entries()].map(([title, columnNodes]) => ({
      title,
      nodes: columnNodes,
    }));
  }

  const half = Math.ceil(nodes.length / 2);
  return [
    { title: null, nodes: nodes.slice(0, half) },
    { title: null, nodes: nodes.slice(half) },
  ].filter((column) => column.nodes.length > 0);
}

export const COMPARISON_SPACING = { COLUMN_GAP, ROW_GAP, HEADER_HEIGHT, PADDING: SPACING.padding };
