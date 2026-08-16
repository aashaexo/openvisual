import {
  extractJsonObject,
  normalizeCandidate,
  parseModelJson,
  stripCodeFences,
} from "@/ai/parser";
import type { ParseResult } from "@/ai/parser";
import { FIXTURES, FIXTURE_LIST } from "@/diagrams/fixtures";
import { formatIssues, validateDiagramSpec } from "@/diagrams/validate";

const FENCE = "```";
const EMPTY_RESPONSE = "The model returned an empty response.";
const NOT_AN_OBJECT = "The model returned JSON that is not an object.";

function expectParsed(result: ParseResult): unknown {
  if (!result.ok) throw new Error(`expected the parse to succeed, but it failed: ${result.reason}`);
  return result.value;
}

function expectFailure(result: ParseResult): string {
  if (result.ok) throw new Error("expected the parse to fail, but it returned a value");
  return result.reason;
}

describe("stripCodeFences", () => {
  it("removes a ```json fence", () => {
    const raw = [`${FENCE}json`, '{"version": 1}', FENCE].join("\n");

    expect(stripCodeFences(raw)).toBe('{"version": 1}');
  });

  it("removes a bare ``` fence", () => {
    const raw = [FENCE, '{"version": 1}', FENCE].join("\n");

    expect(stripCodeFences(raw)).toBe('{"version": 1}');
  });

  it("removes an unterminated fence", () => {
    const raw = [`${FENCE}json`, '{"version": 1}'].join("\n");

    expect(stripCodeFences(raw)).toBe('{"version": 1}');
  });

  it("removes an unterminated bare fence", () => {
    const raw = [FENCE, '{"version": 1}'].join("\n");

    expect(stripCodeFences(raw)).toBe('{"version": 1}');
  });

  it("returns unfenced text with only the surrounding whitespace removed", () => {
    expect(stripCodeFences('\n\n  {"version": 1}  \n')).toBe('{"version": 1}');
  });

  it("removes a single-line <think> block", () => {
    expect(stripCodeFences('<think>The user wants a cycle.</think>{"version": 1}')).toBe(
      '{"version": 1}',
    );
  });

  it("removes a multi-line <think> block including any JSON it speculates about", () => {
    const raw = [
      "<think>",
      "The user described a loop, so a cycle fits.",
      'I could answer {"version": 0} but that version is wrong.',
      "</think>",
      '{"version": 1}',
    ].join("\n");

    const stripped = stripCodeFences(raw);

    expect(stripped).toBe('{"version": 1}');
    expect(stripped).not.toContain("<think>");
    expect(stripped).not.toContain('"version": 0');
  });

  it("copes with a think block that precedes a fenced object", () => {
    const raw = [
      "<think>",
      "Six nodes is too many here; four will read better.",
      "</think>",
      `${FENCE}json`,
      '{"version": 1, "type": "cycle"}',
      FENCE,
    ].join("\n");

    expect(stripCodeFences(raw)).toBe('{"version": 1, "type": "cycle"}');
  });

  it("removes several think blocks and matches the closing tag case-insensitively", () => {
    const raw = '<think>first</think><THINK>second</THINK>{"version": 1}';

    expect(stripCodeFences(raw)).toBe('{"version": 1}');
  });

  it("removes chat special tokens such as <|im_start|>", () => {
    expect(stripCodeFences('<|im_start|>{"version": 1}<|im_end|>')).toBe('{"version": 1}');
  });

  it("removes an uppercase ```JSON fence", () => {
    const raw = [`${FENCE}JSON`, '{"version": 1}', FENCE].join("\n");

    expect(stripCodeFences(raw)).toBe('{"version": 1}');
  });

  it("finds a fence that starts after some prose and drops the trailing prose", () => {
    const raw = ["Here you go:", `${FENCE}json`, '{"version": 1}', FENCE, "Hope that helps!"].join(
      "\n",
    );

    const stripped = stripCodeFences(raw);

    expect(stripped).toBe('{"version": 1}');
    expect(stripped).not.toContain("Here you go");
    expect(stripped).not.toContain("Hope that helps");
  });

  it("collapses a response that is nothing but a think block to an empty string", () => {
    expect(stripCodeFences("<think>\nStill deciding.\n</think>")).toBe("");
  });

  it("keeps a think block that the model never closed", () => {
    const raw = '<think>I could return {"version": 1}';

    // Stripping requires a closing tag, so the reasoning survives verbatim.
    expect(stripCodeFences(raw)).toBe(raw);
  });

  it("takes the first fenced block when the model emitted two", () => {
    const raw = [
      `${FENCE}json`,
      '{"version": 1, "title": "First"}',
      FENCE,
      `${FENCE}json`,
      '{"version": 1, "title": "Second"}',
      FENCE,
    ].join("\n");

    expect(stripCodeFences(raw)).toBe('{"version": 1, "title": "First"}');
  });

  it("keeps an unterminated fence usable when a think block precedes it", () => {
    const raw = ["<think>", "Four nodes is enough.", "</think>", `${FENCE}json`, '{"a": 1}'].join(
      "\n",
    );

    expect(stripCodeFences(raw)).toBe('{"a": 1}');
  });
});

