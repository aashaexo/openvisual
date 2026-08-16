import type { DiagramSpec, DiagramType } from "@/diagrams/schema";

/** How much the model should say. Affects the prompt, never the rendering. */
export type DetailLevel = "simple" | "balanced" | "detailed";

/** "auto" lets the model pick; anything else pins the diagram type. */
export type RequestedDiagramType = "auto" | DiagramType;

export type GenerationAction =
  "generate" | "regenerate" | "simplify" | "add_detail" | "change_type";

export interface OllamaModel {
  name: string;
  size: number;
  parameterSize?: string;
  quantization?: string;
  modifiedAt?: string;
}

export interface OllamaStatus {
  running: boolean;
  version?: string;
  error?: string;
}

export interface SavedProject {
  id: string;
  name: string;
  originalText: string;
  diagramSpec: DiagramSpec;
  excalidrawElements: unknown[];
  appState: unknown;
  theme: string;
  model: string;
  createdAt: string;
  updatedAt: string;
}

export type ProjectSummary = Omit<SavedProject, "excalidrawElements" | "appState">;

/** Every user-facing failure is one of these; raw errors never reach the UI. */
export type AppErrorCode =
  | "ollama_unreachable"
  | "no_models_installed"
  | "model_missing"
  | "timeout"
  | "cancelled"
  | "invalid_model_output"
  | "empty_input"
  | "input_too_long"
  | "layout_failed"
  | "export_failed"
  | "storage_unavailable"
  | "unknown";

export interface AppError {
  code: AppErrorCode;
  title: string;
  message: string;
  hint?: string;
  /** Developer detail. Logged locally, shown only behind "technical details". */
  detail?: string;
  retryable: boolean;
}
