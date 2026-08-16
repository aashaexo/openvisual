import { ExportMenu } from "@/components/canvas/ExportMenu";
import { IconButton } from "@/components/ui/IconButton";
import {
  FitIcon,
  LayoutIcon,
  MinusIcon,
  PlusIcon,
  RedoIcon,
  RefreshIcon,
  SaveIcon,
  UndoIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from "@/components/ui/Icons";
import { getCanvasApi } from "@/store/canvasBridge";
import { useAppStore } from "@/store/appStore";

const ZOOM_STEP = 1.2;
const ZOOM_MIN = 0.1;
const ZOOM_MAX = 10;

export function CanvasToolbar() {
  const status = useAppStore((s) => s.status);
  const spec = useAppStore((s) => s.spec);
  const elements = useAppStore((s) => s.elements);
  const projectName = useAppStore((s) => s.currentProjectName);
  const setProjectName = useAppStore((s) => s.setProjectName);
  const renameCurrentProject = useAppStore((s) => s.renameCurrentProject);
  const saveStatus = useAppStore((s) => s.saveStatus);
  const storageAvailable = useAppStore((s) => s.storageAvailable);
  const autoLayout = useAppStore((s) => s.autoLayout);
  const generate = useAppStore((s) => s.generate);
  const saveCurrentProject = useAppStore((s) => s.saveCurrentProject);

  const busy = status !== "idle";
  const hasDiagram = elements.length > 0;

  return (
    <div
      className="flex flex-wrap items-center gap-2 border-b px-3 py-2"
      style={{ background: "var(--ov-panel)", borderColor: "var(--ov-border)" }}
    >
      <label className="sr-only" htmlFor="ov-project-name">
        Project name
      </label>
      <input
        id="ov-project-name"
        className="ov-input h-8 w-52 shrink-0"
        value={projectName}
        onChange={(event) => setProjectName(event.target.value)}
        onBlur={(event) => void renameCurrentProject(event.target.value)}
        placeholder="Untitled diagram"
      />

      <div
        className="mx-1 h-5 w-px"
        style={{ background: "var(--ov-border)" }}
        aria-hidden="true"
      />

      <div className="flex items-center gap-1">
        <IconButton label="Undo" onClick={() => sendShortcut("z", false)} disabled={!hasDiagram}>
          <UndoIcon />
        </IconButton>
        <IconButton label="Redo" onClick={() => sendShortcut("z", true)} disabled={!hasDiagram}>
          <RedoIcon />
        </IconButton>
        <IconButton label="Zoom out" onClick={() => zoomBy(1 / ZOOM_STEP)} disabled={!hasDiagram}>
          <ZoomOutIcon />
        </IconButton>
        <IconButton label="Zoom in" onClick={() => zoomBy(ZOOM_STEP)} disabled={!hasDiagram}>
          <ZoomInIcon />
        </IconButton>
        <IconButton label="Fit to screen" onClick={fitToScreen} disabled={!hasDiagram}>
          <FitIcon />
        </IconButton>
      </div>

      <div
        className="mx-1 h-5 w-px"
        style={{ background: "var(--ov-border)" }}
        aria-hidden="true"
      />

      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          className="ov-btn"
          onClick={() => void autoLayout()}
          disabled={!spec || busy}
          title="Recalculate positions without calling the model"
        >
          <LayoutIcon />
          Auto-layout
        </button>
        <button
          type="button"
          className="ov-btn"
          onClick={() => void generate("regenerate")}
          disabled={!spec || busy}
        >
          <RefreshIcon />
          Regenerate
        </button>
        <button
          type="button"
          className="ov-btn"
          onClick={() => void generate("simplify")}
          disabled={!spec || busy}
        >
          <MinusIcon />
          Simplify
        </button>
        <button
          type="button"
          className="ov-btn"
          onClick={() => void generate("add_detail")}
          disabled={!spec || busy}
        >
          <PlusIcon />
          Add detail
        </button>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <span className="text-xs" style={{ color: "var(--ov-muted)" }} aria-live="polite">
          {!storageAvailable
            ? "Local saving unavailable"
            : saveStatus === "saving"
              ? "Saving…"
              : saveStatus === "saved"
                ? "Saved locally"
                : ""}
        </span>
        <button
          type="button"
          className="ov-btn"
          onClick={() => void saveCurrentProject()}
          disabled={!spec || !storageAvailable}
        >
          <SaveIcon />
          Save
        </button>
        <ExportMenu />
      </div>
    </div>
  );
}

function zoomBy(factor: number): void {
  const api = getCanvasApi();
  if (!api) return;
  const current = api.getAppState().zoom.value;
  const next = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, current * factor));
  api.updateScene({ appState: { zoom: { value: next as typeof current } } });
}

function fitToScreen(): void {
  const api = getCanvasApi();
  if (!api) return;
  api.scrollToContent(api.getSceneElements(), { fitToContent: true, animate: false });
}

/**
 * Excalidraw owns its own history, and its imperative API does not expose undo
 * or redo, so the toolbar replays the keyboard shortcut the editor listens for.
 */
function sendShortcut(key: string, shift: boolean): void {
  const target =
    document.querySelector<HTMLElement>(".excalidraw canvas") ??
    document.querySelector<HTMLElement>(".excalidraw");
  if (!target) return;

  target.focus();
  const isMac = navigator.platform.toLowerCase().includes("mac");
  const init: KeyboardEventInit = {
    key,
    code: `Key${key.toUpperCase()}`,
    bubbles: true,
    cancelable: true,
    shiftKey: shift,
    ctrlKey: !isMac,
    metaKey: isMac,
  };
  target.dispatchEvent(new KeyboardEvent("keydown", init));
  target.dispatchEvent(new KeyboardEvent("keyup", init));
}
