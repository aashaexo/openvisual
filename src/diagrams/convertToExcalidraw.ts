import { convertToExcalidrawElements, FONT_FAMILY, ROUNDNESS } from "@excalidraw/excalidraw";
import type { ExcalidrawElementSkeleton } from "@excalidraw/excalidraw/data/transform";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { DiagramSpec, NodeEmphasis } from "@/diagrams/schema";
import type { DiagramLayout, PositionedNode } from "@/diagrams/layouts/types";
import { NODE_BOX, TEXT_WIDTH_RATIO, TYPOGRAPHY } from "@/diagrams/typography";
import type { DiagramTheme, NodePalette, ThemeFont } from "@/themes";

/**
 * Turns a computed layout into Excalidraw elements.
 *
 * Every colour, stroke and font here comes from the theme — never from the
 * model. Node text is bound to its container and each node's parts share a
 * group id, so dragging, resizing and deleting behave as one object while the
 * scene stays fully editable.
 */

export interface ConvertOptions {
  includeTitle?: boolean;
}

const FONT_MAP: Record<ThemeFont, number> = {
  Helvetica: FONT_FAMILY.Helvetica,
  Excalifont: FONT_FAMILY.Excalifont,
  Nunito: FONT_FAMILY.Nunito,
  Cascadia: FONT_FAMILY.Cascadia,
  "Liberation Sans": FONT_FAMILY["Liberation Sans"],
};

/** Element id prefixes keep node ids and edge ids from ever colliding. */
export const NODE_ELEMENT_PREFIX = "node-";
export const EDGE_ELEMENT_PREFIX = "edge-";

export function convertLayoutToExcalidraw(
  spec: DiagramSpec,
  layout: DiagramLayout,
  theme: DiagramTheme,
  options: ConvertOptions = {},
): ExcalidrawElement[] {
  const skeletons: ExcalidrawElementSkeleton[] = [];

  if (options.includeTitle !== false) {
    skeletons.push(...titleSkeletons(spec, theme));
  }
  for (const decoration of layout.decorations) {
    skeletons.push(decorationSkeleton(decoration, theme));
  }
  for (const node of layout.nodes) {
    skeletons.push(...nodeSkeletons(node, theme));
  }
  for (const edge of layout.edges) {
    skeletons.push(edgeSkeleton(edge, theme));
  }

  const elements = convertToExcalidrawElements(skeletons, { regenerateIds: false });

  // The transform re-measures every text element and re-anchors it around its
  // own metrics, which drags free text out of position. The geometry computed
  // here is authoritative, so it is restored afterwards.
  const intended = new Map<string, TextBox>();
  for (const node of layout.nodes) {
    if (node.descriptionLines.length === 0) continue;
    const block = textBlock(node);
    intended.set(labelId(node.id), block.label);
    intended.set(descriptionId(node.id), block.description);
  }

  return elements.map((element) => {
    const box = intended.get(element.id);
    if (!box || element.type !== "text") return element;
    return { ...element, ...box, autoResize: false };
  });
}

interface TextBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

function labelId(nodeId: string): string {
  return `${NODE_ELEMENT_PREFIX}${nodeId}-label`;
}

function descriptionId(nodeId: string): string {
  return `${NODE_ELEMENT_PREFIX}${nodeId}-description`;
}

/**
 * Label and description laid out as one centred block.
 *
 * Excalidraw positions *bound* text differently inside each container shape
 * (an ellipse insets it, a rectangle pins it near the top), so a node that
 * carries a description places both pieces of text itself instead.
 */
function textBlock(node: PositionedNode): { label: TextBox; description: TextBox } {
  const width = Math.round(node.width * TEXT_WIDTH_RATIO[node.node.shape]);
  const x = Math.round(node.x + (node.width - width) / 2);

  const labelHeight = node.labelLines.length * TYPOGRAPHY.label.lineHeight;
  const descriptionHeight = node.descriptionLines.length * TYPOGRAPHY.description.lineHeight;
  const blockHeight = labelHeight + NODE_BOX.gap + descriptionHeight;
  const top = Math.round(node.y + (node.height - blockHeight) / 2);

  return {
    label: { x, y: top, width, height: labelHeight },
    description: { x, y: top + labelHeight + NODE_BOX.gap, width, height: descriptionHeight },
  };
}

function paletteFor(theme: DiagramTheme, emphasis: NodeEmphasis): NodePalette {
  return theme.node[emphasis];
}

/**
 * Repaints an existing scene in a different theme.
 *
 * Switching theme must not throw away manual edits, so positions and any
 * element the user added themselves are left exactly as they are — only the
 * colours and stroke settings of the generated elements change.
 */
