import { convertToExcalidrawElements, FONT_FAMILY, ROUNDNESS } from "@excalidraw/excalidraw";
import type { ExcalidrawElementSkeleton } from "@excalidraw/excalidraw/data/transform";
import type { ExcalidrawElement, FileId } from "@excalidraw/excalidraw/element/types";
import type { BinaryFileData, BinaryFiles, DataURL } from "@excalidraw/excalidraw/types";
import type { DiagramNode, DiagramSpec, NodeEmphasis } from "@/diagrams/schema";
import type { DiagramIcon } from "@/diagrams/icons";
import { iconDataUrl } from "@/diagrams/icons";
import type { DiagramLayout, PositionedNode } from "@/diagrams/layouts/types";
import {
  ICON_BOX,
  measureText,
  NODE_BOX,
  TEXT_WIDTH_RATIO,
  TYPOGRAPHY,
} from "@/diagrams/typography";
import { ACCENT_COUNT } from "@/themes";
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

/**
 * A scene is elements plus the binary payloads they reference. Icons are
 * `image` elements, and an image element without its file entry renders as a
 * broken placeholder — so the two always travel together.
 */
export interface ExcalidrawScene {
  elements: ExcalidrawElement[];
  files: BinaryFiles;
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
): ExcalidrawScene {
  const skeletons: ExcalidrawElementSkeleton[] = [];
  const files: BinaryFiles = {};

  if (options.includeTitle !== false) {
    skeletons.push(...titleSkeletons(spec, theme));
  }
  for (const decoration of layout.decorations) {
    skeletons.push(decorationSkeleton(decoration, theme));
  }
  for (const node of layout.nodes) {
    skeletons.push(...nodeSkeletons(node, theme, accentFor(spec, theme, node.id), files));
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
    if (!placesOwnText(node)) continue;
    const block = textBlock(node);
    intended.set(labelId(node.id), block.label);
    if (block.description) intended.set(descriptionId(node.id), block.description);
    if (block.items) intended.set(itemsId(node.id), block.items);
  }
  for (const [id, box] of titleBoxes(spec)) {
    intended.set(id, box);
  }

  return {
    elements: elements.map((element) => {
      const box = intended.get(element.id);
      if (!box || element.type !== "text") return element;
      return { ...element, ...box, autoResize: false };
    }),
    files,
  };
}

interface TextBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Excalidraw stores an image's bytes separately from the element, keyed by
 * `fileId`. The id is derived from the payload rather than generated, so the
 * same spec in the same theme always yields the same scene — a random id would
 * make every re-render a spurious change and defeat file de-duplication.
 */
function iconFile(icon: DiagramIcon, color: string): { fileId: FileId; file: BinaryFileData } {
  const dataURL = iconDataUrl(icon, color);
  const fileId = `icon-${icon}-${hashString(dataURL)}` as FileId;

  return {
    fileId,
    file: {
      id: fileId,
      mimeType: "image/svg+xml",
      dataURL: dataURL as DataURL,
      // A wall-clock timestamp would make an otherwise identical scene differ
      // on every render; nothing in the renderer reads this field.
      created: ICON_FILE_CREATED,
    },
  };
}

/** Epoch stamp shared by every generated icon — see iconFile(). */
const ICON_FILE_CREATED = 0;

/**
 * Every icon payload a spec needs, rebuilt from the spec alone.
 *
 * Excalidraw keeps an image's bytes outside the element, so a scene restored
 * from storage or repainted into another theme arrives with elements whose
 * files are missing or stale. Regenerating is safe precisely because the ids
 * are derived: the same spec and theme always rebuild the same entries.
 */
export function iconFilesFor(spec: DiagramSpec, theme: DiagramTheme): BinaryFiles {
  const files: BinaryFiles = {};

  for (const node of spec.nodes) {
    if (!node.icon) continue;
    const { fileId, file } = iconFile(node.icon, accentFor(spec, theme, node.id).text);
    files[fileId] = file;
  }

  return files;
}

/** FNV-1a; short, stable across runs, and not used for anything security-bearing. */
function hashString(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36);
}

