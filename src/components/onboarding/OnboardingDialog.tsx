import { useEffect } from "react";
import { DEFAULT_MODEL } from "@/ai/client";
import { CopyCommand } from "@/components/ui/CopyCommand";
import { Modal } from "@/components/ui/Modal";
import { Spinner } from "@/components/ui/Spinner";
import { AlertIcon, CheckIcon, RefreshIcon } from "@/components/ui/Icons";
import { useAppStore } from "@/store/appStore";

type StepState = "ok" | "todo" | "checking";

/**
 * First-run setup. It only ever *tells* the user what to run — the app never
 * installs Homebrew, Ollama or a model on their behalf.
 */
/** How often the setup dialog re-checks while something is still missing. */
const RECHECK_INTERVAL_MS = 4000;

export function OnboardingDialog() {
  const open = useAppStore((s) => s.onboardingOpen);
  const setOpen = useAppStore((s) => s.setOnboardingOpen);
  const complete = useAppStore((s) => s.completeOnboarding);
  const refresh = useAppStore((s) => s.refreshEnvironment);
  const checking = useAppStore((s) => s.environmentChecking);
  const status = useAppStore((s) => s.ollamaStatus);
  const models = useAppStore((s) => s.models);
  const model = useAppStore((s) => s.model);
  const setModel = useAppStore((s) => s.setModel);

  const running = Boolean(status?.running);
  const hasModels = models.length > 0;
  const hasRecommended = models.some((m) => m.name === DEFAULT_MODEL);
  const allGood = running && hasModels;

  /*
   * While the dialog is open with something missing, the user is off in a
   * terminal running the very commands it is showing them. Polling means the
   * ticks turn green the moment the command lands, instead of leaving them to
   * guess that "Check again" is required.
   */
  useEffect(() => {
    if (!open || allGood) return;

    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, RECHECK_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [open, allGood, refresh]);

  const stepState = (done: boolean): StepState => (checking ? "checking" : done ? "ok" : "todo");

  return (
    <Modal
      open={open}
      title="Set up your local model"
      description="OpenVisual Local runs entirely on this computer. It needs Ollama and one model."
      onClose={() => setOpen(false)}
      width="md"
      footer={
        <>
          <button
            type="button"
            className="ov-btn"
            onClick={() => void refresh()}
            disabled={checking}
          >
            <RefreshIcon />
            Check again
          </button>
          <button
            type="button"
            className="ov-btn ov-btn-primary"
            onClick={complete}
            disabled={!allGood}
          >
            {allGood ? "Start using OpenVisual" : "Waiting for Ollama"}
          </button>
        </>
      }
    >
      <ol className="space-y-5">
        <Step
          index={1}
          state={stepState(running)}
          title="Ollama is installed and running"
          detail={
            running
              ? `Reachable on 127.0.0.1:11434${status?.version ? ` · version ${status.version}` : ""}`
              : "OpenVisual could not reach the local Ollama server."
          }
        >
          {!running && (
            <div className="space-y-2">
              <CopyCommand command="brew install ollama" caption="Install it (macOS, Homebrew):" />
              <CopyCommand command="ollama serve" caption="Then start the local server:" />
              <p className="text-xs" style={{ color: "var(--ov-muted)" }}>
                On Linux or Windows, follow the installer on ollama.com — this app will not download
                or install anything for you.
              </p>
            </div>
          )}
        </Step>

        <Step
          index={2}
          state={stepState(hasModels)}
          title="At least one model is installed"
          detail={
            hasModels
              ? `${models.length} model${models.length === 1 ? "" : "s"} available locally`
              : "Ollama has no models yet."
          }
        >
          {running && !hasModels && (
            <CopyCommand
              command={`ollama pull ${DEFAULT_MODEL}`}
              caption="Pull the recommended model:"
            />
          )}
        </Step>

        <Step
          index={3}
          state={stepState(hasRecommended)}
          title={`The recommended model (${DEFAULT_MODEL}) is available`}
          detail={
            hasRecommended
              ? "Ready to generate."
              : hasModels
                ? "Optional — you can use any installed model instead."
                : "Recommended for a good balance of speed and structure."
          }
        >
          {running && hasModels && !hasRecommended && (
            <div className="space-y-2">
              <CopyCommand command={`ollama pull ${DEFAULT_MODEL}`} />
              <label className="block">
                <span className="ov-field">Or pick an installed model</span>
                <select
                  className="ov-select"
                  value={model}
                  onChange={(event) => setModel(event.target.value)}
                >
                  {models.map((installed) => (
                    <option key={installed.name} value={installed.name}>
                      {installed.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
        </Step>
      </ol>

      <p className="mt-5 text-xs" style={{ color: "var(--ov-muted)" }}>
        No account, no API key, no internet connection is required once Ollama and a model are
        installed.
      </p>
    </Modal>
  );
}

interface StepProps {
  index: number;
  state: StepState;
  title: string;
  detail: string;
  children?: React.ReactNode;
}

function Step({ index, state, title, detail, children }: StepProps) {
  return (
    <li className="flex gap-3">
      <span
        className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
        style={{
          background: state === "ok" ? "var(--ov-accent)" : "var(--ov-panel-alt)",
          color: state === "ok" ? "var(--ov-accent-contrast)" : "var(--ov-muted)",
          border: "1px solid var(--ov-border)",
        }}
        aria-hidden="true"
      >
        {state === "ok" ? <CheckIcon /> : index}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{title}</p>
        <p
          className="mt-0.5 flex items-center gap-1.5 text-xs"
          style={{ color: "var(--ov-muted)" }}
        >
          {state === "checking" ? (
            <Spinner label="Checking…" />
          ) : (
            <>
              {state === "todo" && <AlertIcon />}
              {detail}
            </>
          )}
        </p>
        {children && <div className="mt-2.5">{children}</div>}
      </div>
    </li>
  );
}
