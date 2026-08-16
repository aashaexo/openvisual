import { useEffect, useRef, useState } from "react";
import { CopyIcon, DownloadIcon } from "@/components/ui/Icons";
import { useAppStore } from "@/store/appStore";
import type { ExportFormat } from "@/export";

const FORMATS: Array<{ format: ExportFormat; label: string; hint: string }> = [
  { format: "png", label: "PNG image", hint: "Raster, good for slides and chat" },
  { format: "svg", label: "SVG vector", hint: "Scales cleanly, editable in design tools" },
  { format: "excalidraw", label: ".excalidraw scene", hint: "Re-openable, keeps every element" },
  { format: "json", label: "Diagram JSON", hint: "The semantic spec behind the drawing" },
];

const SCALES = [1, 2, 3] as const;

export function ExportMenu() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const exportScale = useAppStore((s) => s.exportScale);
  const setExportScale = useAppStore((s) => s.setExportScale);
  const transparent = useAppStore((s) => s.transparentBackground);
  const setTransparent = useAppStore((s) => s.setTransparentBackground);
  const exportCurrent = useAppStore((s) => s.exportCurrent);
  const copyPng = useAppStore((s) => s.copyPng);
  const hasDiagram = useAppStore((s) => s.elements.length > 0);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        className="ov-btn"
        onClick={() => setOpen((value) => !value)}
        disabled={!hasDiagram}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <DownloadIcon />
        Export
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Export options"
          className="ov-panel absolute right-0 z-40 mt-2 w-72 rounded-xl border p-2 shadow-xl"
        >
          {FORMATS.map((item) => (
            <button
              key={item.format}
              type="button"
              role="menuitem"
              className="w-full rounded-lg px-2.5 py-2 text-left hover:bg-[var(--ov-panel-alt)]"
              onClick={() => {
                setOpen(false);
                void exportCurrent(item.format);
              }}
            >
              <span className="block text-sm font-medium">{item.label}</span>
              <span className="block text-xs" style={{ color: "var(--ov-muted)" }}>
                {item.hint}
              </span>
            </button>
          ))}

          <button
            type="button"
            role="menuitem"
            className="mt-1 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-[var(--ov-panel-alt)]"
            onClick={() => {
              setOpen(false);
              void copyPng();
            }}
          >
            <CopyIcon />
            Copy PNG to clipboard
          </button>

          <div className="mt-2 border-t pt-2" style={{ borderColor: "var(--ov-border)" }}>
            <span className="ov-field" id="ov-export-scale">
              Image scale
            </span>
            <div className="ov-segment" role="group" aria-labelledby="ov-export-scale">
              {SCALES.map((scale) => (
                <button
                  key={scale}
                  type="button"
                  aria-pressed={exportScale === scale}
                  onClick={() => setExportScale(scale)}
                >
                  {scale}x
                </button>
              ))}
            </div>

            <label className="mt-2 flex items-center gap-2 px-0.5 text-sm">
              <input
                type="checkbox"
                checked={transparent}
                onChange={(event) => setTransparent(event.target.checked)}
              />
              Transparent background
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
