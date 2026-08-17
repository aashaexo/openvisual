import { IconButton } from "@/components/ui/IconButton";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  PlayIcon,
  PlusIcon,
  TrashIcon,
} from "@/components/ui/Icons";
import { useAppStore } from "@/store/appStore";

/**
 * The deck. Each slide carries its own source text and its own diagram, so a
 * presentation is built one idea at a time rather than crammed onto one canvas.
 */
export function SlideRail() {
  const slides = useAppStore((s) => s.slides);
  const activeSlideId = useAppStore((s) => s.activeSlideId);
  const addSlide = useAppStore((s) => s.addSlide);
  const selectSlide = useAppStore((s) => s.selectSlide);
  const duplicateSlide = useAppStore((s) => s.duplicateSlide);
  const deleteSlide = useAppStore((s) => s.deleteSlide);
  const moveSlide = useAppStore((s) => s.moveSlide);
  const setPresenting = useAppStore((s) => s.setPresenting);
  const spec = useAppStore((s) => s.spec);

  const activeIndex = slides.findIndex((slide) => slide.id === activeSlideId);
  const canPresent = slides.some((slide) => slide.diagramSpec !== null) || spec !== null;

  return (
    <div
      className="flex shrink-0 items-center gap-2 border-t px-3 py-2"
      style={{ background: "var(--ov-panel)", borderColor: "var(--ov-border)" }}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto">
        {slides.map((slide, index) => {
          const active = slide.id === activeSlideId;
          // The live spec is authoritative for the slide being edited.
          const title = (active ? (spec?.title ?? null) : slide.diagramSpec?.title) ?? slide.name;

          return (
            <button
              key={slide.id}
              type="button"
              onClick={() => selectSlide(slide.id)}
              aria-current={active ? "true" : undefined}
              className="flex h-12 w-36 shrink-0 flex-col justify-center rounded-lg border px-2 text-left"
              style={{
                borderColor: active ? "var(--ov-accent)" : "var(--ov-border)",
                background: active ? "var(--ov-panel-alt)" : "transparent",
                boxShadow: active ? "0 0 0 1px var(--ov-accent)" : "none",
                cursor: "pointer",
              }}
            >
              <span className="text-[10px] font-semibold" style={{ color: "var(--ov-muted)" }}>
                {index + 1}
              </span>
              <span className="truncate text-xs font-medium">{title}</span>
            </button>
          );
        })}

        <IconButton label="Add slide" onClick={addSlide} className="shrink-0">
          <PlusIcon />
        </IconButton>
      </div>

      <div
        className="flex shrink-0 items-center gap-1 border-l pl-2"
        style={{ borderColor: "var(--ov-border)" }}
      >
        <IconButton
          label="Move slide left"
          onClick={() => activeSlideId && moveSlide(activeSlideId, -1)}
          disabled={activeIndex <= 0}
        >
          <ChevronLeftIcon />
        </IconButton>
        <IconButton
          label="Move slide right"
          onClick={() => activeSlideId && moveSlide(activeSlideId, 1)}
          disabled={activeIndex === -1 || activeIndex >= slides.length - 1}
        >
          <ChevronRightIcon />
        </IconButton>
        <IconButton
          label="Duplicate slide"
          onClick={() => activeSlideId && duplicateSlide(activeSlideId)}
          disabled={!activeSlideId}
        >
          <CopyIcon />
        </IconButton>
        <IconButton
          label="Delete slide"
          className="ov-btn-danger"
          onClick={() => activeSlideId && deleteSlide(activeSlideId)}
          disabled={slides.length <= 1}
        >
          <TrashIcon />
        </IconButton>
        <button
          type="button"
          className="ov-btn ml-1"
          onClick={() => setPresenting(true)}
          disabled={!canPresent}
        >
          <PlayIcon />
          Present
        </button>
      </div>
    </div>
  );
}