describe("extractJsonObject", () => {
  it("returns the first balanced object and ignores anything after it", () => {
    expect(extractJsonObject('{"a": 1} {"b": 2}')).toBe('{"a": 1}');
  });

  it("keeps nested objects and arrays inside the balanced span", () => {
    const source = '{"nodes": [{"id": "a"}, {"id": "b"}], "meta": {"deep": {"deeper": true}}}';

    expect(extractJsonObject(source)).toBe(source);
  });

  it("ignores braces that appear inside string values", () => {
    const source = '{"label": "a { brace } inside", "shape": "rounded"}';

    const extracted = extractJsonObject(source);

    expect(extracted).toBe(source);
    expect(JSON.parse(extracted ?? "")).toEqual({
      label: "a { brace } inside",
      shape: "rounded",
    });
  });

  it("does not close early on a lone } held inside a string", () => {
    const source = '{"label": "}{", "emphasis": "primary"}';

    expect(extractJsonObject(source)).toBe(source);
  });

  it("copes with escaped quotes inside strings", () => {
    const source = String.raw`{"label": "He said \"go\" {now}", "n": 2}`;

    const extracted = extractJsonObject(`Here: ${source} done.`);

    expect(extracted).toBe(source);
    expect(JSON.parse(extracted ?? "")).toEqual({ label: 'He said "go" {now}', n: 2 });
  });

  it("copes with an escaped backslash immediately before the closing quote", () => {
    const source = String.raw`{"label": "path\\", "n": 1}`;

    expect(extractJsonObject(source)).toBe(source);
  });

  it("skips leading prose and finds the object", () => {
    expect(extractJsonObject('Sure! Here you go: {"a": 1}')).toBe('{"a": 1}');
  });

  it("returns null when there is no object at all", () => {
    expect(extractJsonObject("I am sorry, I cannot draw that.")).toBeNull();
    expect(extractJsonObject("")).toBeNull();
    expect(extractJsonObject("[1, 2, 3]")).toBeNull();
  });

  it("returns null when the object never closes", () => {
    expect(extractJsonObject('{"nodes": [{"id": "a"}')).toBeNull();
  });

  it("returns null when a string is left unterminated", () => {
    expect(extractJsonObject('{"label": "unterminated}')).toBeNull();
  });

  it("reaches inside an array to find the first object it contains", () => {
    expect(extractJsonObject('[{"version": 1}, {"version": 2}]')).toBe('{"version": 1}');
  });

  it("skips a brace used as prose punctuation before the real object", () => {
    expect(extractJsonObject('Use {placeholder} names. {"version": 1}')).toBe('{"version": 1}');
  });

  it("falls back to the first balanced span when nothing parses", () => {
    expect(extractJsonObject("Use {placeholder} names.")).toBe("{placeholder}");
  });
});

