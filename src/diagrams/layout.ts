import type { DiagramSpec } from "@/diagrams/schema";
import { measureSpec } from "@/diagrams/measure";
import { comparisonLayout } from "@/diagrams/layouts/comparison";
import { cycleLayout } from "@/diagrams/layouts/cycle";
import { flowchartLayout } from "@/diagrams/layouts/flowchart";
import { hierarchyLayout } from "@/diagrams/layouts/hierarchy";
import { hubSpokeLayout } from "@/diagrams/layouts/hubSpoke";
import { timelineLayout } from "@/diagrams/layouts/timeline";
import { normalize, routeAll } from "@/diagrams/layouts/geometry";
import type { DiagramLayout, LayoutContext, PositionedNode } from "@/diagrams/layouts/types";

/** Minimum clear space between two node boxes, in scene units. */
export const MIN_NODE_GAP = 24;

const LAYOUTS = {
  flowchart: flowchartLayout,
  timeline: timelineLayout,
  hierarchy: hierarchyLayout,
  comparison: comparisonLayout,
  cycle: cycleLayout,
  hub_spoke: hubSpokeLayout,
} as const;

/**
 * Computes positions for a validated spec.
 *
 * Runs the type-specific layout, then applies a separation pass as a safety
 * net so "no overlapping nodes" is a property of the engine rather than a
 * property of any one algorithm's tuning.
 */
export async function layoutDiagram(
  spec: DiagramSpec,
  signal?: AbortSignal,
): Promise<DiagramLayout> {
  const ctx: LayoutContext = { spec, nodes: measureSpec(spec), signal };
  const layout = await LAYOUTS[spec.type](ctx);
  signal?.throwIfAborted();

  const { nodes, moved } = separate(layout.nodes);
  if (!moved) return layout;

  // Separation invalidates any routed path, so connectors are recomputed.
  return normalize(nodes, routeAll(nodes, spec.edges), layout.decorations);
}

export function overlaps(a: PositionedNode, b: PositionedNode, gap = 0): boolean {
  return (
    a.x < b.x + b.width + gap &&
    b.x < a.x + a.width + gap &&
    a.y < b.y + b.height + gap &&
    b.y < a.y + a.height + gap
  );
}

/**
 * Pushes overlapping boxes apart along whichever axis they overlap least.
 * Converges quickly for the 3–10 node diagrams this app produces.
 */
function separate(input: PositionedNode[]): { nodes: PositionedNode[]; moved: boolean } {
  const nodes = input.map((node) => ({ ...node }));
  let moved = false;

  for (let pass = 0; pass < 24; pass += 1) {
    let collided = false;

    for (let i = 0; i < nodes.length; i += 1) {
      for (let j = i + 1; j < nodes.length; j += 1) {
        const a = nodes[i];
        const b = nodes[j];
        if (!overlaps(a, b, MIN_NODE_GAP)) continue;

        collided = true;
        moved = true;

        const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) + MIN_NODE_GAP;
        const overlapY =
          Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) + MIN_NODE_GAP;

        if (overlapX < overlapY) {
          const shift = overlapX / 2;
          const direction = a.x + a.width / 2 <= b.x + b.width / 2 ? -1 : 1;
          a.x += shift * direction;
          b.x -= shift * direction;
        } else {
          const shift = overlapY / 2;
          const direction = a.y + a.height / 2 <= b.y + b.height / 2 ? -1 : 1;
          a.y += shift * direction;
          b.y -= shift * direction;
        }
      }
    }

    if (!collided) break;
  }

  return { nodes, moved };
}
