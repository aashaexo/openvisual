import type {
  DiagramLayout,
  LayoutDecoration,
  Point,
  PositionedNode,
  RoutedEdge,
} from "@/diagrams/layouts/types";
import { SPACING } from "@/diagrams/layouts/types";
import type { DiagramEdge } from "@/diagrams/schema";

export function center(node: PositionedNode): Point {
  return { x: node.x + node.width / 2, y: node.y + node.height / 2 };
}

/**
 * Where a ray leaving the centre of `node` towards `towards` crosses the node
 * border. Circles are clipped as ellipses, everything else as a rectangle
 * (a diamond clipped as its bounding box leaves a small visual gap, which
 * reads fine and keeps the maths cheap and stable).
 */
export function clipToBorder(node: PositionedNode, towards: Point): Point {
  const c = center(node);
  const dx = towards.x - c.x;
  const dy = towards.y - c.y;
  if (dx === 0 && dy === 0) return c;

  if (node.node.shape === "circle") {
    const rx = node.width / 2;
    const ry = node.height / 2;
    const t = 1 / Math.sqrt((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry));
    return { x: c.x + dx * t, y: c.y + dy * t };
  }

  const halfW = node.width / 2;
  const halfH = node.height / 2;
  const scale = Math.min(
    halfW / Math.abs(dx || Number.EPSILON),
    halfH / Math.abs(dy || Number.EPSILON),
  );
  return { x: c.x + dx * scale, y: c.y + dy * scale };
}

/** Straight connector clipped to both node borders. */
export function routeStraight(source: PositionedNode, target: PositionedNode): Point[] {
  return [clipToBorder(source, center(target)), clipToBorder(target, center(source))];
}

export function routeAll(nodes: PositionedNode[], edges: DiagramEdge[]): RoutedEdge[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const routed: RoutedEdge[] = [];
  for (const edge of edges) {
    const source = byId.get(edge.source);
    const target = byId.get(edge.target);
    if (!source || !target) continue;
    routed.push({ id: edge.id, edge, points: routeStraight(source, target) });
  }
  return routed;
}

/**
 * Shifts everything so the diagram starts at (padding, padding) and reports the
 * overall size. Every layout ends with this so downstream code can assume
 * non-negative, viewport-friendly coordinates.
 */
export function normalize(
  nodes: PositionedNode[],
  edges: RoutedEdge[],
  decorations: LayoutDecoration[] = [],
): DiagramLayout {
  if (nodes.length === 0) {
    return { nodes, edges, decorations, width: 0, height: 0 };
  }

  const xs: number[] = [];
  const ys: number[] = [];
  for (const node of nodes) {
    xs.push(node.x, node.x + node.width);
    ys.push(node.y, node.y + node.height);
  }
  for (const edge of edges) {
    for (const point of edge.points) {
      xs.push(point.x);
      ys.push(point.y);
    }
  }
  for (const decoration of decorations) {
    if (decoration.kind === "line") {
      for (const point of decoration.points) {
        xs.push(point.x);
        ys.push(point.y);
      }
    } else {
      xs.push(decoration.x, decoration.x + decoration.width);
      ys.push(decoration.y, decoration.y + 30);
    }
  }

  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const offsetX = SPACING.padding - minX;
  const offsetY = SPACING.padding - minY;

  const movedNodes = nodes.map((node) => ({
    ...node,
    x: round(node.x + offsetX),
    y: round(node.y + offsetY),
  }));
  const movedEdges = edges.map((edge) => ({
    ...edge,
    points: edge.points.map((p) => ({ x: round(p.x + offsetX), y: round(p.y + offsetY) })),
  }));
  const movedDecorations = decorations.map((decoration) =>
    decoration.kind === "line"
      ? {
          ...decoration,
          points: decoration.points.map((p) => ({
            x: round(p.x + offsetX),
            y: round(p.y + offsetY),
          })),
        }
      : { ...decoration, x: round(decoration.x + offsetX), y: round(decoration.y + offsetY) },
  );

  const width = Math.max(...xs) - minX + SPACING.padding * 2;
  const height = Math.max(...ys) - minY + SPACING.padding * 2;

  return {
    nodes: movedNodes,
    edges: movedEdges,
    decorations: movedDecorations,
    width: round(width),
    height: round(height),
  };
}

/** Half-diagonal-ish span used when packing nodes onto a circle. */
export function nodeSpan(node: { width: number; height: number }): number {
  return Math.hypot(node.width, node.height);
}

export function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Reading order for graphs that are conceptually sequences (timeline, cycle).
 * Follows the edge chain from whichever node has no incoming edge; falls back
 * to declaration order for anything that is not a clean chain.
 */
export function sequenceOrder(ids: string[], edges: DiagramEdge[]): string[] {
  const present = new Set(ids);
  const outgoing = new Map<string, string[]>();
  const indegree = new Map<string, number>(ids.map((id) => [id, 0]));

  for (const edge of edges) {
    if (!present.has(edge.source) || !present.has(edge.target)) continue;
    const list = outgoing.get(edge.source) ?? [];
    list.push(edge.target);
    outgoing.set(edge.source, list);
    indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1);
  }

  const start = ids.find((id) => (indegree.get(id) ?? 0) === 0) ?? ids[0];
  const visited = new Set<string>();
  const order: string[] = [];

  let current: string | undefined = start;
  while (current && !visited.has(current)) {
    visited.add(current);
    order.push(current);
    current = (outgoing.get(current) ?? []).find((next) => !visited.has(next));
  }

  for (const id of ids) {
    if (!visited.has(id)) order.push(id);
  }
  return order;
}
