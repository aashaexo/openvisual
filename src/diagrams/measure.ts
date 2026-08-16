import type { DiagramNode, DiagramSpec } from "@/diagrams/schema";
import { NODE_BOX, TYPOGRAPHY, widestLine, wrapText } from "@/diagrams/typography";
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

  const contentWidth = Math.max(
    widestLine(labelLines, TYPOGRAPHY.label.fontSize),
    widestLine(descriptionLines, TYPOGRAPHY.description.fontSize),
  );

  let width = clamp(
    Math.ceil(contentWidth + NODE_BOX.paddingX * 2),
    NODE_BOX.minWidth,
    NODE_BOX.maxWidth,
  );

  let height = Math.ceil(
    NODE_BOX.paddingY * 2 +
      labelLines.length * TYPOGRAPHY.label.lineHeight +
      (descriptionLines.length
        ? NODE_BOX.gap + descriptionLines.length * TYPOGRAPHY.description.lineHeight
        : 0),
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
    height = Math.ceil(height * 1.9);
  }

  // Even sizes keep centre points on whole pixels.
  return {
    id: node.id,
    node,
    width: even(width),
    height: even(height),
    labelLines,
    descriptionLines,
  };
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
