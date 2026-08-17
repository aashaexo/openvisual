import { useState } from "react";
import { MAX_INPUT_CHARS } from "@/ai/pipeline";
import { DIAGRAM_TYPES } from "@/diagrams/schema";
import { EXAMPLES } from "@/components/editor/examples";
import { IconButton } from "@/components/ui/IconButton";
import { Spinner } from "@/components/ui/Spinner";
import {
  AlertIcon,
  FolderIcon,
  LockIcon,
  SparkIcon,
  StopIcon,
  TrashIcon,
} from "@/components/ui/Icons";
import { useAppStore } from "@/store/appStore";
import { THEME_LIST } from "@/themes";
import type { DetailLevel, RequestedDiagramType } from "@/types";

const TYPE_LABELS: Record<string, string> = {
  auto: "Automatic",
  flowchart: "Flowchart",
  timeline: "Timeline",
  hierarchy: "Hierarchy",
  comparison: "Comparison",
  cycle: "Cycle",
  hub_spoke: "Hub and spoke",
};

const DETAIL_LEVELS: DetailLevel[] = ["simple", "balanced", "detailed"];

interface InputPanelProps {
  onOpenProjects: () => void;
  onOpenSetup: () => void;
}

export function InputPanel({ onOpenProjects, onOpenSetup }: InputPanelProps) {
  const [exampleIndex, setExampleIndex] = useState(0);

  const text = useAppStore((s) => s.text);
  const setText = useAppStore((s) => s.setText);
  const requestedType = useAppStore((s) => s.requestedType);
  const setRequestedType = useAppStore((s) => s.setRequestedType);
  const detail = useAppStore((s) => s.detail);
  const setDetail = useAppStore((s) => s.setDetail);
  const themeId = useAppStore((s) => s.themeId);
  const setTheme = useAppStore((s) => s.setTheme);
  const model = useAppStore((s) => s.model);
  const setModel = useAppStore((s) => s.setModel);
  const models = useAppStore((s) => s.models);
  const ollamaStatus = useAppStore((s) => s.ollamaStatus);
  const status = useAppStore((s) => s.status);
  const spec = useAppStore((s) => s.spec);
  const generate = useAppStore((s) => s.generate);
  const cancelGeneration = useAppStore((s) => s.cancelGeneration);

  const busy = status !== "idle";
  const overLimit = text.length > MAX_INPUT_CHARS;
  const ready = Boolean(ollamaStatus?.running) && models.length > 0;

  const insertExample = () => {
    const example = EXAMPLES[exampleIndex % EXAMPLES.length];
    setText(example.text);
    setExampleIndex((index) => index + 1);
  };

  return (
    <aside
      className="flex h-full w-[380px] shrink-0 flex-col border-r"
      style={{ background: "var(--ov-panel)", borderColor: "var(--ov-border)" }}
    >
      <header
        className="flex items-center justify-between gap-2 border-b px-4 py-3"
        style={{ borderColor: "var(--ov-border)" }}
      >
        <div className="flex items-center gap-2">
          <span
            className="flex h-7 w-7 items-center justify-center rounded-lg"
            style={{ background: "var(--ov-accent)", color: "var(--ov-accent-contrast)" }}
            aria-hidden="true"
          >
            <SparkIcon />
          </span>
          <div>
            <h1 className="ov-display text-base leading-tight">OpenVisual Local</h1>
            <p className="text-xs" style={{ color: "var(--ov-muted)" }}>
              Text to editable diagrams
            </p>
          </div>
        </div>
        <IconButton label="Saved projects" onClick={onOpenProjects}>
          <FolderIcon />
        </IconButton>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        <div>
          <div className="mb-1.5 flex items-baseline justify-between">
            <label htmlFor="ov-source-text" className="ov-field mb-0">
              Your text
            </label>
            <button
              type="button"
              className="text-xs underline"
              style={{ color: "var(--ov-muted)" }}
              onClick={insertExample}
            >
              Use an example
            </button>
          </div>
          <textarea
            id="ov-source-text"
            className="ov-textarea"
            rows={11}
            value={text}
            spellCheck
            placeholder="Paste or write the idea you want to see as a diagram…"
            onChange={(event) => setText(event.target.value)}
            aria-describedby="ov-char-count"
          />
          <div className="mt-1.5 flex items-center justify-between text-xs">
            <span
              id="ov-char-count"
              style={{ color: overLimit ? "var(--ov-danger)" : "var(--ov-muted)" }}
            >
              {text.length.toLocaleString()} / {MAX_INPUT_CHARS.toLocaleString()} characters
            </span>
            <button
              type="button"
              className="inline-flex items-center gap-1 underline"
              style={{ color: "var(--ov-muted)" }}
              onClick={() => setText("")}
              disabled={!text}
            >
              <TrashIcon /> Clear
            </button>
          </div>
        </div>

        <div>
          <label htmlFor="ov-type" className="ov-field">
            Diagram type
          </label>
          <select
            id="ov-type"
            className="ov-select"
            value={requestedType}
            onChange={(event) => setRequestedType(event.target.value as RequestedDiagramType)}
          >
            <option value="auto">{TYPE_LABELS.auto}</option>
            {DIAGRAM_TYPES.map((type) => (
              <option key={type} value={type}>
                {TYPE_LABELS[type]}
              </option>
            ))}
          </select>
          {spec && requestedType !== "auto" && requestedType !== spec.type && (
            <button
              type="button"
              className="mt-2 text-xs underline"
              style={{ color: "var(--ov-accent)" }}
              onClick={() => void generate("change_type", requestedType)}
              disabled={busy}
            >
              Redraw as {TYPE_LABELS[requestedType]}
            </button>
          )}
        </div>

        <div>
          <span className="ov-field" id="ov-detail-label">
            Detail
          </span>
          <div className="ov-segment" role="group" aria-labelledby="ov-detail-label">
            {DETAIL_LEVELS.map((level) => (
              <button
                key={level}
                type="button"
                aria-pressed={detail === level}
                onClick={() => setDetail(level)}
              >
                {level[0].toUpperCase() + level.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="ov-theme" className="ov-field">
            Theme
          </label>
          <select
            id="ov-theme"
            className="ov-select"
            value={themeId}
            onChange={(event) => setTheme(event.target.value as (typeof THEME_LIST)[number]["id"])}
          >
            {THEME_LIST.map((theme) => (
              <option key={theme.id} value={theme.id}>
                {theme.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="ov-model" className="ov-field">
            Local model
          </label>
          <select
            id="ov-model"
            className="ov-select"
            value={model}
            disabled={models.length === 0}
            onChange={(event) => setModel(event.target.value)}
          >
            {models.length === 0 && <option value={model}>{model} (not installed)</option>}
            {models.map((installed) => (
              <option key={installed.name} value={installed.name}>
                {installed.name}
                {installed.parameterSize ? ` · ${installed.parameterSize}` : ""}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="mt-2 inline-flex items-center gap-1.5 text-xs underline"
            style={{ color: ready ? "var(--ov-muted)" : "var(--ov-danger)" }}
            onClick={onOpenSetup}
          >
            {!ready && <AlertIcon />}
            {ready
              ? `Ollama running${ollamaStatus?.version ? ` · v${ollamaStatus.version}` : ""}`
              : "Ollama is not ready — open setup"}
          </button>
        </div>
      </div>

      <div className="space-y-3 border-t px-4 py-4" style={{ borderColor: "var(--ov-border)" }}>
        {busy ? (
          <button type="button" className="ov-btn w-full" onClick={cancelGeneration}>
            <StopIcon />
            Stop generation
          </button>
        ) : (
          <button
            type="button"
            className="ov-btn ov-btn-primary w-full"
            onClick={() => void generate(spec ? "regenerate" : "generate")}
            disabled={!text.trim() || overLimit}
          >
            <SparkIcon />
            Generate visual
          </button>
        )}

        {status === "generating" && (
          <p className="text-center text-xs" style={{ color: "var(--ov-muted)" }}>
            <Spinner label={`Thinking locally with ${model}…`} />
          </p>
        )}

        <p
          className="flex items-start gap-2 rounded-lg px-3 py-2 text-xs"
          style={{ background: "var(--ov-panel-alt)", color: "var(--ov-muted)" }}
        >
          <LockIcon />
          <span>Everything runs locally. Your text never leaves this computer.</span>
        </p>
      </div>
    </aside>
  );
}
