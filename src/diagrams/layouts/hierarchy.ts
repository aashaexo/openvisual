import { ELK_BASE_OPTIONS, runElk } from "@/diagrams/layouts/elk";
import { normalize } from "@/diagrams/layouts/geometry";
import type { DiagramLayout, LayoutContext } from "@/diagrams/layouts/types";

/** Hierarchy: ELK's Mr. Tree algorithm, so parents sit centred over children. */
export async function hierarchyLayout(ctx: LayoutContext): Promise<DiagramLayout> {
  const { spec, nodes, signal } = ctx;
  const direction = spec.direction === "horizontal" ? "RIGHT" : "DOWN";

  const { nodes: positioned, edges } = await runElk(
    nodes,
    spec.edges,
    {
      ...ELK_BASE_OPTIONS,
      "elk.algorithm": "mrtree",
      "elk.direction": direction,
      "elk.spacing.nodeNode": "56",
      "elk.mrtree.searchOrder": "DFS",
      "elk.mrtree.spacing.nodeNodeBetweenLevels": "96",
    },
    signal,
  );

  return normalize(positioned, edges);
}