export function restyleExcalidrawElements(
  elements: readonly ExcalidrawElement[],
  spec: DiagramSpec,
  theme: DiagramTheme,
): ExcalidrawElement[] {
  const emphasisById = new Map(spec.nodes.map((node) => [node.id, node.emphasis]));
  const byId = new Map(elements.map((element) => [element.id, element]));

  const paletteForElementId = (id: string): NodePalette | null => {
    if (!id.startsWith(NODE_ELEMENT_PREFIX)) return null;
    const nodeId = id.slice(NODE_ELEMENT_PREFIX.length).replace(/-(description|label)$/, "");
    const emphasis = emphasisById.get(nodeId);
    return emphasis ? paletteFor(theme, emphasis) : null;
  };

  return elements.map((element) => {
    const patch = (next: Partial<ExcalidrawElement>): ExcalidrawElement =>
      ({ ...element, ...next, version: element.version + 1 }) as ExcalidrawElement;

    // Bound text inherits the styling of whatever it is attached to.
    const containerId = "containerId" in element ? element.containerId : null;
    if (typeof containerId === "string") {
      const nodePalette = paletteForElementId(containerId);
      if (nodePalette) return patch({ strokeColor: nodePalette.text });
      if (byId.get(containerId)?.type === "arrow") {
        return patch({ strokeColor: theme.edge.labelColor });
      }
      return element;
    }

    const palette = paletteForElementId(element.id);
    if (palette) {
      return patch({
        strokeColor: element.type === "text" ? palette.text : palette.stroke,
        ...(element.type === "text"
          ? {}
          : {
              backgroundColor: palette.background,
              fillStyle: theme.node.fillStyle,
              strokeWidth: theme.node.strokeWidth,
              roughness: theme.node.roughness,
            }),
      });
    }

    if (element.id.startsWith(EDGE_ELEMENT_PREFIX)) {
      return patch({
        strokeColor: theme.edge.stroke,
        strokeWidth: theme.edge.strokeWidth,
        roughness: theme.edge.roughness,
      });
    }

    if (element.id.startsWith("decoration-")) {
      return patch({
        strokeColor: element.type === "text" ? theme.title.color : theme.edge.stroke,
      });
    }

    if (element.id === "diagram-title") return patch({ strokeColor: theme.title.color });
    if (element.id === "diagram-summary") return patch({ strokeColor: theme.title.subtitleColor });

    // Anything else was added by the user; leave it alone.
    return element;
  });
}

function nodeSkeletons(node: PositionedNode, theme: DiagramTheme): ExcalidrawElementSkeleton[] {
  const palette = paletteFor(theme, node.node.emphasis);
  const groupId = `group-${node.id}`;
  const hasDescription = node.descriptionLines.length > 0;

  const shared = {
    strokeColor: palette.stroke,
    backgroundColor: palette.background,
    fillStyle: theme.node.fillStyle,
    strokeWidth: theme.node.strokeWidth,
    strokeStyle: "solid" as const,
    roughness: theme.node.roughness,
    groupIds: [groupId],
  };

  const container = {
    ...shared,
    type: shapeOf(node),
    id: `${NODE_ELEMENT_PREFIX}${node.id}`,
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
    roundness:
      node.node.shape === "rounded" && theme.node.rounded
        ? { type: ROUNDNESS.ADAPTIVE_RADIUS }
        : null,
    // A label-only node uses Excalidraw's bound text, which keeps the text
    // attached through resizes. Nodes with a description position their own
    // text instead — see textBlock().
    ...(hasDescription
      ? {}
      : {
          label: {
            text: node.labelLines.join("\n"),
            fontSize: TYPOGRAPHY.label.fontSize,
            fontFamily: FONT_MAP[theme.node.font],
            strokeColor: palette.text,
            textAlign: "center" as const,
            verticalAlign: "middle" as const,
          },
        }),
  } as unknown as ExcalidrawElementSkeleton;

  if (!hasDescription) return [container];

  const block = textBlock(node);

  const label = {
    type: "text",
    id: labelId(node.id),
    ...block.label,
    text: node.labelLines.join("\n"),
    fontSize: TYPOGRAPHY.label.fontSize,
    fontFamily: FONT_MAP[theme.node.font],
    strokeColor: palette.text,
    textAlign: "center" as const,
    verticalAlign: "top" as const,
    autoResize: false,
    groupIds: [groupId],
  } as unknown as ExcalidrawElementSkeleton;

  const description = {
    type: "text",
    id: descriptionId(node.id),
    ...block.description,
    text: node.descriptionLines.join("\n"),
    fontSize: TYPOGRAPHY.description.fontSize,
    fontFamily: FONT_MAP[theme.node.font],
    strokeColor: palette.text,
    opacity: 75,
    textAlign: "center" as const,
    verticalAlign: "top" as const,
    autoResize: false,
    groupIds: [groupId],
  } as unknown as ExcalidrawElementSkeleton;

  return [container, label, description];
}

