import { useEffect, useMemo, useRef, useState } from "react";
import { exportToSvg } from "@excalidraw/excalidraw";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import { CloseIcon } from "@/components/ui/Icons";
import { IconButton } from "@/components/ui/IconButton";
import { useAppStore } from "@/store/appStore";
import { getTheme } from "@/themes";
import { log } from "@/utils/logger";

/**
 * Fullscreen playback of the deck.
 *
 * Each slide is rendered to a static SVG rather than mounting a second
 * Excalidraw: presenting is a read-only act, and a live editor behind a
 * fullscreen overlay invites accidental edits.
 */
export function PresentMode() {
  const presenting = useAppStore((s) => s.presenting);
  const setPresenting = useAppStore((s) => s.setPresenting);
  const stepSlide = useAppStore((s) => s.stepSlide);
  const slides = useAppStore((s) => s.slides);
  const activeSlideId = useAppStore((s) => s.activeSlideId);
  const elements = useAppStore((s) => s.elements);
  const files = useAppStore((s) => s.files);
  const themeId = useAppStore((s) => s.themeId);

  const [failed, setFailed] = useState(false);
  const stage = useRef<HTMLDivElement>(null);

  const alive = useMemo(() => elements.filter((element) => !element.isDeleted), [elements]);
  const empty = alive.length === 0 || failed;

  const index = slides.findIndex((slide) => slide.id === activeSlideId);
  const theme = getTheme(themeId);

  useEffect(() => {
    if (!presenting) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPresenting(false);
      else if (["ArrowRight", "ArrowDown", " ", "PageDown"].includes(event.key)) stepSlide(1);
      else if (["ArrowLeft", "ArrowUp", "PageUp"].includes(event.key)) stepSlide(-1);
      else return;
      event.preventDefault();
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [presenting, setPresenting, stepSlide]);

  useEffect(() => {
    if (!presenting) return;

    if (alive.length === 0) return;
    let cancelled = false;

    void exportToSvg({
      elements: alive as readonly ExcalidrawElement[],
      appState: {
        exportBackground: false,
        exportWithDarkMode: false,
        viewBackgroundColor: theme.canvas.background,
      },
      files,
      exportPadding: 32,
    })
      .then((svg: SVGSVGElement) => {
        const host = stage.current;
        if (cancelled || !host) return;

        // The node is attached directly rather than through innerHTML: this app
        // never turns generated markup back into parsed HTML.
        svg.removeAttribute("width");
        svg.removeAttribute("height");
        svg.setAttribute("style", "max-width:100%;max-height:100%;height:auto;width:auto");
        host.replaceChildren(svg);
      })
      .catch((error: unknown) => {
        log.warn("present", "could not render the slide", error);
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [presenting, alive, files, theme.canvas.background]);

  if (!presenting) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col"
      style={{ background: theme.canvas.background }}
      role="dialog"
      aria-modal="true"
      aria-label={`Presenting slide ${index + 1} of ${slides.length}`}
    >
      <div className="absolute right-4 top-4 z-10">
        <IconButton label="Exit presentation (Esc)" onClick={() => setPresenting(false)}>
          <CloseIcon />
        </IconButton>
      </div>

      <div
        className="flex min-h-0 flex-1 items-center justify-center p-10"
        onClick={() => stepSlide(1)}
      >
        {empty ? (
          <p style={{ color: theme.title.subtitleColor }}>This slide has nothing on it yet.</p>
        ) : (
          <div ref={stage} className="flex h-full w-full items-center justify-center" />
        )}
      </div>

      <div
        className="flex items-center justify-center gap-4 pb-5 text-sm"
        style={{ color: theme.title.subtitleColor }}
      >
        <button
          type="button"
          className="ov-btn"
          onClick={() => stepSlide(-1)}
          disabled={index <= 0}
        >
          Previous
        </button>
        <span aria-live="polite">
          {index + 1} / {slides.length}
        </span>
        <button
          type="button"
          className="ov-btn"
          onClick={() => stepSlide(1)}
          disabled={index >= slides.length - 1}
        >
          Next
        </button>
      </div>
    </div>
  );
}
