import ELK from "elkjs/lib/elk.bundled.js";
import type { ElkExtendedEdge, ElkNode, LayoutOptions } from "elkjs/lib/elk-api";
import type { DiagramEdge } from "@/diagrams/schema";
import type { MeasuredNode, Point, PositionedNode, RoutedEdge } from "@/diagrams/layouts/types";
import { routeStraight } from "@/diagrams/layouts/geometry";

/**
 * ELK is instantiated lazily and reused: constructing it spins up its worker
 * shim, which we do not want to pay for on app start.
 */
let instance: InstanceType<typeof ELK> | null = null;

function elk(): InstanceType<typeof ELK> {
  if (!instance) instance = new ELK();
  return instance;
}

export interface ElkRunResult {
  nodes: PositionedNode[];
  edges: RoutedEdge[];
}

/**
 * Runs an ELK algorithm over the measured nodes and lifts the result back into
 * our own layout types. ELK's edge sections are used when present so that
 * connectors follow the routed path rather than cutting through nodes.
 */
export async function runElk(
  nodes: MeasuredNode[],
  edges: DiagramEdge[],
  layoutOptions: LayoutOptions,
  signal?: AbortSignal,
): Promise<ElkRunResult> {
  const graph: ElkNode = {
    id: "root",
    layoutOptions: { "elk.randomSeed": "1", ...layoutOptions },
    children: nodes.map((node) => ({
      id: node.id,
      width: node.width,
      height: node.height,
    })),
    edges: edges.map((edge) => ({
      id: edge.id,
      sources: [edge.source],
      targets: [edge.target],
    })),
  };

  const result = await elk().layout(graph);
  signal?.throwIfAborted();

  const byId = new Map(nodes.map((node) => [node.id, node]));
  const positioned: PositionedNode[] = [];

  for (const child of result.children ?? []) {
    const measured = byId.get(child.id);
    if (!measured) continue;
    positioned.push({ ...measured, x: child.x ?? 0, y: child.y ?? 0 });
  }

  // Anything ELK dropped (it never should) still gets a slot, off to the side.
  for (const measured of nodes) {
    if (!positioned.some((n) => n.id === measured.id)) {
      positioned.push({ ...measured, x: 0, y: 0 });
    }
  }

  const positionedById = new Map(positioned.map((node) => [node.id, node]));
  const routed: RoutedEdge[] = [];

  for (const edge of edges) {
    const source = positionedById.get(edge.source);
    const target = positionedById.get(edge.target);
    if (!source || !target) continue;

    const elkEdge = (result.edges as ElkExtendedEdge[] | undefined)?.find((e) => e.id === edge.id);
    const section = elkEdge?.sections?.[0];

    const points: Point[] = section
      ? [
          { x: section.startPoint.x, y: section.startPoint.y },
          ...(section.bendPoints ?? []).map((p) => ({ x: p.x, y: p.y })),
          { x: section.endPoint.x, y: section.endPoint.y },
        ]
      : routeStraight(source, target);

    routed.push({ id: edge.id, edge, points });
  }

  return { nodes: positioned, edges: routed };
}

/** Shared spacing so every ELK-backed layout breathes the same way. */
export const ELK_BASE_OPTIONS: LayoutOptions = {
  "elk.spacing.nodeNode": "64",
  "elk.spacing.edgeNode": "34",
  "elk.spacing.edgeEdge": "24",
  "elk.padding": "[top=0,left=0,bottom=0,right=0]",
};