function edgeSkeleton(
  routed: DiagramLayout["edges"][number],
  theme: DiagramTheme,
): ExcalidrawElementSkeleton {
  const [origin] = routed.points;
  const points = routed.points.map((point) => [point.x - origin.x, point.y - origin.y]);

  return {
    type: "arrow",
    id: `${EDGE_ELEMENT_PREFIX}${routed.id}`,
    x: origin.x,
    y: origin.y,
    points,
    strokeColor: theme.edge.stroke,
    strokeWidth: theme.edge.strokeWidth,
    strokeStyle: routed.edge.style,
    roughness: theme.edge.roughness,
    backgroundColor: "transparent",
    endArrowhead: routed.edge.directed ? "arrow" : null,
    startArrowhead: null,
    // Binding by id keeps connectors attached when a node is dragged.
    start: { id: `${NODE_ELEMENT_PREFIX}${routed.edge.source}` },
    end: { id: `${NODE_ELEMENT_PREFIX}${routed.edge.target}` },
    ...(routed.edge.label
      ? {
          label: {
            text: routed.edge.label,
            fontSize: TYPOGRAPHY.edgeLabel.fontSize,
            fontFamily: FONT_MAP[theme.edge.font],
            strokeColor: theme.edge.labelColor,
          },
        }
      : {}),
  } as unknown as ExcalidrawElementSkeleton;
}

function decorationSkeleton(
  decoration: DiagramLayout["decorations"][number],
  theme: DiagramTheme,
): ExcalidrawElementSkeleton {
  if (decoration.kind === "line") {
    const [origin] = decoration.points;
    return {
      type: "line",
      id: `decoration-${decoration.id}`,
      x: origin.x,
      y: origin.y,
      points: decoration.points.map((point) => [point.x - origin.x, point.y - origin.y]),
      strokeColor: theme.edge.stroke,
      strokeWidth: 1,
      strokeStyle: decoration.dashed ? "dashed" : "solid",
      roughness: theme.edge.roughness,
      backgroundColor: "transparent",
      opacity: 60,
    } as unknown as ExcalidrawElementSkeleton;
  }

  return {
    type: "text",
    id: `decoration-${decoration.id}`,
    x: decoration.x,
    y: decoration.y,
    width: decoration.width,
    text: decoration.text,
    fontSize: TYPOGRAPHY.subtitle.fontSize,
    fontFamily: FONT_MAP[theme.title.font],
    strokeColor: theme.title.color,
    textAlign: decoration.align,
    verticalAlign: "top" as const,
  } as unknown as ExcalidrawElementSkeleton;
}

function titleSkeletons(spec: DiagramSpec, theme: DiagramTheme): ExcalidrawElementSkeleton[] {
  const skeletons: ExcalidrawElementSkeleton[] = [];
  const baseY = -(
    TYPOGRAPHY.title.lineHeight +
    (spec.summary ? TYPOGRAPHY.subtitle.lineHeight : 0) +
    28
  );

  skeletons.push({
    type: "text",
    id: "diagram-title",
    x: 40,
    y: baseY,
    text: spec.title,
    fontSize: TYPOGRAPHY.title.fontSize,
    fontFamily: FONT_MAP[theme.title.font],
    strokeColor: theme.title.color,
    textAlign: "left" as const,
    verticalAlign: "top" as const,
  } as unknown as ExcalidrawElementSkeleton);

  if (spec.summary) {
    skeletons.push({
      type: "text",
      id: "diagram-summary",
      x: 40,
      y: baseY + TYPOGRAPHY.title.lineHeight + 6,
      text: spec.summary,
      fontSize: TYPOGRAPHY.subtitle.fontSize,
      fontFamily: FONT_MAP[theme.title.font],
      strokeColor: theme.title.subtitleColor,
      textAlign: "left" as const,
      verticalAlign: "top" as const,
    } as unknown as ExcalidrawElementSkeleton);
  }

  return skeletons;
}

function shapeOf(node: PositionedNode): "rectangle" | "ellipse" | "diamond" {
  switch (node.node.shape) {
    case "circle":
      return "ellipse";
    case "diamond":
      return "diamond";
    default:
      return "rectangle";
  }
}
