import { EXAMPLES } from "@/components/editor/examples";
import { useAppStore } from "@/store/appStore";

/** Shown before anything has been generated, with three one-click starters. */
export function EmptyState() {
  const setText = useAppStore((s) => s.setText);
  const setRequestedType = useAppStore((s) => s.setRequestedType);
  const generate = useAppStore((s) => s.generate);
  const ready = useAppStore((s) => Boolean(s.ollamaStatus?.running) && s.models.length > 0);

  const tryExample = (index: number) => {
    const example = EXAMPLES[index];
    setText(example.text);
    setRequestedType("auto");
    if (ready) void generate("generate");
  };

  return (
    <div className="flex h-full flex-col items-center justify-center px-8 text-center">
      <h2 className="ov-display text-2xl">Turn text into a diagram</h2>
      <p className="mt-1 max-w-md text-sm" style={{ color: "var(--ov-muted)" }}>
        Write or paste something on the left, then generate a visual. A local model reads the text,
        and the layout is drawn here — fully editable.
      </p>

      <div className="mt-6 grid w-full max-w-2xl gap-3 sm:grid-cols-3">
        {EXAMPLES.map((example, index) => (
          <button
            key={example.id}
            type="button"
            className="ov-panel rounded-xl border p-3 text-left transition hover:shadow-md"
            onClick={() => tryExample(index)}
          >
            <span className="block text-sm font-medium">{example.title}</span>
            <span className="mt-1 block text-xs" style={{ color: "var(--ov-muted)" }}>
              {example.blurb}
            </span>
          </button>
        ))}
      </div>

      {!ready && (
        <p className="mt-5 text-xs" style={{ color: "var(--ov-muted)" }}>
          These will fill in the text. Start Ollama to generate.
        </p>
      )}
    </div>
  );
}
