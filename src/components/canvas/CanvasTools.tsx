import { useEffect } from "react";
import {
  ArrowIcon,
  CircleIcon,
  CursorIcon,
  PenIcon,
  SquareIcon,
  TextIcon,
} from "@/components/ui/Icons";
import { useAppStore, type CanvasToolType } from "@/store/appStore";

interface Tool {
  type: CanvasToolType;
  label: string;
  shortcut: string;
  Icon: (props: { className?: string }) => React.ReactElement;
}

const TOOLS: Tool[] = [
  { type: "selection", label: "Select", shortcut: "V", Icon: CursorIcon },
  { type: "rectangle", label: "Rectangle", shortcut: "R", Icon: SquareIcon },
  { type: "ellipse", label: "Ellipse", shortcut: "O", Icon: CircleIcon },
  { type: "arrow", label: "Arrow", shortcut: "A", Icon: ArrowIcon },
  { type: "freedraw", label: "Draw", shortcut: "P", Icon: PenIcon },
  { type: "text", label: "Text", shortcut: "T", Icon: TextIcon },
];

/**
 * Our own drawing tools.
 *
 * Excalidraw's native chrome is hidden (see index.css) so the canvas reads as
 * part of this app rather than as an embedded drawing editor — which means the
 * tools it would normally provide have to be offered here.
 */
export function CanvasTools() {
  const activeTool = useAppStore((s) => s.activeTool);
  const setActiveTool = useAppStore((s) => s.setActiveTool);
  const presenting = useAppStore((s) => s.presenting);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      // Never steal a keystroke that belongs to something the user is typing
      // in. The instanceof guard matters: the event target is not always an
      // element, and calling closest() on window or document throws.
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) ||
          target.closest(".excalidraw-textEditorContainer"))
      ) {
        return;
      }

      const tool = TOOLS.find((item) => item.shortcut.toLowerCase() === event.key.toLowerCase());
      if (!tool) return;

      event.preventDefault();
      setActiveTool(tool.type);
    };

    // Capture phase: Excalidraw stops keydown propagating out of its canvas, so
    // a bubble-phase listener on window would never see these keys at all.
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [setActiveTool]);

  if (presenting) return null;

  return (
    <div
      role="toolbar"
      aria-label="Drawing tools"
      aria-orientation="vertical"
      className="ov-panel absolute left-3 top-3 z-20 flex flex-col gap-1 rounded-xl border p-1 shadow-lg"
    >
      {TOOLS.map(({ type, label, shortcut, Icon }) => {
        const active = activeTool === type;
        return (
          <button
            key={type}
            type="button"
            aria-label={`${label} (${shortcut})`}
            aria-pressed={active}
            data-tip={`${label} (${shortcut})`}
            className="ov-tip flex h-8 w-8 items-center justify-center rounded-lg border-0"
            style={{
              background: active ? "var(--ov-accent)" : "transparent",
              color: active ? "var(--ov-accent-contrast)" : "var(--ov-text)",
              cursor: "pointer",
            }}
            onClick={() => setActiveTool(type)}
          >
            <Icon />
          </button>
        );
      })}
    </div>
  );
}
