import { invoke, isTauri } from "@tauri-apps/api/core";
import type { OllamaModel, OllamaStatus } from "@/types";
import { createAppError } from "@/utils/errors";
import { log } from "@/utils/logger";

/**
 * The only network destination in this application.
 *
 * Requests go through Rust when running under Tauri (which also avoids CORS),
 * and through `fetch` when the frontend runs in a plain browser during
 * development. Both paths are hardcoded to the local loopback address; there is
 * no configuration that can point them anywhere else.
 */
export const OLLAMA_BASE_URL = "http://127.0.0.1:11434";
export const DEFAULT_MODEL = "qwen3:4b";
export const DEFAULT_TIMEOUT_SECONDS = 180;

export interface ChatRequest {
  requestId: string;
  model: string;
  system: string;
  prompt: string;
  /** JSON schema handed to Ollama's structured-output mode. */
  format?: unknown;
  temperature: number;
  numCtx?: number;
  timeoutSecs: number;
  /** Disables the visible reasoning channel on thinking models such as qwen3. */
  think?: boolean;
}

export interface ChatResponse {
  content: string;
  model: string;
  totalDurationMs?: number;
  evalCount?: number;
}

interface RustCommandError {
  code: string;
  message: string;
}

const ERROR_CODES = new Set([
  "ollama_unreachable",
  "timeout",
  "cancelled",
  "model_missing",
  "invalid_model_output",
]);

export interface OllamaTransport {
  checkOllama(): Promise<OllamaStatus>;
  listModels(): Promise<OllamaModel[]>;
  chat(
    request: ChatRequest,
    kind: "generate" | "repair",
    signal?: AbortSignal,
  ): Promise<ChatResponse>;
  cancel(requestId: string): Promise<void>;
}

/* -------------------------------------------------------------------------- */
/* Tauri transport                                                             */
/* -------------------------------------------------------------------------- */

const tauriTransport: OllamaTransport = {
  async checkOllama() {
    return invoke<OllamaStatus>("check_ollama");
  },

  async listModels() {
    try {
      return await invoke<OllamaModel[]>("list_ollama_models");
    } catch (error) {
      throw fromRustError(error);
    }
  },

  async chat(request, kind, signal) {
    const command = kind === "repair" ? "repair_diagram" : "generate_diagram";
    // The abort signal cancels the in-flight HTTP request inside Rust.
    const onAbort = () => {
      void invoke("cancel_generation", { requestId: request.requestId }).catch(() => undefined);
    };
    signal?.addEventListener("abort", onAbort, { once: true });

    try {
      return await invoke<ChatResponse>(command, { request });
    } catch (error) {
      throw fromRustError(error);
    } finally {
      signal?.removeEventListener("abort", onAbort);
    }
  },

  async cancel(requestId) {
    await invoke("cancel_generation", { requestId }).catch(() => undefined);
  },
};

function fromRustError(error: unknown): unknown {
  if (typeof error === "object" && error !== null && "code" in error) {
    const { code, message } = error as RustCommandError;
    if (ERROR_CODES.has(code)) {
      return createAppError(code as Parameters<typeof createAppError>[0], message);
    }
  }
  return createAppError("unknown", error);
}

/* -------------------------------------------------------------------------- */
/* Browser transport (development without the desktop shell)                   */
/* -------------------------------------------------------------------------- */

interface OllamaTagsResponse {
  models?: Array<{
    name: string;
    size?: number;
    modified_at?: string;
    details?: { parameter_size?: string; quantization_level?: string };
  }>;
}

interface OllamaChatResponse {
  model?: string;
  message?: { content?: string };
  total_duration?: number;
  eval_count?: number;
  error?: string;
}

