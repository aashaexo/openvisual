import type { ChatRequest, ChatResponse, OllamaTransport } from "@/ai/client";
import type { OllamaModel, OllamaStatus } from "@/types";

/**
 * A stand-in for the whole Ollama transport, installed with
 * `setOllamaTransport`. It exists so the suite can drive the real pipeline —
 * prompts, parser, validation, repair — without a server, a network or Tauri.
 */

export type ChatKind = "generate" | "repair";

export interface RecordedCall {
  request: ChatRequest;
  kind: ChatKind;
}

export type ResponseFactory = (request: ChatRequest, kind: ChatKind) => string | Promise<string>;

export interface FakeOllamaOptions {
  /** A queue consumed one entry per `chat` call, or a factory called per call. */
  responses?: string[] | ResponseFactory;
  models?: OllamaModel[];
  version?: string;
  /** Thrown from `chat` before any response is produced. */
  failWith?: unknown;
}

export interface FakeOllama extends OllamaTransport {
  /** Every `chat` call in order, including the ones that then threw. */
  calls: RecordedCall[];
  /** Request ids passed to `cancel`. */
  cancelled: string[];
}

const DEFAULT_MODELS: OllamaModel[] = [
  { name: "qwen3:4b", size: 2_600_000_000, parameterSize: "4B", quantization: "Q4_K_M" },
];

export function createFakeOllama(options: FakeOllamaOptions = {}): FakeOllama {
  const calls: RecordedCall[] = [];
  const cancelled: string[] = [];
  const queue = Array.isArray(options.responses) ? [...options.responses] : null;
  const factory = typeof options.responses === "function" ? options.responses : null;

  function nextContent(request: ChatRequest, kind: ChatKind): string | Promise<string> {
    if (factory) return factory(request, kind);
    if (!queue || queue.length === 0) {
      throw new Error(`fake ollama: no queued response for ${kind} call ${calls.length}`);
    }
    return queue.shift() as string;
  }

  return {
    calls,
    cancelled,

    async checkOllama(): Promise<OllamaStatus> {
      return { running: true, version: options.version ?? "0.6.0" };
    },

    async listModels(): Promise<OllamaModel[]> {
      return options.models ?? DEFAULT_MODELS;
    },

    async chat(request, kind, signal): Promise<ChatResponse> {
      calls.push({ request, kind });
      if (options.failWith !== undefined) throw options.failWith;
      signal?.throwIfAborted();

      const content = await nextContent(request, kind);
      return { content, model: request.model, totalDurationMs: 12, evalCount: 128 };
    },

    async cancel(requestId): Promise<void> {
      cancelled.push(requestId);
    },
  };
}
