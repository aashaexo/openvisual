import { normalize, nodeSpan, routeAll } from "@/diagrams/layouts/geometry";
import type {
  DiagramLayout,
  LayoutContext,
  MeasuredNode,
  PositionedNode,
} from "@/diagrams/layouts/types";

const SPOKE_GAP = 52;

/**
 * Hub and spoke: one central node with the rest arranged radially around it.
 *
 * The hub is the highest-degree node, breaking ties towards a node the model
 * marked `primary`, then towards declaration order.
 */
export function hubSpokeLayout(ctx: LayoutContext): DiagramLayout {
  const { spec, nodes } = ctx;
  const hub = pickHub(nodes, ctx);
  const spokes = nodes.filter((node) => node.id !== hub.id);

  if (spokes.length === 0) {
    return normalize([{ ...hub, x: 0, y: 0 }], []);
  }

  const widestSpoke = Math.max(...spokes.map((node) => nodeSpan(node)));
  const chordNeeded = widestSpoke + SPOKE_GAP;
  const byNeighbours = chordNeeded / (2 * Math.sin(Math.PI / Math.max(spokes.length, 2)));
  const byHub = nodeSpan(hub) / 2 + widestSpoke / 2 + SPOKE_GAP;
  const radius = Math.max(byNeighbours, byHub);

  const positioned: PositionedNode[] = [
    { ...hub, x: -hub.width / 2, y: -hub.height / 2 },
    ...spokes.map((node, index) => {
      const angle = -Math.PI / 2 + (index * 2 * Math.PI) / spokes.length;
      return {
        ...node,
        x: radius * Math.cos(angle) - node.width / 2,
        y: radius * Math.sin(angle) - node.height / 2,
      };
    }),
  ];

  return normalize(positioned, routeAll(positioned, spec.edges));
}

function pickHub(nodes: MeasuredNode[], ctx: LayoutContext): MeasuredNode {
  const degree = new Map<string, number>(nodes.map((node) => [node.id, 0]));
  for (const edge of ctx.spec.edges) {
    degree.set(edge.source, (degree.get(edge.source) ?? 0) + 1);
    degree.set(edge.target, (degree.get(edge.target) ?? 0) + 1);
  }

  return nodes.reduce((best, node) => {
    const bestScore = score(best, degree);
    const nodeScore = score(node, degree);
    return nodeScore > bestScore ? node : best;
  }, nodes[0]);
}

function score(node: MeasuredNode, degree: Map<string, number>): number {
  return (degree.get(node.id) ?? 0) * 10 + (node.node.emphasis === "primary" ? 1 : 0);
}
