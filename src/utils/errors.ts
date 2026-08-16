import type { AppError, AppErrorCode } from "@/types";
import { log } from "@/utils/logger";

/**
 * Every failure the user can see is built here, so the interface never shows a
 * raw error or a stack trace. Technical detail is logged locally and carried on
 * the error object for the collapsible "technical details" panel.
 */

const COPY: Record<AppErrorCode, Omit<AppError, "code" | "detail">> = {
  ollama_unreachable: {
    title: "Ollama is not running",
    message: "OpenVisual could not reach the local Ollama server on 127.0.0.1:11434.",
    hint: "Start it with `ollama serve`, then try again.",
    retryable: true,
  },
  no_models_installed: {
    title: "No local models installed",
    message: "Ollama is running but has no models available.",
    hint: "Install the recommended model with `ollama pull qwen3:4b`.",
    retryable: true,
  },
  model_missing: {
    title: "That model is no longer installed",
    message: "The selected model was not found in your local Ollama library.",
    hint: "Pick another installed model, or pull it again with `ollama pull`.",
    retryable: true,
  },
  timeout: {
    title: "The model took too long",
    message: "The local model did not finish in time.",
    hint: "Try a shorter input, a smaller model, or raise the time limit.",
    retryable: true,
  },
  cancelled: {
    title: "Generation stopped",
    message: "The request was cancelled.",
    retryable: true,
  },
  invalid_model_output: {
    title: "The model returned an unusable diagram",
    message: "The response did not match the diagram format, and the repair attempt also failed.",
    hint: "Try again, or switch to a larger model for more reliable structure.",
    retryable: true,
  },
  empty_input: {
    title: "Nothing to visualise",
    message: "Add some text before generating a visual.",
    retryable: false,
  },
  input_too_long: {
    title: "That text is too long",
    message: "Trim the input so the local model can work with it.",
    hint: "Around 6,000 characters is a comfortable maximum.",
    retryable: false,
  },
  layout_failed: {
    title: "Layout could not be calculated",
    message: "The diagram was valid but could not be arranged on the canvas.",
    hint: "Try regenerating, or switch to a different diagram type.",
    retryable: true,
  },
  export_failed: {
    title: "Export failed",
    message: "The file could not be created.",
    hint: "Try a smaller scale, or export a different format.",
    retryable: true,
  },
  storage_unavailable: {
    title: "Local storage is unavailable",
    message: "Projects cannot be saved because this browser blocked IndexedDB.",
    hint: "Your diagram still works; export it to keep a copy.",
    retryable: false,
  },
  unknown: {
    title: "Something went wrong",
    message: "An unexpected problem stopped that action.",
    retryable: true,
  },
};

export function createAppError(code: AppErrorCode, detail?: unknown): AppError {
  const error: AppError = { code, ...COPY[code], detail: formatDetail(detail) };
  log.error("app-error", `${code}: ${error.title}`, detail);
  return error;
}

/** Adds context to a known error without losing its user-facing copy. */
export function withDetail(error: AppError, detail: unknown): AppError {
  return { ...error, detail: [error.detail, formatDetail(detail)].filter(Boolean).join("\n") };
}

export function isAppError(value: unknown): value is AppError {
  return (
    typeof value === "object" &&
    value !== null &&
    "code" in value &&
    "title" in value &&
    "message" in value
  );
}

/** Last line of defence: anything thrown becomes a presentable AppError. */
export function toAppError(value: unknown, fallback: AppErrorCode = "unknown"): AppError {
  if (isAppError(value)) return value;
  if (value instanceof DOMException && value.name === "AbortError") {
    return createAppError("cancelled");
  }
  if (value instanceof Error && value.name === "AbortError") {
    return createAppError("cancelled");
  }
  return createAppError(fallback, value);
}

function formatDetail(detail: unknown): string | undefined {
  if (detail === undefined || detail === null) return undefined;
  if (typeof detail === "string") return detail;
  if (detail instanceof Error) return `${detail.name}: ${detail.message}`;
  try {
    return JSON.stringify(detail, null, 2);
  } catch {
    return String(detail);
  }
}
