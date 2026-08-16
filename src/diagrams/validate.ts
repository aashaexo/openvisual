import { diagramSpecSchema, type DiagramSpec } from "@/diagrams/schema";

export interface ValidationIssue {
  path: string;
  message: string;
}

export type ValidationResult =
  { ok: true; spec: DiagramSpec; warnings: string[] } | { ok: false; issues: ValidationIssue[] };

/**
 * The only door model output may pass through on its way to the canvas.
 * Nothing renders unless this returns `ok: true`.
 */
export function validateDiagramSpec(input: unknown): ValidationResult {
  const result = diagramSpecSchema.safeParse(input);

  if (!result.success) {
    return {
      ok: false,
      issues: result.error.issues.map((issue) => ({
        path: issue.path.length ? issue.path.join(".") : "(root)",
        message: issue.message,
      })),
    };
  }

  return { ok: true, spec: result.data, warnings: collectWarnings(result.data) };
}

/**
 * Problems that are worth telling the user about but are not reasons to refuse
 * to draw the diagram.
 */
export function collectWarnings(spec: DiagramSpec): string[] {
  const warnings: string[] = [];
  const connected = new Set<string>();
  for (const edge of spec.edges) {
    connected.add(edge.source);
    connected.add(edge.target);
  }

  const orphans = spec.nodes.filter((node) => !connected.has(node.id));
  // A comparison is a legitimate set of unconnected columns.
  if (spec.type !== "comparison" && orphans.length > 0 && spec.edges.length > 0) {
    warnings.push(
      orphans.length === 1
        ? `"${orphans[0].label}" is not connected to anything.`
        : `${orphans.length} nodes are not connected to anything.`,
    );
  }

  if (spec.type !== "comparison" && spec.edges.length === 0) {
    warnings.push("This diagram has no connections between its nodes.");
  }

  return warnings;
}

/** Compact, model-readable rendering of validation failures for the repair pass. */
export function formatIssues(issues: ValidationIssue[]): string {
  return issues.map((issue) => `- ${issue.path}: ${issue.message}`).join("\n");
}

/** One-line summary for the UI; never shows a stack trace. */
export function summariseIssues(issues: ValidationIssue[]): string {
  const first = issues[0];
  if (!first) return "The model returned data that did not match the diagram format.";
  const extra = issues.length > 1 ? ` (and ${issues.length - 1} more)` : "";
  return `${first.path}: ${first.message}${extra}`;
}
