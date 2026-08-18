import type { DiagramEdge, DiagramNode, DiagramSpec } from "@/diagrams/schema";

export interface Point {
  x: number;
  y: number;
}

export interface MeasuredNode {
  id: string;
  node: DiagramNode;
  width: number;
  height: number;
  labelLines: string[];
  descriptionLines: string[];
  /** Already bullet-prefixed and wrapped; ready to render as-is. */
  itemLines: string[];
}

export interface PositionedNode extends MeasuredNode {
  x: number;
  y: number;
}

export interface RoutedEdge {
  id: string;
  edge: DiagramEdge;
  /** Absolute scene coordinates, first point at the source, last at the target. */
  points: Point[];
}

/** Non-semantic scaffolding drawn by a layout (axes, column rules, captions). */
export type LayoutDecoration =
  | { kind: "line"; id: string; points: Point[]; dashed?: boolean }
  | {
      kind: "caption";
      id: string;
      x: number;
      y: number;
      width: number;
      text: string;
      align: "left" | "center";
      role: "column" | "tick";
    };

export interface DiagramLayout {
  nodes: PositionedNode[];
  edges: RoutedEdge[];
  decorations: LayoutDecoration[];
  width: number;
  height: number;
}

export interface LayoutContext {
  spec: DiagramSpec;
  nodes: MeasuredNode[];
  signal?: AbortSignal;
}

export type LayoutFn = (ctx: LayoutContext) => Promise<DiagramLayout> | DiagramLayout;

export const SPACING = {
  /** Gap between adjacent nodes along the reading direction. */
  along: 90,
  /** Gap between parallel rows/columns. */
  across: 64,
  /** Padding around the whole diagram. */
  padding: 40,
} as const;
