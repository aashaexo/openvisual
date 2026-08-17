import { useEffect, useMemo } from "react";
import { Excalidraw, MainMenu } from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { CanvasToolbar } from "@/components/canvas/CanvasToolbar";
import { CanvasTools } from "@/components/canvas/CanvasTools";
import { SlideRail } from "@/components/canvas/SlideRail";
import { EmptyState } from "@/components/canvas/EmptyState";
import { ErrorBanner } from "@/components/canvas/ErrorBanner";
import { Spinner } from "@/components/ui/Spinner";
import { setCanvasApi } from "@/store/canvasBridge";
import { useAppStore } from "@/store/appStore";
import { getTheme } from "@/themes";

export function CanvasPanel() {
  const themeId = useAppStore((s) => s.themeId);
  const theme = useMemo(() => getTheme(themeId), [themeId]);

  const status = useAppStore((s) => s.status);
  const error = useAppStore((s) => s.error);
  const warnings = useAppStore((s) => s.warnings);
  const lastMeta = useAppStore((s) => s.lastMeta);
  const hasDiagram = useAppStore((s) => s.elements.length > 0);
  const dismissError = useAppStore((s) => s.dismissError);
  const generate = useAppStore((s) => s.generate);
  const autoLayout = useAppStore((s) => s.autoLayout);
  const onSceneChange = useAppStore((s) => s.onSceneChange);

  useEffect(() => () => setCanvasApi(null), []);

  return (
    <section className="relative flex h-full min-w-0 flex-1 flex-col">
      <CanvasToolbar />

      {/* overflow-hidden so the empty state can never paint over the toolbar. */}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <div className="absolute inset-0" aria-label="Diagram canvas">
          <Excalidraw
            excalidrawAPI={(api: ExcalidrawImperativeAPI) => setCanvasApi(api)}
            onChange={onSceneChange}
            theme={theme.mode}
            initialData={{
              appState: {
                viewBackgroundColor: theme.canvas.background,
                gridSize: theme.canvas.gridSize ?? undefined,
                currentItemFontFamily: 2,
              },
              scrollToContent: true,
            }}
            // Excalidraw ships two doors to the network: its hosted "text to
            // diagram" service and embeddable remote iframes. Both are shut.
            aiEnabled={false}
            validateEmbeddable={false}
            UIOptions={{
              canvasActions: {
                // Loading a remote scene or exporting to a share link would
                // both leave the machine, so neither is offered.
                loadScene: false,
                saveToActiveFile: false,
                export: false,
                saveAsImage: false,
                toggleTheme: false,
              },
            }}
          >
            <MainMenu>
              <MainMenu.Item onSelect={() => void autoLayout()}>Auto-layout</MainMenu.Item>
              <MainMenu.DefaultItems.ClearCanvas />
              <MainMenu.Separator />
              <MainMenu.DefaultItems.ChangeCanvasBackground />
            </MainMenu>
          </Excalidraw>
        </div>

        <CanvasTools />

        {!hasDiagram && status === "idle" && (
          <div
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
            style={{ background: "var(--ov-bg)" }}
          >
            <div className="pointer-events-auto w-full">
              <EmptyState />
            </div>
          </div>
        )}

        {status !== "idle" && (
          <div className="absolute inset-x-0 top-0 flex justify-center pt-4" aria-live="polite">
            <div className="ov-panel rounded-full border px-4 py-2 text-sm shadow-lg">
              <Spinner
                label={
                  status === "generating" ? "Reading your text locally…" : "Arranging the diagram…"
                }
              />
            </div>
          </div>
        )}

        <div className="pointer-events-none absolute inset-x-0 top-0 z-30">
          {error && (
            <ErrorBanner
              error={error}
              onDismiss={dismissError}
              onRetry={error.retryable ? () => void generate("generate") : undefined}
            />
          )}

          {!error && warnings.length > 0 && (
            <div
              className="ov-panel pointer-events-auto mx-4 mt-3 rounded-xl border px-3 py-2 text-xs shadow"
              role="status"
            >
              {warnings.map((warning) => (
                <p key={warning} style={{ color: "var(--ov-muted)" }}>
                  {warning}
                </p>
              ))}
            </div>
          )}
        </div>

        {lastMeta && !error && (
          <p
            className="pointer-events-none absolute bottom-2 right-3 text-[11px]"
            style={{ color: "var(--ov-muted)" }}
          >
            {lastMeta.model} · {(lastMeta.durationMs / 1000).toFixed(1)}s
            {lastMeta.repaired ? " · repaired" : ""}
          </p>
        )}
      </div>

      <SlideRail />
    </section>
  );
}
