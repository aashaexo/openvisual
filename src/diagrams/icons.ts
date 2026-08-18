/**
 * The bundled icon set.
 *
 * Glyphs live here as inline path data rather than as asset files so a rendered
 * diagram never reaches for the network: the markup, its colour and its data
 * URI are all produced in-process at render time.
 *
 * An icon name is *semantics* — "this node is a warning", "this node is a data
 * store". The colour, size and placement are chosen by the theme and the layout
 * engine, exactly like every other visual decision in the app.
 */

export const DIAGRAM_ICONS = [
  "alert",
  "check",
  "cross",
  "question",
  "idea",
  "brain",
  "robot",
  "user",
  "users",
  "document",
  "folder",
  "database",
  "server",
  "cloud",
  "code",
  "terminal",
  "search",
  "chart",
  "clock",
  "calendar",
  "mail",
  "message",
  "lock",
  "gear",
] as const;

export type DiagramIcon = (typeof DIAGRAM_ICONS)[number];

/**
 * The body of each 24x24 glyph.
 *
 * Coordinates sit slightly off the pixel grid on purpose: a perfectly
 * orthogonal glyph reads as clip-art next to Excalidraw's hand-drawn strokes.
 */
const ICON_BODIES: Record<DiagramIcon, string> = {
  alert: '<path d="M12.2 4.4 21 19.2H3.2Z"/><path d="M12.1 9.6V14"/><path d="M12.05 16.9h.01"/>',
  check: '<path d="M4.2 12.6 9.4 17.8 19.9 6.5"/>',
  cross: '<path d="M5.6 5.4 18.5 18.6"/><path d="M18.6 5.5 5.5 18.5"/>',
  question:
    '<circle cx="12" cy="12" r="8.6"/><path d="M9.6 9.4a2.5 2.5 0 0 1 4.8.8c0 1.7-2.4 2-2.4 3.6"/><path d="M12 17.4h.01"/>',
  idea: '<path d="M12 3.3a5.7 5.7 0 0 0-3.3 10.3c.6.5.9 1.1.9 1.8v.9h4.8v-.9c0-.7.3-1.3.9-1.8A5.7 5.7 0 0 0 12 3.3"/><path d="M9.9 18.3h4.2"/><path d="M10.9 20.5h2.2"/>',
  brain:
    '<path d="M12 5.4a3 3 0 0 0-5.6 1.3 3 3 0 0 0-1.6 5.1 3.1 3.1 0 0 0 1.9 5.1 3 3 0 0 0 5.3 1.6Z"/><path d="M12 5.4a3 3 0 0 1 5.6 1.3 3 3 0 0 1 1.6 5.1 3.1 3.1 0 0 1-1.9 5.1 3 3 0 0 1-5.3 1.6Z"/>',
  robot:
    '<rect x="4.2" y="8.1" width="15.6" height="11.4" rx="2.6"/><circle cx="12" cy="3.5" r="1.1"/><path d="M12 4.6v3.5"/><path d="M9 12.6h.01"/><path d="M15 12.6h.01"/><path d="M9.4 16.2h5.2"/><path d="M2.4 12.4V15"/><path d="M21.6 12.4V15"/>',
  user: '<circle cx="12" cy="8.4" r="3.9"/><path d="M4.6 20.2c1.1-3.7 4-5.6 7.4-5.6s6.3 1.9 7.4 5.6"/>',
  users:
    '<circle cx="9.4" cy="8.6" r="3.5"/><path d="M2.9 19.8c1-3.3 3.5-5 6.5-5s5.5 1.7 6.5 5"/><path d="M16.4 5.5a3.5 3.5 0 0 1 .3 6.9"/><path d="M18.1 15.3c1.6.7 2.7 2.2 3.2 4.3"/>',
  document:
    '<path d="M6.2 3.4h7.3l4.6 4.7v12.4H6.2Z"/><path d="M13.4 3.5v4.6h4.6"/><path d="M8.8 13.1h6.4"/><path d="M8.8 16.6h6.4"/>',
  folder:
    '<path d="M3.3 6.8c0-.9.7-1.6 1.6-1.6h4.2l2.1 2.6h7.9c.9 0 1.6.7 1.6 1.6v9c0 .9-.7 1.6-1.6 1.6H4.9c-.9 0-1.6-.7-1.6-1.6Z"/>',
  database:
    '<ellipse cx="12" cy="6.1" rx="7.4" ry="2.9"/><path d="M4.6 6.1v11.8c0 1.6 3.3 2.9 7.4 2.9s7.4-1.3 7.4-2.9V6.1"/><path d="M4.6 12c0 1.6 3.3 2.9 7.4 2.9s7.4-1.3 7.4-2.9"/>',
  server:
    '<rect x="3.2" y="4.3" width="17.6" height="6.2" rx="1.6"/><rect x="3.2" y="13.5" width="17.6" height="6.2" rx="1.6"/><path d="M6.8 7.4h.01"/><path d="M6.8 16.6h.01"/><path d="M10.2 7.4h3.6"/><path d="M10.2 16.6h3.6"/>',
  cloud: '<path d="M7.3 19.2a4.8 4.8 0 0 1 .4-9.2 5.9 5.9 0 0 1 11.1 1.6 3.9 3.9 0 0 1-.6 7.6Z"/>',
  code: '<path d="M8.6 8.2 4.2 12.4l4.4 4.2"/><path d="M15.4 8.2l4.4 4.2-4.4 4.2"/><path d="M13.4 5.6 10.7 19"/>',
  terminal:
    '<rect x="3.2" y="4.6" width="17.6" height="14.8" rx="2.2"/><path d="M7.4 10.2 10.3 13l-2.9 2.8"/><path d="M12.8 15.9h4.2"/>',
  search: '<circle cx="10.7" cy="10.6" r="6.4"/><path d="M15.4 15.4 20.4 20.3"/>',
  chart:
    '<path d="M4.2 19.6h15.9"/><path d="M7.4 19.4v-5.6"/><path d="M12 19.4V7.9"/><path d="M16.6 19.4v-8.6"/>',
  clock: '<circle cx="12" cy="12" r="8.6"/><path d="M12 6.9V12l3.6 2.2"/>',
  calendar:
    '<rect x="3.6" y="5.6" width="16.8" height="14.6" rx="2.2"/><path d="M3.7 10.2h16.6"/><path d="M8.3 3.4v3.6"/><path d="M15.7 3.4v3.6"/><path d="M8.2 14.2h.01"/><path d="M12 14.2h.01"/>',
  mail: '<rect x="2.8" y="5.2" width="18.4" height="13.6" rx="2.2"/><path d="M3.4 7 12 13.2 20.6 7"/>',
  message:
    '<path d="M3.4 17.4V6.3a2.4 2.4 0 0 1 2.4-2.4h12.4a2.4 2.4 0 0 1 2.4 2.4V15a2.4 2.4 0 0 1-2.4 2.4H8.1l-4.7 3.5Z"/>',
  lock: '<rect x="4.4" y="10.3" width="15.2" height="10.1" rx="2.2"/><path d="M8.1 10.2V7.9a3.9 3.9 0 0 1 7.8 0v2.3"/><path d="M12 14.2v2.4"/>',
  gear: '<circle cx="12" cy="12" r="7.4"/><circle cx="12" cy="12" r="3.2"/><path d="M12 2.6v2.9"/><path d="M12 18.5v2.9"/><path d="M2.6 12h2.9"/><path d="M18.5 12h2.9"/><path d="M5.4 5.4 7.4 7.5"/><path d="M16.6 16.5l2 2.1"/><path d="M18.6 5.4 16.6 7.5"/><path d="M7.4 16.5l-2 2.1"/>',
};

