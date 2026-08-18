/**
 * Shared, theme-independent text metrics.
 *
 * Layout runs in plain JS (including in tests, with no DOM and no canvas), so
 * text is measured with a deliberately generous character-width ratio. Boxes
 * therefore come out slightly wider than the glyphs need, which is exactly the
 * error we want: text always fits, and nodes never overlap.
 */

export const TYPOGRAPHY = {
  label: { fontSize: 20, lineHeight: 25 },
  description: { fontSize: 14, lineHeight: 18 },
  item: { fontSize: 14, lineHeight: 19 },
  edgeLabel: { fontSize: 14, lineHeight: 18 },
  title: { fontSize: 28, lineHeight: 35 },
  subtitle: { fontSize: 16, lineHeight: 20 },
  /** Wider than any bundled font actually needs — see note above. */
  charWidthRatio: 0.62,
} as const;

export const NODE_BOX = {
  minWidth: 150,
  maxWidth: 260,
  minHeight: 64,
  paddingX: 18,
  paddingY: 14,
  /** Gap between the label block and the description block. */
  gap: 8,
  /** Gap between the label/description block and the item list. */
  itemGap: 8,
  /** Prefix rendered before each item. */
  bullet: "• ",
} as const;

/**
 * Fraction of a node's width that text may occupy.
 *
 * A circle and a diamond only offer their inscribed rectangle, so text has to
 * be kept well inside their bounding box.
 */
export const TEXT_WIDTH_RATIO = {
  rectangle: 0.88,
  rounded: 0.88,
  circle: 0.68,
  diamond: 0.6,
} as const;

export function measureText(text: string, fontSize: number): number {
  return text.length * fontSize * TYPOGRAPHY.charWidthRatio;
}

/**
 * Greedy word wrap against a pixel budget. Words longer than the budget get
 * their own line rather than being broken, which keeps ids and long terms
 * readable.
 */
export function wrapText(text: string, maxWidth: number, fontSize: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];

  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (measureText(candidate, fontSize) <= maxWidth || !current) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export function widestLine(lines: string[], fontSize: number): number {
  return lines.reduce((max, line) => Math.max(max, measureText(line, fontSize)), 0);
}
