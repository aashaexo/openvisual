import { DIAGRAM_TYPES } from "@/diagrams/schema";
import { THEMES } from "@/themes";
import type { Appearance, ThemeId } from "@/themes";
import type { DetailLevel, RequestedDiagramType } from "@/types";
import { log } from "@/utils/logger";

/**
 * Small, synchronous settings kept in localStorage. Blocked storage is a
 * normal condition here, not an error: the app falls back to memory and the
 * user simply loses their choices when the window closes.
 */

/** "system" is a standing deferral to the OS, not a third palette. */
export type AppearancePreference = Appearance | "system";

export interface Preferences {
  model: string;
  theme: ThemeId;
  appearance: AppearancePreference;
  detail: DetailLevel;
  diagramType: RequestedDiagramType;
  onboardingComplete: boolean;
  exportScale: 1 | 2 | 3;
  transparentBackground: boolean;
  imageAssets: boolean;
}

export const PREFERENCES_KEY = "openvisual.preferences";

export const DEFAULT_PREFERENCES: Preferences = {
  model: "qwen3:4b",
  theme: "minimal",
  appearance: "system",
  detail: "balanced",
  diagramType: "auto",
  onboardingComplete: false,
  exportScale: 2,
  transparentBackground: false,
  imageAssets: false,
};

const DETAIL_LEVELS: readonly string[] = ["simple", "balanced", "detailed"];
const REQUESTED_DIAGRAM_TYPES: readonly string[] = ["auto", ...DIAGRAM_TYPES];

let memory: Preferences = { ...DEFAULT_PREFERENCES };

export function loadPreferences(): Preferences {
  const raw = readRaw();
  if (raw === null) return { ...memory };

  try {
    memory = merge(DEFAULT_PREFERENCES, JSON.parse(raw) as unknown);
  } catch (error) {
    log.warn("preferences", "Stored preferences were unreadable; falling back to defaults", error);
    memory = { ...DEFAULT_PREFERENCES };
  }
  return { ...memory };
}

export function savePreferences(patch: Partial<Preferences>): Preferences {
  memory = merge(loadPreferences(), patch);
  writeRaw(JSON.stringify(memory));
  return { ...memory };
}

/** Unknown keys and wrong types are dropped rather than trusted. */
function merge(base: Preferences, patch: unknown): Preferences {
  if (typeof patch !== "object" || patch === null) return { ...base };
  const source = patch as Record<string, unknown>;

  return {
    model: isModelName(source.model) ? source.model.trim() : base.model,
    theme: isThemeId(source.theme) ? source.theme : base.theme,
    appearance: isAppearance(source.appearance) ? source.appearance : base.appearance,
    detail: isDetailLevel(source.detail) ? source.detail : base.detail,
    diagramType: isDiagramType(source.diagramType) ? source.diagramType : base.diagramType,
    onboardingComplete:
      typeof source.onboardingComplete === "boolean"
        ? source.onboardingComplete
        : base.onboardingComplete,
    imageAssets:
      typeof source.imageAssets === "boolean" ? source.imageAssets : base.imageAssets,
    exportScale: isExportScale(source.exportScale) ? source.exportScale : base.exportScale,
    transparentBackground:
      typeof source.transparentBackground === "boolean"
        ? source.transparentBackground
        : base.transparentBackground,
  };
}

function isModelName(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && value in THEMES;
}

function isAppearance(value: unknown): value is AppearancePreference {
  return value === "system" || value === "light" || value === "dark";
}

function isDetailLevel(value: unknown): value is DetailLevel {
  return typeof value === "string" && DETAIL_LEVELS.includes(value);
}

function isDiagramType(value: unknown): value is RequestedDiagramType {
  return typeof value === "string" && REQUESTED_DIAGRAM_TYPES.includes(value);
}

function isExportScale(value: unknown): value is 1 | 2 | 3 {
  return value === 1 || value === 2 || value === 3;
}

function readRaw(): string | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage.getItem(PREFERENCES_KEY);
  } catch (error) {
    log.warn("preferences", "localStorage is unavailable; preferences stay in memory", error);
    return null;
  }
}

function writeRaw(value: string): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(PREFERENCES_KEY, value);
  } catch (error) {
    log.warn("preferences", "Preferences could not be written; they stay in memory", error);
  }
}