/**
 * Title and summary get an explicitly measured width.
 *
 * Excalidraw measures free text with whatever font is loaded at the moment the
 * element is created. Web fonts arrive asynchronously, so a title created
 * before Excalifont loads records a too-narrow width and then renders wider
 * than its own bounds — which silently clips it out of exports and the
 * presentation view. Our own measurement deliberately overestimates, so the
 * recorded box always contains the glyphs.
 */
function titleBoxes(spec: DiagramSpec): Array<[string, TextBox]> {
  const boxes: Array<[string, TextBox]> = [
    [
      "diagram-title",
      {
        x: TITLE_X,
        y: titleTop(spec),
        width: Math.ceil(measureText(spec.title, TYPOGRAPHY.title.fontSize)),
        height: TYPOGRAPHY.title.lineHeight,
      },
    ],
  ];

  if (spec.summary) {
    boxes.push([
      "diagram-summary",
      {
        x: TITLE_X,
        y: titleTop(spec) + TYPOGRAPHY.title.lineHeight + 6,
        width: Math.ceil(measureText(spec.summary, TYPOGRAPHY.subtitle.fontSize)),
        height: TYPOGRAPHY.subtitle.lineHeight,
      },
    ]);
  }

  return boxes;
}

const TITLE_X = 40;

function titleTop(spec: DiagramSpec): number {
  return -(TYPOGRAPHY.title.lineHeight + (spec.summary ? TYPOGRAPHY.subtitle.lineHeight : 0) + 28);
}

function labelId(nodeId: string): string {
  return `${NODE_ELEMENT_PREFIX}${nodeId}-label`;
}

function descriptionId(nodeId: string): string {
  return `${NODE_ELEMENT_PREFIX}${nodeId}-description`;
}

function itemsId(nodeId: string): string {
  return `${NODE_ELEMENT_PREFIX}${nodeId}-items`;
}

function iconId(nodeId: string): string {
  return `${NODE_ELEMENT_PREFIX}${nodeId}-icon`;
}

/** Suffixes that turn a node id into one of its part element ids. */
const NODE_PART_SUFFIX = /-(description|items|label|icon)$/;

/**
 * A node places its own text as soon as it carries anything besides the label.
 *
 * An icon counts: bound text centres itself in the whole container, which would
 * sit it straight on top of the glyph.
 */
function placesOwnText(node: PositionedNode): boolean {
  return (
    node.descriptionLines.length > 0 || node.itemLines.length > 0 || node.node.icon !== undefined
  );
}

interface NodeTextBlock {
  icon: TextBox | null;
  label: TextBox;
  description: TextBox | null;
  items: TextBox | null;
}

/**
 * Icon, label, description and items laid out as one vertically centred block.
 *
 * Excalidraw positions *bound* text differently inside each container shape
 * (an ellipse insets it, a rectangle pins it near the top), so a node that
 * carries more than a label places every piece of text itself instead.
 *
 * The stack is measured with exactly the metrics `measureNode` sized the box
 * with, so the block is never taller than the node minus its padding and every
 * piece stays inside the container.
 */
function textBlock(node: PositionedNode): NodeTextBlock {
  const width = Math.round(node.width * TEXT_WIDTH_RATIO[node.node.shape]);
  const x = Math.round(node.x + (node.width - width) / 2);

  const iconHeight = node.node.icon ? ICON_BOX.size + ICON_BOX.gap : 0;
  const labelHeight = node.labelLines.length * TYPOGRAPHY.label.lineHeight;
  const descriptionHeight = node.descriptionLines.length * TYPOGRAPHY.description.lineHeight;
  const itemsHeight = node.itemLines.length * TYPOGRAPHY.item.lineHeight;

  const blockHeight =
    iconHeight +
    labelHeight +
    (descriptionHeight ? NODE_BOX.gap + descriptionHeight : 0) +
    (itemsHeight ? NODE_BOX.itemGap + itemsHeight : 0);
  const top = Math.round(node.y + (node.height - blockHeight) / 2);

  let cursor = top;

  let icon: TextBox | null = null;
  if (iconHeight) {
    // Square and centred on the node's own axis, not the text column's: the
    // text column is narrowed by TEXT_WIDTH_RATIO but shares the same centre.
    icon = {
      x: Math.round(node.x + (node.width - ICON_BOX.size) / 2),
      y: cursor,
      width: ICON_BOX.size,
      height: ICON_BOX.size,
    };
    cursor += iconHeight;
  }

  const label = { x, y: cursor, width, height: labelHeight };
  cursor += labelHeight;

  let description: TextBox | null = null;
  if (descriptionHeight) {
    cursor += NODE_BOX.gap;
    description = { x, y: cursor, width, height: descriptionHeight };
    cursor += descriptionHeight;
  }

  let items: TextBox | null = null;
  if (itemsHeight) {
    cursor += NODE_BOX.itemGap;
    items = { x, y: cursor, width, height: itemsHeight };
  }

  return { icon, label, description, items };
}