describe("normalizeCandidate", () => {
  it("drops null and undefined values", () => {
    const result = normalizeCandidate({ id: "a", description: null, category: undefined });

    expect(result).toEqual({ id: "a" });
    expect(result).not.toHaveProperty("description");
    expect(result).not.toHaveProperty("category");
  });

  it("drops empty and whitespace-only strings", () => {
    const result = normalizeCandidate({ id: "a", summary: "", description: "   \n  " });

    expect(result).toEqual({ id: "a" });
    expect(Object.keys(result as object)).toEqual(["id"]);
  });

  it("trims surrounding whitespace from strings", () => {
    expect(normalizeCandidate({ label: "  Receive the goal \n" })).toEqual({
      label: "Receive the goal",
    });
  });

  it("leaves numbers and booleans untouched, including 0 and false", () => {
    expect(normalizeCandidate({ version: 1, count: 0, directed: false, ratio: -1.5 })).toEqual({
      version: 1,
      count: 0,
      directed: false,
      ratio: -1.5,
    });
  });

  it("recurses into nested objects", () => {
    expect(
      normalizeCandidate({
        meta: { title: "  Deep  ", note: "", inner: { label: " x ", drop: null } },
      }),
    ).toEqual({ meta: { title: "Deep", inner: { label: "x" } } });
  });

  it("recurses into arrays of objects", () => {
    expect(
      normalizeCandidate({
        nodes: [
          { id: "a", label: "  First  ", description: null },
          { id: "b", label: "Second", category: "" },
        ],
      }),
    ).toEqual({
      nodes: [
        { id: "a", label: "First" },
        { id: "b", label: "Second" },
      ],
    });
  });

  it("normalises an array passed in at the top level", () => {
    expect(normalizeCandidate([{ id: "a", label: " x ", description: null }])).toEqual([
      { id: "a", label: "x" },
    ]);
  });

  // Array *elements* are left alone: removing or rewriting them would silently
  // shift indices that the validation issue paths refer back to.
  it("leaves primitive array elements exactly as they are", () => {
    expect(normalizeCandidate([" a ", "", null, 3, true])).toEqual([" a ", "", null, 3, true]);
  });

  it("keeps empty arrays and empty objects instead of dropping them", () => {
    expect(normalizeCandidate({ nodes: [], meta: {} })).toEqual({ nodes: [], meta: {} });
  });

  it("keeps a nested object whose own properties were all dropped", () => {
    const result = normalizeCandidate({ meta: { note: null, caption: "  " } });

    expect(result).toEqual({ meta: {} });
    expect(result).toHaveProperty("meta");
  });

  // Only the empty string is dropped — a falsy-looking string is real content.
  it('keeps strings such as "0" and "false"', () => {
    expect(normalizeCandidate({ a: "0", b: "false", c: " 0 " })).toEqual({
      a: "0",
      b: "false",
      c: "0",
    });
  });

  it("does not coerce a wrong type, it only trims and drops", () => {
    expect(normalizeCandidate({ version: "1", nodes: "not an array" })).toEqual({
      version: "1",
      nodes: "not an array",
    });
  });

  it("recurses through arrays nested inside arrays", () => {
    expect(normalizeCandidate({ rows: [[{ label: " x ", description: null }]] })).toEqual({
      rows: [[{ label: "x" }]],
    });
  });

  it("does not mutate the value it was given", () => {
    const input = { nodes: [{ id: "a", label: "  First  ", description: null }] };

    normalizeCandidate(input);

    expect(input).toEqual({ nodes: [{ id: "a", label: "  First  ", description: null }] });
  });

  it("returns primitives unchanged", () => {
    expect(normalizeCandidate(7)).toBe(7);
    expect(normalizeCandidate(true)).toBe(true);
    expect(normalizeCandidate(null)).toBeNull();
  });
});

