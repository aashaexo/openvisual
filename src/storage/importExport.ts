import type { DiagramSpec } from "@/diagrams/schema";
import { formatIssues, summariseIssues, validateDiagramSpec } from "@/diagrams/validate";
import { migrateProject } from "@/storage/projects";
import type { AppError, AppErrorCode, SavedProject, SavedSlide } from "@/types";
import { createAppError } from "@/utils/errors";

/**
 * Files on disk are untrusted input, exactly like model output: nothing here
 * assumes a field exists, and a diagram is only accepted once Zod agrees.
 */

export const BACKUP_KIND = "openvisual.project";
/** 2 writes a deck of slides. Version-1 backups still import, via migrateProject. */
export const BACKUP_VERSION = 2;

export function serializeProjectBackup(project: SavedProject): string {
  return JSON.stringify({ kind: BACKUP_KIND, version: BACKUP_VERSION, project }, null, 2);
}

export function parseProjectBackup(json: unknown): SavedProject {
  const root = asRecord(coerceJson(json), "This file is not an OpenVisual project backup.");
  const record = isBackupEnvelope(root)
    ? asRecord(root.project, "This backup does not contain a project.")
    : root;

  // Shapes both versions into a deck; the diagrams inside are still unchecked.
  const project = migrateProject(record);
  if (!project) {
    throw importError(
      "unknown",
      "This file does not contain an OpenVisual project.",
      Object.keys(record).join(", "),
    );
  }

  return { ...project, slides: project.slides.map(validateSlide) };
}

/** An ungenerated slide has nothing to check; every real diagram faces Zod. */
function validateSlide(slide: SavedSlide, index: number): SavedSlide {
  if (slide.diagramSpec === null) return slide;

  const validation = validateDiagramSpec(slide.diagramSpec);
  if (!validation.ok) {
    throw importError(
      "invalid_model_output",
      `The diagram on slide ${index + 1} ("${slide.name}") is not valid: ` +
        summariseIssues(validation.issues),
      formatIssues(validation.issues),
    );
  }
  return { ...slide, diagramSpec: validation.spec };
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