/**
 * Colours reach this module from the theme and never from the model, but they
 * are still interpolated into markup — so anything that is not a plain hex
 * triplet or a bare CSS colour keyword is refused outright rather than escaped.
 * Refusing keeps the guarantee simple: no quote, angle bracket or URL can ever
 * reach the generated SVG.
 */
const SAFE_COLOR = /^(?:#[0-9a-f]{3,8}|[a-z]+)$/i;

const FALLBACK_COLOR = "#000000";

const STROKE_WIDTH = 1.8;

export function iconSvg(icon: DiagramIcon, color: string): string {
  const trimmed = color.trim();
  const stroke = SAFE_COLOR.test(trimmed) ? trimmed : FALLBACK_COLOR;

  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"',
    ` stroke="${stroke}" stroke-width="${STROKE_WIDTH}"`,
    ' stroke-linecap="round" stroke-linejoin="round">',
    ICON_BODIES[icon],
    "</svg>",
  ].join("");
}

/**
 * Percent-encoded rather than base64: the payload stays human-readable in saved
 * scenes and diffs, and it sidesteps `btoa`'s refusal to handle non-Latin-1
 * input entirely.
 */
export function iconDataUrl(icon: DiagramIcon, color: string): string {
  return `data:image/svg+xml,${encodeURIComponent(iconSvg(icon, color))}`;
}
