import type { DiagramSpec } from "@/diagrams/schema";
import { formatIssues, summariseIssues, validateDiagramSpec } from "@/diagrams/validate";
import { UNTITLED_PROJECT_NAME, createProjectId } from "@/storage/projects";
import { DEFAULT_THEME_ID } from "@/themes";
import type { AppError, AppErrorCode, SavedProject } from "@/types";
import { createAppError } from "@/utils/errors";

/**
 * Files on disk are untrusted input, exactly like model output: nothing here
 * assumes a field exists, and a diagram is only accepted once Zod agrees.
 */

export const BACKUP_KIND = "openvisual.project";
export const BACKUP_VERSION = 1;

export function serializeProjectBackup(project: SavedProject): string {
  return JSON.stringify({ kind: BACKUP_KIND, version: BACKUP_VERSION, project }, null, 2);
}

export function parseProjectBackup(json: unknown): SavedProject {
  const root = asRecord(coerceJson(json), "This file is not an OpenVisual project backup.");
  const record = isBackupEnvelope(root)
    ? asRecord(root.project, "This backup does not contain a project.")
    : root;

  const validation = validateDiagramSpec(record.diagramSpec);
  if (!validation.ok) {
    throw importError(
      "invalid_model_output",
      `The diagram in this backup is not valid: ${summariseIssues(validation.issues)}`,
      formatIssues(validation.issues),
    );
  }

  const at = nowIso();
  return {
    id: readString(record.id) ?? createProjectId(),
    name: readString(record.name) ?? UNTITLED_PROJECT_NAME,
    originalText: readString(record.originalText) ?? "",
    diagramSpec: validation.spec,
    excalidrawElements: Array.isArray(record.excalidrawElements) ? record.excalidrawElements : [],
    appState: isRecord(record.appState) ? record.appState : {},
    theme: readString(record.theme) ?? DEFAULT_THEME_ID,
    model: readString(record.model) ?? "",
    createdAt: readTimestamp(record.createdAt) ?? at,
    updatedAt: readTimestamp(record.updatedAt) ?? at,
  };
}

export function importDiagramJson(json: unknown): DiagramSpec {
  const validation = validateDiagramSpec(coerceJson(json));
  if (!validation.ok) {
    throw importError(
      "invalid_model_output",
      `This is not a valid diagram file: ${summariseIssues(validation.issues)}`,
      formatIssues(validation.issues),
    );
  }
  return validation.spec;
}

export function importExcalidrawScene(json: unknown): { elements: unknown[]; appState: unknown } {
  const scene = asRecord(coerceJson(json), "This file is not an Excalidraw scene.");

  if (scene.type !== "excalidraw") {
    throw importError(
      "unknown",
      "This file is not an Excalidraw scene. Expected a .excalidraw file exported from Excalidraw.",
      `type: ${JSON.stringify(scene.type)}`,
    );
  }
  if (!Array.isArray(scene.elements)) {
    throw importError("unknown", "This Excalidraw scene has no elements in it.");
  }

  return { elements: scene.elements, appState: isRecord(scene.appState) ? scene.appState : {} };
}

/**
 * File problems deserve their own copy; retrying the same bytes never helps,
 * and the generic hints talk about the model, which had no part in this.
 */
function importError(code: AppErrorCode, message: string, detail?: unknown): AppError {
  return {
    ...createAppError(code, detail),
    title: "That file could not be imported",
    message,
    hint: "OpenVisual opens project backups, diagram JSON and .excalidraw scenes.",
    retryable: false,
  };
}

/** Callers may hand over raw file text or an already-parsed value. */
function coerceJson(input: unknown): unknown {
  if (typeof input !== "string") return input;
  try {
    return JSON.parse(input);
  } catch (error) {
    throw importError("unknown", "This file is not valid JSON.", error);
  }
}

function isBackupEnvelope(value: Record<string, unknown>): boolean {
  return value.kind === BACKUP_KIND || "project" in value;
}

function asRecord(value: unknown, message: string): Record<string, unknown> {
  if (!isRecord(value)) throw importError("unknown", message, typeof value);
  return value;
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

function nowIso(): string {
  return new Date().toISOString();
}
