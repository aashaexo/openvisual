import type { IDBPDatabase } from "idb";
import type { DiagramSpec } from "@/diagrams/schema";
import type { OpenVisualDB } from "@/storage/db";
import { PROJECT_STORE, UPDATED_INDEX, getDb } from "@/storage/db";
import { DEFAULT_THEME_ID } from "@/themes";
import type { ProjectSummary, SavedProject, SavedSlide, SlideSummary } from "@/types";
import { toAppError } from "@/utils/errors";

/** Every project the app has ever saved, kept on this machine only. */

export const UNTITLED_PROJECT_NAME = "Untitled diagram";
export const UNTITLED_SLIDE_NAME = "Untitled slide";

export function createProjectId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Older WebViews and non-secure contexts have no randomUUID.
  const block = () => Math.random().toString(16).slice(2, 10).padEnd(8, "0");
  return `${Date.now().toString(16)}-${block()}-${block()}`;
}

export const createSlideId = createProjectId;

export async function saveProject(project: SavedProject): Promise<void> {
  const at = nowIso();
  const slides = project.slides.map(normaliseSlide);
  const record: SavedProject = {
    ...project,
    name: normaliseName(project.name, UNTITLED_PROJECT_NAME),
    slides,
    activeSlideId: resolveActiveSlideId(slides, project.activeSlideId),
    createdAt: isIsoLike(project.createdAt) ? project.createdAt : at,
    updatedAt: at,
  };
  await withDb((db) => db.put(PROJECT_STORE, record));
}

export async function getProject(id: string): Promise<SavedProject | null> {
  return migrateProject(await withDb((db) => db.get(PROJECT_STORE, id)));
}

export async function listProjects(search?: string): Promise<ProjectSummary[]> {
  const summaries = await withDb(async (db) => {
    const stored = await db.getAllFromIndex(PROJECT_STORE, UPDATED_INDEX);
    // The index reads oldest first; the library always shows recent work first.
    return stored.reverse().flatMap((raw) => {
      const project = migrateProject(raw);
      return project ? [toSummary(project)] : [];
    });
  });

  const query = search?.trim().toLowerCase();
  if (!query) return summaries;
  return summaries.filter((summary) => searchableText(summary).includes(query));
}

export async function deleteProject(id: string): Promise<void> {
  await withDb((db) => db.delete(PROJECT_STORE, id));
}

export async function renameProject(id: string, name: string): Promise<SavedProject | null> {
  return withDb(async (db) => {
    const existing = migrateProject(await db.get(PROJECT_STORE, id));
    if (!existing) return null;

    const renamed: SavedProject = {
      ...existing,
      name: normaliseName(name, UNTITLED_PROJECT_NAME),
      updatedAt: nowIso(),
    };
    await db.put(PROJECT_STORE, renamed);
    return renamed;
  });
}

export async function duplicateProject(id: string): Promise<SavedProject | null> {
  return withDb(async (db) => {
    const source = migrateProject(await db.get(PROJECT_STORE, id));
    if (!source) return null;

    const at = nowIso();
    const slides = source.slides.map(copySlide);
    // The copy opens on the same slide the original was left on.
    const activeIndex = source.slides.findIndex((slide) => slide.id === source.activeSlideId);
    const copy: SavedProject = {
      ...source,
      id: createProjectId(),
      name: `${normaliseName(source.name, UNTITLED_PROJECT_NAME)} (copy)`,
      slides,
      activeSlideId: slides[activeIndex]?.id ?? slides[0]?.id ?? null,
      createdAt: at,
      updatedAt: at,
    };
    await db.put(PROJECT_STORE, copy);
    return copy;
  });
}

export async function countProjects(): Promise<number> {
  return withDb((db) => db.count(PROJECT_STORE));
}

/**
 * The one door stored records come through. Version 1 wrote a single diagram
 * per project; that record becomes a one-slide deck here, on read, so upgrading
 * costs nothing until a project is actually opened. Anything that is not a
 * project at all returns null rather than throwing, because one corrupt row
 * must not take the whole library down with it.
 */
export function migrateProject(raw: unknown): SavedProject | null {
  if (!isRecord(raw)) return null;

  const name = normaliseName(readString(raw.name), UNTITLED_PROJECT_NAME);
  const slides = Array.isArray(raw.slides) ? readSlides(raw.slides) : readLegacySlides(raw, name);
  if (!slides) return null;

  const at = nowIso();
  return {
    id: readString(raw.id) ?? createProjectId(),
    name,
    slides,
    activeSlideId: resolveActiveSlideId(slides, readString(raw.activeSlideId) ?? null),
    theme: readString(raw.theme) ?? DEFAULT_THEME_ID,
    model: readString(raw.model) ?? "",
    createdAt: readTimestamp(raw.createdAt) ?? at,
    updatedAt: readTimestamp(raw.updatedAt) ?? at,
  };
}

