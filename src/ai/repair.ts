import { chatWithOllama } from "@/ai/client";
import { parseModelJson } from "@/ai/parser";
import { buildRepairPrompt, SYSTEM_PROMPT } from "@/ai/prompts";
import { diagramJsonSchema } from "@/diagrams/schema";
import { formatIssues, validateDiagramSpec, type ValidationResult } from "@/diagrams/validate";
import { log } from "@/utils/logger";

export interface RepairRequest {
  raw: string;
  issues: string;
  model: string;
  requestId: string;
  timeoutSecs: number;
  signal?: AbortSignal;
}

/**
 * One local repair attempt.
 *
 * The model is shown its own invalid output plus the exact validation errors
 * and asked for corrected JSON. Exactly one attempt is made — if it fails, the
 * user is told and offered a retry rather than being put in a silent loop.
 */
export async function attemptRepair(request: RepairRequest): Promise<ValidationResult> {
  log.warn("ai", "diagram failed validation, attempting one local repair", request.issues);

  const response = await chatWithOllama(
    {
      requestId: request.requestId,
      model: request.model,
      system: SYSTEM_PROMPT,
      prompt: buildRepairPrompt({ raw: request.raw, errors: request.issues }),
      format: diagramJsonSchema,
      temperature: 0,
      timeoutSecs: request.timeoutSecs,
      think: false,
    },
    "repair",
    request.signal,
  );

  const parsed = parseModelJson(response.content);
  if (!parsed.ok) {
    return { ok: false, issues: [{ path: "(root)", message: parsed.reason }] };
  }

  return validateDiagramSpec(parsed.value);
}

export { formatIssues };