describe("parseModelJson", () => {
  it("parses clean JSON", () => {
    const raw = '{"version": 1, "title": "Clean"}';

    const result = parseModelJson(raw);

    expect(expectParsed(result)).toEqual({ version: 1, title: "Clean" });
    expect(result.raw).toBe(raw);
  });

  it("parses fenced JSON and reports the untouched original as raw", () => {
    const raw = [`${FENCE}json`, '{"version": 1, "title": "Fenced"}', FENCE].join("\n");

    const result = parseModelJson(raw);

    expect(expectParsed(result)).toEqual({ version: 1, title: "Fenced" });
    expect(result.raw).toBe(raw);
    expect(result.raw).toContain(FENCE);
  });

  it("parses JSON the model wrapped in prose", () => {
    const raw = 'Here is your diagram: {"version": 1, "title": "Wrapped"} Hope this helps!';

    expect(expectParsed(parseModelJson(raw))).toEqual({ version: 1, title: "Wrapped" });
  });

  it("parses JSON out of a fence tagged with some other language", () => {
    const raw = [`${FENCE}javascript`, '{"version": 1, "title": "Mislabelled"}', FENCE].join("\n");

    expect(expectParsed(parseModelJson(raw))).toEqual({ version: 1, title: "Mislabelled" });
  });

  it("takes the first object when the model emitted two in a row", () => {
    const raw = '{"version": 1, "title": "First"} {"version": 1, "title": "Second"}';

    expect(expectParsed(parseModelJson(raw))).toEqual({ version: 1, title: "First" });
  });

  it("keeps braces that belong inside a label", () => {
    expect(expectParsed(parseModelJson('{"label": "a {b} c", "n": 1}'))).toEqual({
      label: "a {b} c",
      n: 1,
    });
  });

  it("normalises the parsed value", () => {
    const raw = '{"version": 1, "title": "  Padded  ", "summary": "", "type": null}';

    expect(expectParsed(parseModelJson(raw))).toEqual({ version: 1, title: "Padded" });
  });

  it("fails with a readable reason on truncated JSON", () => {
    const raw = '{"version": 1, "nodes": [{"id": "a", "label": "First"';

    const reason = expectFailure(parseModelJson(raw));

    expect(reason).toMatch(/JSON/i);
    expect(reason).not.toBe(NOT_AN_OBJECT);
    expect(reason).not.toBe(EMPTY_RESPONSE);
    expect(reason).not.toMatch(/\bat [\w./-]+:\d+/);
  });

  it("fails with a readable reason on invalid JSON", () => {
    const reason = expectFailure(parseModelJson('{"version": 1, "title": Untitled}'));

    expect(reason).toMatch(/JSON/i);
    expect(reason).not.toBe(NOT_AN_OBJECT);
    expect(reason).not.toBe(EMPTY_RESPONSE);
  });

  it("fails on an empty response", () => {
    expect(expectFailure(parseModelJson(""))).toBe(EMPTY_RESPONSE);
  });

  it("fails on a whitespace-only response", () => {
    expect(expectFailure(parseModelJson("  \n\t  "))).toBe(EMPTY_RESPONSE);
  });

  it("fails when the top-level value is an array", () => {
    expect(expectFailure(parseModelJson('["flowchart", "timeline"]'))).toBe(NOT_AN_OBJECT);
  });

  it("fails when the top-level value is a bare string", () => {
    expect(expectFailure(parseModelJson('"I cannot draw that diagram."'))).toBe(NOT_AN_OBJECT);
  });

  it("fails when the top-level value is a number", () => {
    expect(expectFailure(parseModelJson("42"))).toBe(NOT_AN_OBJECT);
  });

  it("fails when the top-level value is a bare boolean", () => {
    expect(expectFailure(parseModelJson("true"))).toBe(NOT_AN_OBJECT);
  });

  it("fails when the top-level value is JSON null", () => {
    expect(expectFailure(parseModelJson("null"))).toBe(NOT_AN_OBJECT);
  });

  it("fails with a readable reason on a trailing comma", () => {
    const reason = expectFailure(parseModelJson('{"version": 1, "title": "A",}'));

    expect(reason).toMatch(/JSON/i);
    expect(reason).not.toBe(NOT_AN_OBJECT);
  });

  it("fails when the model only produced a think block and no JSON", () => {
    const raw = "<think>I am still deciding which diagram fits.</think>";

    const reason = expectFailure(parseModelJson(raw));

    // The response is not blank, so the empty-response branch never runs: the
    // stripped remainder is "" and JSON.parse is what reports the failure.
    expect(reason).not.toBe(EMPTY_RESPONSE);
    expect(reason).toMatch(/JSON/i);
  });

  it("keeps the raw response on the failure path", () => {
    const raw = "Sorry, I cannot help with that.";

    const result = parseModelJson(raw);

    expect(result.ok).toBe(false);
    expect(result.raw).toBe(raw);
    expect(expectFailure(result)).not.toBe(EMPTY_RESPONSE);
  });

  it("accepts an empty object without inventing fields for it", () => {
    expect(expectParsed(parseModelJson("{}"))).toEqual({});
  });

  // The "not an object" guard only ever fires for arrays of scalars: when the
  // array holds an object, extraction has already reached inside it and the
  // wrapper is silently discarded. Pinned so a future rewrite is deliberate.
  it("silently unwraps an array that holds the object", () => {
    expect(expectParsed(parseModelJson('[{"version": 1, "title": "Wrapped"}]'))).toEqual({
      version: 1,
      title: "Wrapped",
    });
  });

  // An unterminated <think> has no matching </think>, so nothing is stripped and
  // JSON the model was only speculating about is returned as the final answer.
  // The fence handling has an unterminated fallback; the think handling has none.
  it("treats JSON inside an unterminated think block as the answer", () => {
    expect(expectParsed(parseModelJson('<think>I could return {"version": 1} here'))).toEqual({
      version: 1,
    });
  });

  it("recovers the object when prose before it contains a brace", () => {
    const raw = 'I will use {placeholder} ids. {"version": 1, "title": "Real"}';

    expect(expectParsed(parseModelJson(raw))).toEqual({ version: 1, title: "Real" });
  });
});

