import type { IDBPDatabase } from "idb";
import type { OpenVisualDB } from "@/storage/db";
import { PROJECT_STORE, UPDATED_INDEX, getDb } from "@/storage/db";
import type { ProjectSummary, SavedProject } from "@/types";
import { toAppError } from "@/utils/errors";

/** Every project the app has ever saved, kept on this machine only. */

export const UNTITLED_PROJECT_NAME = "Untitled diagram";

export function createProjectId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Older WebViews and non-secure contexts have no randomUUID.
  const block = () => Math.random().toString(16).slice(2, 10).padEnd(8, "0");
  return `${Date.now().toString(16)}-${block()}-${block()}`;
}

export async function saveProject(project: SavedProject): Promise<void> {
  const at = nowIso();
  const record: SavedProject = {
    ...project,
    name: normaliseName(project.name),
    createdAt: isIsoLike(project.createdAt) ? project.createdAt : at,
    updatedAt: at,
  };
  await withDb((db) => db.put(PROJECT_STORE, record));
}

export async function getProject(id: string): Promise<SavedProject | null> {
  const project = await withDb((db) => db.get(PROJECT_STORE, id));
  return project ?? null;
}

export async function listProjects(search?: string): Promise<ProjectSummary[]> {
  const summaries = await withDb(async (db) => {
    const stored = await db.getAllFromIndex(PROJECT_STORE, UPDATED_INDEX);
    // The index reads oldest first; the library always shows recent work first.
    return stored.reverse().map(toSummary);
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
    const existing = await db.get(PROJECT_STORE, id);
    if (!existing) return null;

    const renamed: SavedProject = { ...existing, name: normaliseName(name), updatedAt: nowIso() };
    await db.put(PROJECT_STORE, renamed);
    return renamed;
  });
}

export async function duplicateProject(id: string): Promise<SavedProject | null> {
  return withDb(async (db) => {
    const source = await db.get(PROJECT_STORE, id);
    if (!source) return null;

    const at = nowIso();
    const copy: SavedProject = {
      ...source,
      id: createProjectId(),
      name: `${normaliseName(source.name)} (copy)`,
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

async function withDb<T>(action: (db: IDBPDatabase<OpenVisualDB>) => Promise<T>): Promise<T> {
  const db = await getDb();
  try {
    return await action(db);
  } catch (error) {
    throw toAppError(error, "storage_unavailable");
  }
}

/**
 * Listing a hundred projects must not drag their canvases along, so the two
 * heavy fields are dropped by naming the light ones explicitly.
 */
function toSummary(project: SavedProject): ProjectSummary {
  return {
    id: project.id,
    name: project.name,
    originalText: project.originalText,
    diagramSpec: project.diagramSpec,
    theme: project.theme,
    model: project.model,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
}

function searchableText(summary: ProjectSummary): string {
  return [summary.name, summary.originalText, summary.diagramSpec?.title ?? ""]
    .join("\n")
    .toLowerCase();
}

function normaliseName(name: string | undefined): string {
  const trimmed = typeof name === "string" ? name.trim() : "";
  return trimmed.length > 0 ? trimmed : UNTITLED_PROJECT_NAME;
}

function isIsoLike(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function nowIso(): string {
  return new Date().toISOString();
}
