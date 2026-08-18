/**
 * Central theme configuration.
 *
 * Themes are *purely visual*. Typography metrics live in
 * `src/diagrams/typography.ts` and are shared by every theme, so adding a new
 * theme can never change node sizes, layout or spacing.
 *
 * The model never picks colours — these tables are the only source of colour
 * in the rendered diagram.
 */

export type ThemeId = "minimal" | "editorial" | "dark-technical";

/** Excalidraw's own light/dark canvas mode. */
export type CanvasMode = "light" | "dark";

export type FillStyle = "hachure" | "cross-hatch" | "solid";
export type StrokeWidth = 1 | 2 | 4;
export type Roughness = 0 | 1 | 2;

/** Named font, mapped to Excalidraw's FONT_FAMILY at conversion time. */
export type ThemeFont = "Helvetica" | "Excalifont" | "Nunito" | "Cascadia" | "Liberation Sans";

export interface NodePalette {
  background: string;
  stroke: string;
  text: string;
}

/**
 * How many accents every theme must offer.
 *
 * Fixed rather than per-theme so the accent a node gets depends only on the
 * spec, and switching theme repaints a diagram without reshuffling it.
 */
export const ACCENT_COUNT = 6;

export interface DiagramTheme {
  id: ThemeId;
  name: string;
  description: string;
  /** Drives Excalidraw's own UI theme and the app chrome. */
  mode: CanvasMode;
  canvas: {
    background: string;
    /** Transparent-background exports still use this for PNG-with-background. */
    exportBackground: string;
    gridSize: number | null;
  };
  node: {
    primary: NodePalette;
    secondary: NodePalette;
    neutral: NodePalette;
    /**
     * One palette per box, exactly ACCENT_COUNT long. The app picks the index
     * from the spec's structure; the model has no say in it.
     */
    accents: NodePalette[];
    fillStyle: FillStyle;
    strokeWidth: StrokeWidth;
    roughness: Roughness;
    /** Rounded shapes use Excalidraw's adaptive radius when true. */
    rounded: boolean;
    font: ThemeFont;
  };
  edge: {
    stroke: string;
    strokeWidth: StrokeWidth;
    roughness: Roughness;
    labelColor: string;
    font: ThemeFont;
  };
  title: {
    color: string;
    subtitleColor: string;
    font: ThemeFont;
  };
  /** Applied to the app chrome as CSS custom properties. */
  ui: Record<string, string>;
}

const minimal: DiagramTheme = {
  id: "minimal",
  name: "Minimal",
  description: "White canvas, hand-drawn type, thin grey connectors, one accent.",
  mode: "light",
  canvas: { background: "#ffffff", exportBackground: "#ffffff", gridSize: null },
  node: {
    primary: { background: "#eef2ff", stroke: "#1f2937", text: "#111827" },
    secondary: { background: "#f5f5f5", stroke: "#4b5563", text: "#1f2937" },
    neutral: { background: "transparent", stroke: "#9ca3af", text: "#374151" },
    accents: [
      { background: "#eef4ff", stroke: "#2f5fd0", text: "#14203a" },
      { background: "#fef1f0", stroke: "#c9453c", text: "#3a1613" },
      { background: "#edf7f0", stroke: "#2f7d4f", text: "#12291b" },
      { background: "#fdf4e3", stroke: "#9a6a10", text: "#33260c" },
      { background: "#f3f0fd", stroke: "#6d4bc4", text: "#241a3d" },
      { background: "#eaf6f6", stroke: "#1f7a7a", text: "#102b2b" },
    ],
    fillStyle: "solid",
    strokeWidth: 1,
    roughness: 0,
    rounded: true,
    font: "Excalifont",
  },
  edge: {
    stroke: "#9ca3af",
    strokeWidth: 1,
    roughness: 0,
    labelColor: "#6b7280",
    font: "Excalifont",
  },
  title: { color: "#111827", subtitleColor: "#6b7280", font: "Excalifont" },
  ui: {
    "--ov-bg": "#f7f7f8",
    "--ov-panel": "#ffffff",
    "--ov-panel-alt": "#fafafa",
    "--ov-border": "#e5e7eb",
    "--ov-text": "#111827",
    "--ov-muted": "#6b7280",
    "--ov-accent": "#4f46e5",
    "--ov-accent-contrast": "#ffffff",
    "--ov-danger": "#b91c1c",
    "--ov-focus": "#4f46e5",
  },
};

