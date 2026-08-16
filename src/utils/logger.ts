/**
 * Local-only development log.
 *
 * Nothing here leaves the machine: entries are kept in memory for the
 * "technical details" panel and mirrored to the console in development.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  at: string;
  level: LogLevel;
  scope: string;
  message: string;
  detail?: unknown;
}

const MAX_ENTRIES = 200;
const entries: LogEntry[] = [];

function record(level: LogLevel, scope: string, message: string, detail?: unknown): void {
  const entry: LogEntry = { at: new Date().toISOString(), level, scope, message, detail };
  entries.push(entry);
  if (entries.length > MAX_ENTRIES) entries.shift();

  // Mirrored to the console during development, but not while tests run —
  // expected failure paths would otherwise bury the actual test output.
  if (import.meta.env.DEV && import.meta.env.MODE !== "test") {
    const method = level === "debug" ? "log" : level;
    console[method](`[${scope}] ${message}`, detail ?? "");
  }
}

export const log = {
  debug: (scope: string, message: string, detail?: unknown) =>
    record("debug", scope, message, detail),
  info: (scope: string, message: string, detail?: unknown) =>
    record("info", scope, message, detail),
  warn: (scope: string, message: string, detail?: unknown) =>
    record("warn", scope, message, detail),
  error: (scope: string, message: string, detail?: unknown) =>
    record("error", scope, message, detail),
  entries: (): readonly LogEntry[] => entries,
  clear: (): void => {
    entries.length = 0;
  },
};
