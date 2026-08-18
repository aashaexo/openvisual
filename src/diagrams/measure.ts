import type { DiagramNode, DiagramSpec } from "@/diagrams/schema";
import {
  ICON_BOX,
  measureText,
  NODE_BOX,
  TEXT_WIDTH_RATIO,
  TYPOGRAPHY,
  widestLine,
  wrapText,
} from "@/diagrams/typography";
import type { MeasuredNode } from "@/diagrams/layouts/types";

/**
 * Turns a semantic node into a box with a size, wrapping its text first.
 * Sizing is deterministic and theme-independent, so the same spec always
 * produces the same layout.
 */
export function measureNode(node: DiagramNode): MeasuredNode {
  const innerMax = NODE_BOX.maxWidth - NODE_BOX.paddingX * 2;

  const labelLines = wrapText(node.label, innerMax, TYPOGRAPHY.label.fontSize);
  const descriptionLines = node.description
    ? wrapText(node.description, innerMax, TYPOGRAPHY.description.fontSize)
    : [];
  const itemLines = wrapItems(node.items ?? [], innerMax);

  // The icon shares the text block's column, so it competes for width with the
  // text rather than sitting beside it.
  const iconHeight = node.icon ? ICON_BOX.size + ICON_BOX.gap : 0;

  const contentWidth = Math.max(
    node.icon ? ICON_BOX.size : 0,
    widestLine(labelLines, TYPOGRAPHY.label.fontSize),
    widestLine(descriptionLines, TYPOGRAPHY.description.fontSize),
    widestLine(itemLines, TYPOGRAPHY.item.fontSize),
  );

  let width = clamp(
    Math.ceil(contentWidth + NODE_BOX.paddingX * 2),
    NODE_BOX.minWidth,
    NODE_BOX.maxWidth,
  );

  let height = Math.ceil(
    NODE_BOX.paddingY * 2 +
      iconHeight +
      labelLines.length * TYPOGRAPHY.label.lineHeight +
      (descriptionLines.length
        ? NODE_BOX.gap + descriptionLines.length * TYPOGRAPHY.description.lineHeight
        : 0) +
      (itemLines.length ? NODE_BOX.itemGap + itemLines.length * TYPOGRAPHY.item.lineHeight : 0),
  );

  height = Math.max(height, NODE_BOX.minHeight);

  // Circles and diamonds only fit text inside their inscribed rectangle, so
  // their bounding box is inflated to match TEXT_WIDTH_RATIO.
  if (node.shape === "circle") {
    const side = Math.ceil(Math.max(width, height) * 1.35);
    width = side;
    height = side;
  } else if (node.shape === "diamond") {
    width = Math.ceil(width * 1.7);
    // A diamond's inscribed rectangle narrows towards the top and bottom, so a
    // W-by-H text block only fits when W/width + H/height <= 1. A flat height
    // multiplier stops satisfying that once the stack is tall — which an item
    // list makes easy — and then the lowest line crosses the sloping edge.
    const textHeight = height - NODE_BOX.paddingY * 2;
    height = Math.ceil(Math.max(height * 1.9, textHeight / DIAMOND_HEIGHT_SHARE));
  }

  // Even sizes keep centre points on whole pixels.
  return {
    id: node.id,
    node,
    width: even(width),
    height: even(height),
    labelLines,
    descriptionLines,
    itemLines,
  };
}

/**
 * Share of a diamond's height its text block may occupy.
 *
 * The inscribed rectangle allows `1 - TEXT_WIDTH_RATIO.diamond`; the two points
 * held back cover the half-pixel that rounding a centred block introduces on
 * each axis, so the fit survives being snapped to whole pixels.
 */
const DIAMOND_HEIGHT_SHARE = 1 - TEXT_WIDTH_RATIO.diamond - 0.02;

/** Indent applied to the runover lines of a wrapped item. */
const ITEM_INDENT = "  ";

/**
 * Wraps every item into bullet-prefixed render-ready lines.
 *
 * The indent is budgeted for *before* wrapping rather than added afterwards,
 * because a runover line that grew past `innerMax` after the fact would push the
 * text outside the box the node was sized for.
 */
function wrapItems(items: readonly string[], innerMax: number): string[] {
  if (items.length === 0) return [];

  const indentWidth = measureText(ITEM_INDENT, TYPOGRAPHY.item.fontSize);

  return items.flatMap((item) =>
    wrapText(`${NODE_BOX.bullet}${item}`, innerMax - indentWidth, TYPOGRAPHY.item.fontSize).map(
      (line, index) => (index === 0 ? line : `${ITEM_INDENT}${line}`),
    ),
  );
}

export function measureSpec(spec: DiagramSpec): MeasuredNode[] {
  return spec.nodes.map(measureNode);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function even(value: number): number {
  return value % 2 === 0 ? value : value + 1;
}
