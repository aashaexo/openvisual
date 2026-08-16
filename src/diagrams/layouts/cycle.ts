import { normalize, nodeSpan, routeAll, sequenceOrder } from "@/diagrams/layouts/geometry";
import type { DiagramLayout, LayoutContext, PositionedNode } from "@/diagrams/layouts/types";

const RING_GAP = 46;

/**
 * Cycle: nodes evenly spaced around a circle, in reading order.
 *
 * The radius is derived from the largest node so that the chord between two
 * neighbours is always wider than the nodes themselves — overlap is impossible
 * by construction rather than by tuning.
 */
export function cycleLayout(ctx: LayoutContext): DiagramLayout {
  const { spec, nodes } = ctx;
  const order = sequenceOrder(
    nodes.map((node) => node.id),
    spec.edges,
  );
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const ordered = order.map((id) => byId.get(id)).filter((node) => node !== undefined);

  const count = ordered.length;
  const widest = Math.max(...ordered.map((node) => nodeSpan(node)));
  const chordNeeded = widest + RING_GAP;
  const radius = Math.max(chordNeeded / (2 * Math.sin(Math.PI / Math.max(count, 3))), widest);

  const positioned: PositionedNode[] = ordered.map((node, index) => {
    // Start at the top and run clockwise, which is how cycles are read.
    const angle = -Math.PI / 2 + (index * 2 * Math.PI) / count;
    const cx = radius * Math.cos(angle);
    const cy = radius * Math.sin(angle);
    return { ...node, x: cx - node.width / 2, y: cy - node.height / 2 };
  });

  return normalize(positioned, routeAll(positioned, spec.edges));
}
