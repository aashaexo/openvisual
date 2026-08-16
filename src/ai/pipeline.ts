import { chatWithOllama, DEFAULT_TIMEOUT_SECONDS } from "@/ai/client";
import { parseModelJson } from "@/ai/parser";
import {
  buildAddDetailPrompt,
  buildChangeTypePrompt,
  buildGeneratePrompt,
  buildSimplifyPrompt,
  SYSTEM_PROMPT,
} from "@/ai/prompts";
import { attemptRepair } from "@/ai/repair";
import { diagramJsonSchema, type DiagramSpec, type DiagramType } from "@/diagrams/schema";
import {
  formatIssues,
  summariseIssues,
  validateDiagramSpec,
  type ValidationResult,
} from "@/diagrams/validate";
import type { DetailLevel, GenerationAction, RequestedDiagramType } from "@/types";
import { createAppError, toAppError } from "@/utils/errors";
import { log } from "@/utils/logger";

export const MAX_INPUT_CHARS = 6000;
const GENERATION_TEMPERATURE = 0.2;
const CONTEXT_WINDOW = 8192;

export interface GenerationRequest {
  action: GenerationAction;
  text: string;
  model: string;
  detail: DetailLevel;
  requestedType: RequestedDiagramType;
  /** Required by simplify, add_detail and change_type. */
  currentSpec?: DiagramSpec | null;
  targetType?: DiagramType;
  requestId: string;
  timeoutSecs?: number;
  signal?: AbortSignal;
}

export interface GenerationResult {
  spec: DiagramSpec;
  warnings: string[];
  meta: {
    model: string;
    action: GenerationAction;
    repaired: boolean;
    durationMs: number;
  };
}

/**
 * Text in, validated `DiagramSpec` out.
 *
 * The model is only ever trusted to produce candidate JSON. Nothing downstream
 * sees a spec that has not been through Zod, and a single repair attempt is the
 * only retry the pipeline makes on its own.
 */
export async function runGeneration(request: GenerationRequest): Promise<GenerationResult> {
  const text = request.text.trim();
  if (!text) throw createAppError("empty_input");
  if (text.length > MAX_INPUT_CHARS) {
    throw createAppError("input_too_long", `${text.length} characters`);
  }

  const timeoutSecs = request.timeoutSecs ?? DEFAULT_TIMEOUT_SECONDS;
  const started = performance.now();

  try {
    request.signal?.throwIfAborted();

    const response = await chatWithOllama(
      {
        requestId: request.requestId,
        model: request.model,
        system: SYSTEM_PROMPT,
        prompt: buildPrompt(request, text),
        format: diagramJsonSchema,
        temperature: GENERATION_TEMPERATURE,
        numCtx: CONTEXT_WINDOW,
        timeoutSecs,
        think: false,
      },
      "generate",
      request.signal,
    );

    const parsed = parseModelJson(response.content);
    const firstPass: ValidationResult = parsed.ok
      ? validateDiagramSpec(parsed.value)
      : { ok: false, issues: [{ path: "(root)", message: parsed.reason }] };

    if (firstPass.ok) {
      return {
        spec: firstPass.spec,
        warnings: firstPass.warnings,
        meta: {
          model: response.model,
          action: request.action,
          repaired: false,
          durationMs: Math.round(performance.now() - started),
        },
      };
    }

    request.signal?.throwIfAborted();

    const repaired = await attemptRepair({
      raw: response.content,
      issues: formatIssues(firstPass.issues),
      model: request.model,
      requestId: `${request.requestId}-repair`,
      timeoutSecs,
      signal: request.signal,
    });

    if (!repaired.ok) {
      log.error("ai", "repair attempt failed", repaired.issues);
      throw createAppError(
        "invalid_model_output",
        `First attempt: ${summariseIssues(firstPass.issues)}\nAfter repair: ${summariseIssues(
          repaired.issues,
        )}`,
      );
    }

    return {
      spec: repaired.spec,
      warnings: repaired.warnings,
      meta: {
        model: response.model,
        action: request.action,
        repaired: true,
        durationMs: Math.round(performance.now() - started),
      },
    };
  } catch (error) {
    throw toAppError(error);
  }
}

function buildPrompt(request: GenerationRequest, text: string): string {
  switch (request.action) {
    case "simplify": {
      const spec = requireSpec(request);
      return buildSimplifyPrompt({ text, spec });
    }
    case "add_detail": {
      const spec = requireSpec(request);
      return buildAddDetailPrompt({ text, spec });
    }
    case "change_type": {
      const spec = requireSpec(request);
      const targetType = request.targetType;
      if (!targetType) throw createAppError("unknown", "change_type without a target type");
      return buildChangeTypePrompt({ text, spec, targetType, detail: request.detail });
    }
    case "generate":
    case "regenerate":
    default:
      return buildGeneratePrompt({
        text,
        requestedType: request.requestedType,
        detail: request.detail,
      });
  }
}

function requireSpec(request: GenerationRequest): DiagramSpec {
  if (!request.currentSpec) {
    throw createAppError("unknown", `${request.action} needs an existing diagram`);
  }
  return request.currentSpec;
}