const editorial: DiagramTheme = {
  id: "editorial",
  name: "Editorial",
  description: "Warm paper, charcoal type, muted orange accent, hand-drawn shapes.",
  mode: "light",
  canvas: { background: "#fbf7f0", exportBackground: "#fbf7f0", gridSize: null },
  node: {
    primary: { background: "#f6dfc4", stroke: "#7c3a10", text: "#2b2621" },
    secondary: { background: "#f1ece2", stroke: "#5c554a", text: "#2b2621" },
    neutral: { background: "transparent", stroke: "#8a8175", text: "#3d372f" },
    accents: [
      { background: "#f7e3d3", stroke: "#a8542a", text: "#3a2317" },
      { background: "#e3e8f0", stroke: "#34527d", text: "#1c2536" },
      { background: "#e8ebd9", stroke: "#5f7038", text: "#252c15" },
      { background: "#f6e9c9", stroke: "#8f6a17", text: "#342a12" },
      { background: "#eee0e6", stroke: "#7d4560", text: "#301d26" },
      { background: "#e6e4de", stroke: "#5a615a", text: "#1f2724" },
    ],
    fillStyle: "hachure",
    strokeWidth: 2,
    roughness: 1,
    rounded: true,
    font: "Excalifont",
  },
  edge: {
    stroke: "#7a6f61",
    strokeWidth: 2,
    roughness: 1,
    labelColor: "#7c3a10",
    font: "Excalifont",
  },
  title: { color: "#2b2621", subtitleColor: "#7a6f61", font: "Excalifont" },
  ui: {
    "--ov-bg": "#f3ece1",
    "--ov-panel": "#fbf7f0",
    "--ov-panel-alt": "#f6f0e6",
    "--ov-border": "#e0d5c4",
    "--ov-text": "#2b2621",
    "--ov-muted": "#7a6f61",
    "--ov-accent": "#c2661f",
    "--ov-accent-contrast": "#fffaf3",
    "--ov-danger": "#a3311b",
    "--ov-focus": "#c2661f",
  },
};

const darkTechnical: DiagramTheme = {
  id: "dark-technical",
  name: "Dark technical",
  description: "Near-black canvas, light type, blue-violet accents, subtle grid.",
  mode: "dark",
  canvas: { background: "#0e1116", exportBackground: "#0e1116", gridSize: 20 },
  node: {
    primary: { background: "#1e293b", stroke: "#818cf8", text: "#e5e7eb" },
    secondary: { background: "#161b22", stroke: "#38bdf8", text: "#dbe3ea" },
    neutral: { background: "transparent", stroke: "#64748b", text: "#cbd5e1" },
    accents: [
      { background: "#1b1f3a", stroke: "#818cf8", text: "#dfe3ff" },
      { background: "#331a26", stroke: "#fb7185", text: "#ffe1e8" },
      { background: "#0f2a20", stroke: "#34d399", text: "#d5f5e6" },
      { background: "#2e2312", stroke: "#fbbf24", text: "#fbeed6" },
      { background: "#10222f", stroke: "#38bdf8", text: "#d8eefc" },
      { background: "#2a1631", stroke: "#e879f9", text: "#f9e3fd" },
    ],
    fillStyle: "solid",
    strokeWidth: 2,
    roughness: 0,
    rounded: true,
    font: "Cascadia",
  },
  edge: {
    stroke: "#7dd3fc",
    strokeWidth: 2,
    roughness: 0,
    labelColor: "#a5b4fc",
    font: "Cascadia",
  },
  title: { color: "#f3f4f6", subtitleColor: "#94a3b8", font: "Cascadia" },
  ui: {
    "--ov-bg": "#0b0e12",
    "--ov-panel": "#12161c",
    "--ov-panel-alt": "#171d25",
    "--ov-border": "#252d38",
    "--ov-text": "#e6e9ee",
    "--ov-muted": "#94a3b8",
    "--ov-accent": "#818cf8",
    "--ov-accent-contrast": "#0b0e12",
    "--ov-danger": "#f87171",
    "--ov-focus": "#a5b4fc",
  },
};

export const THEMES: Record<ThemeId, DiagramTheme> = {
  minimal,
  editorial,
  "dark-technical": darkTechnical,
};

export const THEME_LIST: DiagramTheme[] = [minimal, editorial, darkTechnical];

export const DEFAULT_THEME_ID: ThemeId = "minimal";

export function getTheme(id: string | undefined): DiagramTheme {
  if (id && id in THEMES) return THEMES[id as ThemeId];
  return THEMES[DEFAULT_THEME_ID];
}

/** Writes the theme's chrome variables onto an element (normally <html>). */
export function applyThemeVariables(theme: DiagramTheme, target: HTMLElement): void {
  for (const [key, value] of Object.entries(theme.ui)) {
    target.style.setProperty(key, value);
  }
  target.dataset.themeMode = theme.mode;
  target.style.colorScheme = theme.mode;
}
