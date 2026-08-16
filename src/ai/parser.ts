/**
 * Turns whatever the model said into a candidate JSON value.
 *
 * This step is deliberately forgiving about *packaging* (code fences, thinking
 * blocks, stray prose) and completely unforgiving about *content* — it only
 * ever produces a plain JSON value, which then has to survive Zod validation
 * before anything is drawn.
 */

export type ParseResult =
  { ok: true; value: unknown; raw: string } | { ok: false; reason: string; raw: string };

/** Removes ```json fences and reasoning blocks emitted by thinking models. */
export function stripCodeFences(input: string): string {
  let text = input.trim();

  // Reasoning models such as qwen3 may still wrap their thoughts in tags.
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  text = text.replace(/<\|[^|]*\|>/g, "").trim();

  const fence = text.match(/```(?:json|JSON)?\s*([\s\S]*?)```/);
  if (fence) return fence[1].trim();

  // An unterminated fence still means "the JSON starts after this line".
  if (text.startsWith("```")) {
    return text
      .replace(/^```(?:json|JSON)?\s*/, "")
      .replace(/```$/, "")
      .trim();
  }

  return text;
}

/**
 * Extracts the first balanced JSON object, ignoring braces inside strings.
 *
 * Each `{` is tried in turn until one yields a span that actually parses, so a
 * brace used as prose punctuation ("use {placeholder} ids") does not swallow
 * the real object that follows it.
 */
export function extractJsonObject(input: string): string | null {
  let firstBalanced: string | null = null;
  let start = input.indexOf("{");

  while (start !== -1) {
    const span = balancedSpanFrom(input, start);
    // An unclosed brace means the response was cut off. Descending into the
    // braces nested inside it would return a fragment of a truncated object,
    // which is worse than reporting that nothing parsed.
    if (span === null) break;

    if (parses(span)) return span;
    if (firstBalanced === null) firstBalanced = span;

    // Resume after the failed span rather than inside it.
    start = input.indexOf("{", start + span.length);
  }

  // Nothing parsed: hand back the first candidate so the caller can report a
  // real JSON error rather than "no object found".
  return firstBalanced;
}

function balancedSpanFrom(input: string, start: number): string | null {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < input.length; i += 1) {
    const char = input[i];

    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }

    if (char === '"') inString = true;
    else if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) return input.slice(start, i + 1);
    }
  }

  return null;
}

function parses(candidate: string): boolean {
  try {
    JSON.parse(candidate);
    return true;
  } catch {
    return false;
  }
}

/**
 * Drops `null` and empty-string values so that optional fields simply go
 * missing instead of failing validation. Nothing else is coerced: a wrong type
 * stays wrong and gets reported to the repair pass.
 */
export function normalizeCandidate(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeCandidate);
  if (value === null || typeof value !== "object") return value;

  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (item === null || item === undefined) continue;
    if (typeof item === "string") {
      const trimmed = item.trim();
      if (trimmed === "") continue;
      out[key] = trimmed;
      continue;
    }
    out[key] = normalizeCandidate(item);
  }
  return out;
}

export function parseModelJson(raw: string): ParseResult {
  if (!raw || !raw.trim()) {
    return { ok: false, reason: "The model returned an empty response.", raw };
  }

  const stripped = stripCodeFences(raw);
  const candidate = extractJsonObject(stripped) ?? stripped;

  try {
    const parsed: unknown = JSON.parse(candidate);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return { ok: false, reason: "The model returned JSON that is not an object.", raw };
    }
    return { ok: true, value: normalizeCandidate(parsed), raw };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "The response was not valid JSON.",
      raw,
    };
  }
}
