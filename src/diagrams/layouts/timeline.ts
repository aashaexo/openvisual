import { ELK_BASE_OPTIONS, runElk } from "@/diagrams/layouts/elk";
import { normalize, routeAll } from "@/diagrams/layouts/geometry";
import type { DiagramLayout, LayoutContext, LayoutDecoration } from "@/diagrams/layouts/types";

/**
 * Timeline: a horizontal layered layout.
 *
 * When the graph is a clean chain — one node per layer, which is what a
 * timeline normally is — the nodes are snapped onto a single baseline and an
 * axis with tick marks is drawn underneath. Anything less tidy keeps ELK's
 * layered result untouched so nodes can never collide.
 */
export async function timelineLayout(ctx: LayoutContext): Promise<DiagramLayout> {
  const { spec, nodes, signal } = ctx;

  const { nodes: positioned, edges } = await runElk(
    nodes,
    spec.edges,
    {
      ...ELK_BASE_OPTIONS,
      "elk.algorithm": "layered",
      "elk.direction": "RIGHT",
      "elk.edgeRouting": "POLYLINE",
      "elk.layered.spacing.nodeNodeBetweenLayers": "110",
      "elk.layered.considerModelOrder.strategy": "NODES_AND_EDGES",
      "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
      "elk.layered.cycleBreaking.strategy": "DEPTH_FIRST",
    },
    signal,
  );

  const columns = new Map<number, number>();
  for (const node of positioned) {
    columns.set(node.x, (columns.get(node.x) ?? 0) + 1);
  }
  const isSingleTrack = [...columns.values()].every((count) => count === 1);

  if (!isSingleTrack) {
    return normalize(positioned, edges);
  }

  const baseline = Math.max(...positioned.map((node) => node.y + node.height / 2));
  const aligned = positioned
    .map((node) => ({ ...node, y: baseline - node.height / 2 }))
    .sort((a, b) => a.x - b.x);

  const axisY = baseline + Math.max(...aligned.map((n) => n.height)) / 2 + 46;
  const first = aligned[0];
  const last = aligned[aligned.length - 1];

  const decorations: LayoutDecoration[] = [
    {
      kind: "line",
      id: "timeline-axis",
      points: [
        { x: first.x - 24, y: axisY },
        { x: last.x + last.width + 24, y: axisY },
      ],
    },
    ...aligned.map<LayoutDecoration>((node, index) => ({
      kind: "line",
      id: `timeline-tick-${index}`,
      points: [
        { x: node.x + node.width / 2, y: axisY - 9 },
        { x: node.x + node.width / 2, y: axisY + 9 },
      ],
    })),
  ];

  return normalize(aligned, routeAll(aligned, spec.edges), decorations);
}