describe("parseModelJson end to end", () => {
  it("recovers a valid spec from a messy qwen3 response", () => {
    const raw = [
      "<think>",
      "The user described a loop, so a flowchart is the right shape.",
      'I might emit {"version": 0} out of habit — the schema wants version 1.',
      "Six nodes should be enough.",
      "</think>",
      "Here is your diagram:",
      "",
      `${FENCE}json`,
      JSON.stringify(FIXTURES.flowchart, null, 2),
      FENCE,
      "",
      "Hope this helps! Ask me for a timeline version if you prefer.",
    ].join("\n");

    const parsed = expectParsed(parseModelJson(raw));
    const validation = validateDiagramSpec(parsed);

    if (!validation.ok)
      throw new Error(`spec did not validate:\n${formatIssues(validation.issues)}`);
    expect(validation.spec).toEqual(FIXTURES.flowchart);
    expect(validation.warnings).toEqual([]);
  });

  it("recovers a valid spec from a stream whose closing fence never arrived", () => {
    const raw = [
      "<think>",
      "A cycle repeats, so cycle is right.",
      "</think>",
      `${FENCE}json`,
      JSON.stringify(FIXTURES.cycle, null, 2),
    ].join("\n");

    const validation = validateDiagramSpec(expectParsed(parseModelJson(raw)));

    if (!validation.ok)
      throw new Error(`spec did not validate:\n${formatIssues(validation.issues)}`);
    expect(validation.spec).toEqual(FIXTURES.cycle);
    expect(validation.warnings).toEqual([]);
  });

  it("reports a readable reason when the fenced spec was cut off mid-stream", () => {
    const complete = JSON.stringify(FIXTURES.hierarchy);
    const raw = [`${FENCE}json`, complete.slice(0, complete.length - 20)].join("\n");

    const reason = expectFailure(parseModelJson(raw));

    expect(reason).toMatch(/JSON/i);
    expect(reason).not.toBe("The model returned an empty response.");
  });

  for (const fixture of FIXTURE_LIST) {
    it(`round-trips the ${fixture.type} fixture through a messy response`, () => {
      const raw = [
        "<think>",
        `A ${fixture.type} is the right shape here.`,
        "</think>",
        `Here is your ${fixture.type}:`,
        `${FENCE}json`,
        JSON.stringify(fixture, null, 2),
        FENCE,
        "Let me know if you want a different style.",
      ].join("\n");

      const validation = validateDiagramSpec(expectParsed(parseModelJson(raw)));

      if (!validation.ok)
        throw new Error(`spec did not validate:\n${formatIssues(validation.issues)}`);
      expect(validation.spec).toEqual(fixture);
      expect(validation.warnings).toEqual([]);
    });
  }

  it("recovers a valid spec from prose with no fence at all", () => {
    const raw = `Sure — here it is: ${JSON.stringify(FIXTURES.comparison)} Let me know what to change.`;

    const validation = validateDiagramSpec(expectParsed(parseModelJson(raw)));

    if (!validation.ok)
      throw new Error(`spec did not validate:\n${formatIssues(validation.issues)}`);
    expect(validation.spec).toEqual(FIXTURES.comparison);
  });
});