async function withDb<T>(action: (db: IDBPDatabase<OpenVisualDB>) => Promise<T>): Promise<T> {
  const db = await getDb();
  try {
    return await action(db);
  } catch (error) {
    throw toAppError(error, "storage_unavailable");
  }
}

function readSlides(list: unknown[]): SavedSlide[] {
  const slides: SavedSlide[] = [];
  for (const entry of list) {
    const slide = readSlide(entry, UNTITLED_SLIDE_NAME);
    if (slide) slides.push(slide);
  }
  return slides;
}

function readSlide(raw: unknown, fallbackName: string): SavedSlide | null {
  if (!isRecord(raw)) return null;
  return {
    id: readString(raw.id) ?? createSlideId(),
    name: normaliseName(readString(raw.name), fallbackName),
    originalText: typeof raw.originalText === "string" ? raw.originalText : "",
    diagramSpec: readSpec(raw.diagramSpec),
    excalidrawElements: Array.isArray(raw.excalidrawElements) ? raw.excalidrawElements : [],
    appState: isRecord(raw.appState) ? raw.appState : {},
  };
}

/**
 * A version-1 project *is* a slide: its text, diagram and canvas move across
 * unchanged, and it takes the project's own name. Records carrying none of
 * those fields are not projects at all, which is what the null signals.
 */
function readLegacySlides(raw: Record<string, unknown>, name: string): SavedSlide[] | null {
  const looksLikeProject =
    "originalText" in raw || "diagramSpec" in raw || "excalidrawElements" in raw;
  if (!looksLikeProject) return null;

  // The slide gets a fresh id; the project keeps the id the record was saved under.
  const slide = readSlide({ ...raw, id: undefined, name }, name);
  return slide ? [slide] : null;
}

/**
 * Specs are validated by Zod before they are ever written, so re-parsing every
 * one on every read would cost far more than it protects. Files arriving from
 * outside are a different matter and go through validateDiagramSpec instead.
 */
function readSpec(value: unknown): DiagramSpec | null {
  return isRecord(value) ? (value as DiagramSpec) : null;
}

function normaliseSlide(slide: SavedSlide): SavedSlide {
  return { ...slide, name: normaliseName(slide.name, UNTITLED_SLIDE_NAME) };
}

/** A duplicate must share nothing with its original, not even by reference. */
function copySlide(slide: SavedSlide): SavedSlide {
  return {
    id: createSlideId(),
    name: slide.name,
    originalText: slide.originalText,
    diagramSpec: deepCopy(slide.diagramSpec),
    excalidrawElements: deepCopy(slide.excalidrawElements),
    appState: deepCopy(slide.appState),
  };
}

function deepCopy<T>(value: T): T {
  if (value === null || value === undefined) return value;
  // structuredClone is missing on older WebViews; stored data is plain JSON.
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

/** A deck always opens somewhere, and never on a slide that no longer exists. */
function resolveActiveSlideId(slides: SavedSlide[], requested: string | null): string | null {
  if (requested && slides.some((slide) => slide.id === requested)) return requested;
  return slides[0]?.id ?? null;
}

/**
 * Listing a hundred decks must not drag their canvases along, so each slide
 * keeps only what the library actually paints.
 */
function toSummary(project: SavedProject): ProjectSummary {
  return {
    id: project.id,
    name: project.name,
    slides: project.slides.map((slide): SlideSummary => ({
      id: slide.id,
      name: slide.name,
      originalText: slide.originalText,
      diagramSpec: slide.diagramSpec,
    })),
    activeSlideId: project.activeSlideId,
    theme: project.theme,
    model: project.model,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
}

function searchableText(summary: ProjectSummary): string {
  const slideText = summary.slides.flatMap((slide) => [
    slide.name,
    slide.originalText,
    slide.diagramSpec?.title ?? "",
  ]);
  return [summary.name, ...slideText].join("\n").toLowerCase();
}

function normaliseName(name: string | undefined, fallback: string): string {
  const trimmed = typeof name === "string" ? name.trim() : "";
  return trimmed.length > 0 ? trimmed : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readTimestamp(value: unknown): string | undefined {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) return undefined;
  return value;
}

function isIsoLike(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function nowIso(): string {
  return new Date().toISOString();
}
