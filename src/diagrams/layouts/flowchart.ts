import { ELK_BASE_OPTIONS, runElk } from "@/diagrams/layouts/elk";
import { normalize } from "@/diagrams/layouts/geometry";
import type { DiagramLayout, LayoutContext } from "@/diagrams/layouts/types";

/** Flowchart: ELK's layered algorithm, flowing down or right. */
export async function flowchartLayout(ctx: LayoutContext): Promise<DiagramLayout> {
  const { spec, nodes, signal } = ctx;
  const direction = spec.direction === "horizontal" ? "RIGHT" : "DOWN";

  const { nodes: positioned, edges } = await runElk(
    nodes,
    spec.edges,
    {
      ...ELK_BASE_OPTIONS,
      "elk.algorithm": "layered",
      "elk.direction": direction,
      "elk.edgeRouting": "POLYLINE",
      "elk.layered.spacing.nodeNodeBetweenLayers": "96",
      "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
      "elk.layered.nodePlacement.strategy": "BRANDES_KOEPF",
      "elk.layered.considerModelOrder.strategy": "NODES_AND_EDGES",
      "elk.layered.cycleBreaking.strategy": "DEPTH_FIRST",
    },
    signal,
  );

  return normalize(positioned, edges);
}
