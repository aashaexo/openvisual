import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { applyThemeVariables, THEMES } from "@/themes";
import type { Appearance, DiagramTheme } from "@/themes";

/**
 * The chrome palettes are the one place in the app where a colour is chosen by
 * hand rather than derived, so they are checked as data.
 *
 * The bug these guard against is specific: a dark appearance that keeps a light
 * palette's near-black --ov-text, leaving the whole app unreadable. Contrast is
 * computed here rather than eyeballed because a palette can be edited without
 * anyone opening the app in that appearance.
 */

const APPEARANCES: Appearance[] = ["light", "dark"];
const THEME_VALUES: DiagramTheme[] = Object.values(THEMES);

/** Backgrounds text is actually painted on. */
const SURFACES = ["--ov-bg", "--ov-panel", "--ov-panel-alt"] as const;

function channels(hex: string): [number, number, number] {
  const match = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) throw new Error(`not a six-digit hex colour: ${hex}`);
  return [0, 2, 4].map((offset) => parseInt(match[1].slice(offset, offset + 2), 16)) as [
    number,
    number,
    number,
  ];
}

/** WCAG relative luminance. */
function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((value) => {
    const channel = value / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

/** Midpoint of the luminance range, used only to compare two colours' sides. */
const DARK_SIDE = 0.18;

describe("chrome palettes", () => {
  it.each(THEME_VALUES.flatMap((theme) => APPEARANCES.map((a) => ({ theme, appearance: a }))))(
    "reads $theme.id chrome in $appearance without text disappearing into its background",
    ({ theme, appearance }) => {
      const palette = theme.chrome[appearance];

      for (const surface of SURFACES) {
        const where = `${theme.id}/${appearance} --ov-text on ${surface}`;
        expect(contrast(palette["--ov-text"], palette[surface]), where).toBeGreaterThanOrEqual(4.5);

        // Dark-on-dark and light-on-light both fail this before they fail the
        // ratio, and this is the assertion that names the actual mistake.
        expect(luminance(palette["--ov-text"]) < DARK_SIDE, `${where} polarity`).not.toBe(
          luminance(palette[surface]) < DARK_SIDE,
        );
      }
    },
  );

  it.each(THEME_VALUES)("keeps $id's dark chrome legible in every role", (theme) => {
    const palette = theme.chrome.dark;

    for (const key of ["--ov-muted", "--ov-danger", "--ov-accent"] as const) {
      for (const surface of SURFACES) {
        expect(
          contrast(palette[key], palette[surface]),
          `${theme.id}/dark ${key} on ${surface}`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    }

    // A primary button paints its label in --ov-accent-contrast on --ov-accent.
    expect(
      contrast(palette["--ov-accent-contrast"], palette["--ov-accent"]),
      `${theme.id}/dark button label`,
    ).toBeGreaterThanOrEqual(4.5);
  });

  it("defines the same variables in every palette, so none can fall through", () => {
    const expected = Object.keys(THEMES.minimal.chrome.light).sort();
    expect(expected.length).toBeGreaterThan(0);

    for (const theme of THEME_VALUES) {
      for (const appearance of APPEARANCES) {
        expect(Object.keys(theme.chrome[appearance]).sort(), `${theme.id}/${appearance}`).toEqual(
          expected,
        );
      }
    }
  });
});

describe("applyThemeVariables", () => {
  it("writes the requested appearance rather than anything the theme implies", () => {
    const target = document.createElement("div");

    applyThemeVariables(THEMES.minimal, "dark", target);
    expect(target.style.getPropertyValue("--ov-text")).toBe(
      THEMES.minimal.chrome.dark["--ov-text"],
    );
    expect(target.dataset.themeMode).toBe("dark");
    expect(target.style.colorScheme).toBe("dark");

    // The dark diagram theme in a light app: appearance wins.
    applyThemeVariables(THEMES["dark-technical"], "light", target);
    expect(target.style.getPropertyValue("--ov-bg")).toBe(
      THEMES["dark-technical"].chrome.light["--ov-bg"],
    );
    expect(target.dataset.themeMode).toBe("light");
  });

  it("clears a variable the incoming palette omits instead of inheriting it", () => {
    const target = document.createElement("div");
    applyThemeVariables(THEMES.minimal, "dark", target);

    const partial: DiagramTheme = {
      ...THEMES.minimal,
      chrome: { light: { "--ov-bg": "#ffffff" }, dark: { "--ov-bg": "#000000" } },
    };
    applyThemeVariables(partial, "light", target);

    // Inheriting the dark --ov-text here is exactly how dark text ends up on a
    // light panel, so the stale value must be gone rather than left behind.
    expect(target.style.getPropertyValue("--ov-text")).toBe("");
    expect(target.style.getPropertyValue("--ov-bg")).toBe("#ffffff");
  });
});

describe("first-paint fallbacks in index.css", () => {
  /**
   * The stylesheet duplicates Minimal's two palettes so the first frame is not
   * unstyled. Duplication drifts, so it is compared rather than trusted.
   */
  function block(css: string, pattern: RegExp): Record<string, string> {
    const match = pattern.exec(css);
    if (!match) throw new Error(`no block matching ${pattern}`);
    return Object.fromEntries(
      [...match[1].matchAll(/(--ov-[a-z-]+):\s*(#[0-9a-f]{3,8});/gi)].map((entry) => [
        entry[1],
        entry[2],
      ]),
    );
  }

  it("matches THEMES.minimal in both appearances", () => {
    const css = readFileSync("src/index.css", "utf8");
    const root = block(css, /:root\s*\{([\s\S]*?)\}/);
    const dark = block(css, /@media \(prefers-color-scheme: dark\)\s*\{\s*:root\s*\{([\s\S]*?)\}/);

    for (const [key, value] of Object.entries(THEMES.minimal.chrome.light)) {
      expect(root[key], `:root ${key}`).toBe(value);
    }
    for (const [key, value] of Object.entries(THEMES.minimal.chrome.dark)) {
      expect(dark[key], `prefers-color-scheme: dark ${key}`).toBe(value);
    }
  });
});
