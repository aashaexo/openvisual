import { z } from "zod";
import { DIAGRAM_ICONS } from "@/diagrams/icons";

/**
 * The single source of truth for what a model is allowed to return.
 *
 * The model produces *semantics only*. Anything that describes appearance —
 * colours, fonts, sizes, coordinates, markup — is rejected here and supplied
 * later by the theme and the layout engine.
 */

export const DIAGRAM_TYPES = [
  "flowchart",
  "timeline",
  "hierarchy",
  "comparison",
  "cycle",
  "hub_spoke",
] as const;

export const DIAGRAM_DIRECTIONS = ["horizontal", "vertical", "radial"] as const;

export const NODE_SHAPES = ["rectangle", "rounded", "circle", "diamond"] as const;

export const NODE_EMPHASIS = ["primary", "secondary", "neutral"] as const;

export const EDGE_STYLES = ["solid", "dashed"] as const;

export const MIN_NODES = 3;
export const MAX_NODES = 10;
export const MAX_LABEL_WORDS = 7;
export const MAX_DESCRIPTION_WORDS = 16;
export const MAX_ITEMS = 6;
export const MAX_ITEM_WORDS = 6;

export const diagramTypeSchema = z.enum(DIAGRAM_TYPES);
export const diagramDirectionSchema = z.enum(DIAGRAM_DIRECTIONS);

export function countWords(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

/** Markup, script and style fragments the model must never emit. */
const FORBIDDEN_MARKUP = /<\/?[a-z][\s\S]*>|<svg|&lt;|\{\{|\$\{|javascript:|data:text\/html/i;

const textField = (maxWords: number, field: string) =>
  z
    .string()
    .trim()
    .min(1, { message: `${field} must not be empty` })
    .max(240, { message: `${field} is too long` })
    .refine((value) => countWords(value) <= maxWords, {
      message: `${field} must be ${maxWords} words or fewer`,
    })
    .refine((value) => !FORBIDDEN_MARKUP.test(value), {
      message: `${field} must be plain text (no HTML, SVG, script or template syntax)`,
    });

const idField = z
  .string()
  .trim()
  .min(1, { message: "id must not be empty" })
  .max(64, { message: "id is too long" })
  .regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/, {
    message: "id may only contain letters, numbers, hyphens and underscores",
  });

/**
 * `strictObject` is what actually enforces "no colours, fonts, dimensions,
 * coordinates, SVG, HTML, Mermaid, JavaScript or CSS": any key that is not in
 * the schema is a validation error rather than silently ignored data.
 */
export const diagramNodeSchema = z.strictObject({
  id: idField,
  label: textField(MAX_LABEL_WORDS, "label"),
  description: textField(MAX_DESCRIPTION_WORDS, "description").optional(),
  items: z
    .array(textField(MAX_ITEM_WORDS, "item"))
    .max(MAX_ITEMS, { message: `a node may not have more than ${MAX_ITEMS} items` })
    .optional(),
  category: z.string().trim().min(1).max(48).optional(),
  emphasis: z.enum(NODE_EMPHASIS),
  shape: z.enum(NODE_SHAPES),
  // A name from a closed set, exactly like `shape`: the model is saying what
  // the node *means*, not what it should look like. The glyph, its colour and
  // its size are still chosen entirely by the app.
  icon: z.enum(DIAGRAM_ICONS).optional(),
});

export const diagramEdgeSchema = z.strictObject({
  id: idField,
  source: idField,
  target: idField,
  label: textField(MAX_LABEL_WORDS, "edge label").optional(),
  directed: z.boolean(),
  style: z.enum(EDGE_STYLES),
});

export const diagramSpecSchema = z
  .strictObject({
    version: z.literal(1),
    title: textField(12, "title"),
    summary: textField(30, "summary").optional(),
    type: diagramTypeSchema,
    direction: diagramDirectionSchema,
    nodes: z
      .array(diagramNodeSchema)
      .min(MIN_NODES, { message: `a diagram needs at least ${MIN_NODES} nodes` })
      .max(MAX_NODES, { message: `a diagram may not have more than ${MAX_NODES} nodes` }),
    edges: z.array(diagramEdgeSchema).max(40, { message: "too many edges" }),
  })
  .superRefine((spec, ctx) => {
    const nodeIds = new Set<string>();
    spec.nodes.forEach((node, index) => {
      if (nodeIds.has(node.id)) {
        ctx.addIssue({
          code: "custom",
          path: ["nodes", index, "id"],
          message: `duplicate node id "${node.id}"`,
        });
      }
      nodeIds.add(node.id);
    });

    const edgeIds = new Set<string>();
    spec.edges.forEach((edge, index) => {
      if (edgeIds.has(edge.id)) {
        ctx.addIssue({
          code: "custom",
          path: ["edges", index, "id"],
          message: `duplicate edge id "${edge.id}"`,
        });
      }
      edgeIds.add(edge.id);

      if (!nodeIds.has(edge.source)) {
        ctx.addIssue({
          code: "custom",
          path: ["edges", index, "source"],
          message: `edge source "${edge.source}" does not match any node id`,
        });
      }
      if (!nodeIds.has(edge.target)) {
        ctx.addIssue({
          code: "custom",
          path: ["edges", index, "target"],
          message: `edge target "${edge.target}" does not match any node id`,
        });
      }
      if (edge.source === edge.target) {
        ctx.addIssue({
          code: "custom",
          path: ["edges", index],
          message: `edge "${edge.id}" points at itself; self-referencing edges are not allowed`,
        });
      }
    });
  });

export type DiagramType = z.infer<typeof diagramTypeSchema>;
export type DiagramDirection = z.infer<typeof diagramDirectionSchema>;
export type DiagramNode = z.infer<typeof diagramNodeSchema>;
export type DiagramEdge = z.infer<typeof diagramEdgeSchema>;
export type DiagramSpec = z.infer<typeof diagramSpecSchema>;
export type NodeShape = DiagramNode["shape"];
export type NodeEmphasis = DiagramNode["emphasis"];

/**
 * A hand-written JSON Schema handed to Ollama's structured-output `format`
 * field. It is intentionally looser than the Zod schema (Ollama's grammar
 * engine does not express word counts); Zod remains the gate before rendering.
 */
export const diagramJsonSchema = {
  type: "object",
  properties: {
    version: { type: "integer", enum: [1] },
    title: { type: "string" },
    summary: { type: "string" },
    type: { type: "string", enum: [...DIAGRAM_TYPES] },
    direction: { type: "string", enum: [...DIAGRAM_DIRECTIONS] },
    nodes: {
      type: "array",
      minItems: MIN_NODES,
      maxItems: MAX_NODES,
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          label: { type: "string" },
          description: { type: "string" },
          items: { type: "array", maxItems: MAX_ITEMS, items: { type: "string" } },
          category: { type: "string" },
          emphasis: { type: "string", enum: [...NODE_EMPHASIS] },
          shape: { type: "string", enum: [...NODE_SHAPES] },
          icon: { type: "string", enum: [...DIAGRAM_ICONS] },
        },
        required: ["id", "label", "emphasis", "shape"],
      },
    },
    edges: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          source: { type: "string" },
          target: { type: "string" },
          label: { type: "string" },
          directed: { type: "boolean" },
          style: { type: "string", enum: [...EDGE_STYLES] },
        },
        required: ["id", "source", "target", "directed", "style"],
      },
    },
  },
  required: ["version", "title", "type", "direction", "nodes", "edges"],
} as const;