/**
 * Which accent a node paints itself with.
 *
 * Derived only from the spec's own structure, never from the model: nodes that
 * share a `category` share an accent, categories are numbered in first-seen
 * order, and an uncategorised node takes the next accent in reading order.
 */
export function accentIndexFor(spec: DiagramSpec, nodeId: string): number {
  const byCategory = new Map<string, number>();
  let next = 0;

  for (const node of spec.nodes) {
    const seen = node.category === undefined ? undefined : byCategory.get(node.category);
    const index = seen ?? next++;
    if (node.category !== undefined && seen === undefined) byCategory.set(node.category, index);
    if (node.id === nodeId) return index % ACCENT_COUNT;
  }

  return 0;
}

function accentFor(spec: DiagramSpec, theme: DiagramTheme, nodeId: string): NodePalette {
  const { accents } = theme.node;
  return accents[accentIndexFor(spec, nodeId) % accents.length];
}

/** How far a "secondary" fill is blended back towards the canvas. */
const SECONDARY_FILL_MIX = 0.55;

/**
 * `emphasis` modulates fill, not hue.
 *
 * The accent already carries the hue, so emphasis only decides how much of it
 * the box is filled with — otherwise every emphasis would fight the accent for
 * the same job.
 */
function fillFor(theme: DiagramTheme, accent: NodePalette, emphasis: NodeEmphasis): string {
  switch (emphasis) {
    case "primary":
      return accent.background;
    case "secondary":
      return mixHex(accent.background, theme.canvas.background, SECONDARY_FILL_MIX);
    case "neutral":
      return "transparent";
  }
}

/**
 * Blends one theme colour towards another. The app derives this from the two
 * theme colours it was given; the model still never supplies a hue.
 */
function mixHex(from: string, to: string, amount: number): string {
  const start = parseHex(from);
  const end = parseHex(to);
  if (!start || !end) return from;

  const channels = start.map((channel, index) =>
    Math.round(channel + (end[index] - channel) * amount)
      .toString(16)
      .padStart(2, "0"),
  );
  return `#${channels.join("")}`;
}