const browserTransport: OllamaTransport = {
  async checkOllama() {
    try {
      const response = await fetch(`${OLLAMA_BASE_URL}/api/version`, {
        signal: AbortSignal.timeout(2500),
      });
      if (!response.ok) return { running: false, error: `HTTP ${response.status}` };
      const body = (await response.json()) as { version?: string };
      return { running: true, version: body.version };
    } catch (error) {
      return { running: false, error: error instanceof Error ? error.message : "unreachable" };
    }
  },

  async listModels() {
    let response: Response;
    try {
      response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, { signal: AbortSignal.timeout(5000) });
    } catch (error) {
      throw createAppError("ollama_unreachable", error);
    }
    if (!response.ok) throw createAppError("ollama_unreachable", `HTTP ${response.status}`);

    const body = (await response.json()) as OllamaTagsResponse;
    return (body.models ?? []).map((model) => ({
      name: model.name,
      size: model.size ?? 0,
      parameterSize: model.details?.parameter_size,
      quantization: model.details?.quantization_level,
      modifiedAt: model.modified_at,
    }));
  },

  async chat(request, _kind, signal) {
    const timeout = AbortSignal.timeout(request.timeoutSecs * 1000);
    const composite = signal ? AbortSignal.any([signal, timeout]) : timeout;

    let response: Response;
    try {
      response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: composite,
        body: JSON.stringify({
          model: request.model,
          messages: [
            { role: "system", content: request.system },
            { role: "user", content: request.prompt },
          ],
          stream: false,
          ...(request.think === undefined ? {} : { think: request.think }),
          ...(request.format === undefined ? {} : { format: request.format }),
          options: {
            temperature: request.temperature,
            ...(request.numCtx === undefined ? {} : { num_ctx: request.numCtx }),
          },
        }),
      });
    } catch (error) {
      if (signal?.aborted) throw createAppError("cancelled");
      if (error instanceof DOMException && error.name === "TimeoutError") {
        throw createAppError("timeout", error);
      }
      throw createAppError("ollama_unreachable", error);
    }

    if (response.status === 404) {
      throw createAppError("model_missing", `${request.model} is not installed`);
    }
    if (!response.ok) {
      throw createAppError("unknown", `Ollama responded with HTTP ${response.status}`);
    }

    const body = (await response.json()) as OllamaChatResponse;
    if (body.error) {
      const missing = /not found|try pulling/i.test(body.error);
      throw createAppError(missing ? "model_missing" : "unknown", body.error);
    }

    return {
      content: body.message?.content ?? "",
      model: body.model ?? request.model,
      totalDurationMs: body.total_duration
        ? Math.round(body.total_duration / 1_000_000)
        : undefined,
      evalCount: body.eval_count,
    };
  },

  async cancel() {
    // The browser transport cancels through the AbortSignal itself.
  },
};

/* -------------------------------------------------------------------------- */

let transportOverride: OllamaTransport | null = null;

/** Test seam: lets the suite run the whole pipeline against a fake Ollama. */
export function setOllamaTransport(transport: OllamaTransport | null): void {
  transportOverride = transport;
}

export function getOllamaTransport(): OllamaTransport {
  if (transportOverride) return transportOverride;
  return isTauri() ? tauriTransport : browserTransport;
}

export async function checkOllama(): Promise<OllamaStatus> {
  const status = await getOllamaTransport().checkOllama();
  log.info("ollama", `health check: ${status.running ? "running" : "unreachable"}`, status);
  return status;
}

export async function listOllamaModels(): Promise<OllamaModel[]> {
  return getOllamaTransport().listModels();
}

export async function chatWithOllama(
  request: ChatRequest,
  kind: "generate" | "repair" = "generate",
  signal?: AbortSignal,
): Promise<ChatResponse> {
  signal?.throwIfAborted();
  const started = performance.now();
  const response = await getOllamaTransport().chat(request, kind, signal);
  log.debug("ollama", `${kind} finished in ${Math.round(performance.now() - started)}ms`, {
    model: response.model,
    chars: response.content.length,
  });
  return response;
}