/**
 * The icon field is optional, and a constrained grammar lets a small model
 * satisfy `required` and stop — which is exactly what qwen3:4b did, emitting
 * no icons at all however the prompt was worded.
 *
 * So when icons are on the field becomes REQUIRED with a "none" member: the
 * model must make a choice per node rather than skipping the property. The
 * sentinel is stripped before Zod ever sees it.
 */
export const NO_ICON = "none";

export function buildDiagramJsonSchema(icons: boolean) {
  if (!icons) return diagramJsonSchema;

  const node = diagramJsonSchema.properties.nodes.items;
  return {
    ...diagramJsonSchema,
    properties: {
      ...diagramJsonSchema.properties,
      nodes: {
        ...diagramJsonSchema.properties.nodes,
        items: {
          ...node,
          properties: {
            ...node.properties,
            icon: { type: "string", enum: [...DIAGRAM_ICONS, NO_ICON] },
          },
          required: [...node.required, "icon"],
        },
      },
    },
  };
}

/** Removes the "none" sentinel so the result matches the strict Zod schema. */
export function stripIconSentinel(value: unknown): unknown {
  if (typeof value !== "object" || value === null) return value;
  const spec = value as { nodes?: unknown };
  if (!Array.isArray(spec.nodes)) return value;

  return {
    ...spec,
    nodes: spec.nodes.map((node) => {
      if (typeof node !== "object" || node === null) return node;
      const { icon, ...rest } = node as Record<string, unknown>;
      return icon === NO_ICON || icon === undefined ? rest : { ...rest, icon };
    }),
  };
}