function parseHex(value: string): [number, number, number] | null {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value.trim());
  if (!match) return null;

  const hex = match[1].length === 3 ? match[1].replace(/./g, (char) => char + char) : match[1];
  return [0, 2, 4].map((offset) => parseInt(hex.slice(offset, offset + 2), 16)) as [
    number,
    number,
    number,
  ];
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
  const nodesById = new Map(spec.nodes.map((node) => [node.id, node]));
  const byId = new Map(elements.map((element) => [element.id, element]));

  const nodeForElementId = (id: string): DiagramNode | null => {
    if (!id.startsWith(NODE_ELEMENT_PREFIX)) return null;
    // A container's element id is the bare node id and its text elements suffix
    // it, so the whole id is tried first — otherwise a node genuinely named
    // "…-label" would repaint as its neighbour.
    const rest = id.slice(NODE_ELEMENT_PREFIX.length);
    return nodesById.get(rest) ?? nodesById.get(rest.replace(NODE_PART_SUFFIX, "")) ?? null;
  };

  return elements.map((element) => {
    const patch = (next: Partial<ExcalidrawElement>): ExcalidrawElement =>
      ({ ...element, ...next, version: element.version + 1 }) as ExcalidrawElement;

    // Bound text inherits the styling of whatever it is attached to.
    const containerId = "containerId" in element ? element.containerId : null;
    if (typeof containerId === "string") {
      const container = nodeForElementId(containerId);
      if (container) return patch({ strokeColor: accentFor(spec, theme, container.id).text });
      if (byId.get(containerId)?.type === "arrow") {
        return patch({ strokeColor: theme.edge.labelColor });
      }
      return element;
    }

    const owner = nodeForElementId(element.id);
    if (owner) {
      const accent = accentFor(spec, theme, owner.id);
      // An icon's colour is baked into its payload, so repainting it means
      // pointing the element at a differently-coloured file. The matching
      // entry comes from iconFilesFor(), which derives the same id.
      if (element.type === "image") {
        if (!owner.icon) return element;
        return patch({ fileId: iconFile(owner.icon, accent.text).fileId });
      }
      if (element.type === "text") return patch({ strokeColor: accent.text });
      return patch({
        strokeColor: accent.stroke,
        backgroundColor: fillFor(theme, accent, owner.emphasis),
        fillStyle: theme.node.fillStyle,
        strokeWidth: theme.node.strokeWidth,
        roughness: theme.node.roughness,
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

function nodeSkeletons(
  node: PositionedNode,
  theme: DiagramTheme,
  accent: NodePalette,
  files: BinaryFiles,
): ExcalidrawElementSkeleton[] {
  const groupId = `group-${node.id}`;
  const ownText = placesOwnText(node);

  const shared = {
    strokeColor: accent.stroke,
    backgroundColor: fillFor(theme, accent, node.node.emphasis),
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
    // attached through resizes. Nodes carrying a description or items position
    // their own text instead — see textBlock().
    ...(ownText
      ? {}
      : {
          label: {
            text: node.labelLines.join("\n"),
            fontSize: TYPOGRAPHY.label.fontSize,
            fontFamily: FONT_MAP[theme.node.font],
            strokeColor: accent.text,
            textAlign: "center" as const,
            verticalAlign: "middle" as const,
          },
        }),
  } as unknown as ExcalidrawElementSkeleton;

  if (!ownText) return [container];

  const block = textBlock(node);
  const skeletons: ExcalidrawElementSkeleton[] = [container];

  if (node.node.icon && block.icon) {
    // The glyph is stroked in the accent's text colour, so it reads as part of
    // the label rather than as a pasted-in picture.
    const { fileId, file } = iconFile(node.node.icon, accent.text);
    files[fileId] = file;

    skeletons.push({
      type: "image",
      id: iconId(node.id),
      ...block.icon,
      fileId,
      // Not "pending": the payload is generated in-process and always travels
      // with the element, so there is never a fetch to wait for.
      status: "saved" as const,
      groupIds: [groupId],
    } as unknown as ExcalidrawElementSkeleton);
  }

  skeletons.push({
    type: "text",
    id: labelId(node.id),
    ...block.label,
    text: node.labelLines.join("\n"),
    fontSize: TYPOGRAPHY.label.fontSize,
    fontFamily: FONT_MAP[theme.node.font],
    strokeColor: accent.text,
    textAlign: "center" as const,
    verticalAlign: "top" as const,
    autoResize: false,
    groupIds: [groupId],
  } as unknown as ExcalidrawElementSkeleton);

  if (block.description) {
    skeletons.push({
      type: "text",
      id: descriptionId(node.id),
      ...block.description,
      text: node.descriptionLines.join("\n"),
      fontSize: TYPOGRAPHY.description.fontSize,
      fontFamily: FONT_MAP[theme.node.font],
      strokeColor: accent.text,
      opacity: 75,
      textAlign: "center" as const,
      verticalAlign: "top" as const,
      autoResize: false,
      groupIds: [groupId],
    } as unknown as ExcalidrawElementSkeleton);
  }

  if (block.items) {
    // Bullets read as a list only when their markers line up, so the item block
    // is left-aligned even though the label above it is centred.
    skeletons.push({
      type: "text",
      id: itemsId(node.id),
      ...block.items,
      text: node.itemLines.join("\n"),
      fontSize: TYPOGRAPHY.item.fontSize,
      fontFamily: FONT_MAP[theme.node.font],
      strokeColor: accent.text,
      textAlign: "left" as const,
      verticalAlign: "top" as const,
      autoResize: false,
      groupIds: [groupId],
    } as unknown as ExcalidrawElementSkeleton);
  }

  return skeletons;
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
  const boxes = new Map(titleBoxes(spec));

  skeletons.push({
    type: "text",
    id: "diagram-title",
    ...boxes.get("diagram-title"),
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
      ...boxes.get("diagram-summary"),
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
