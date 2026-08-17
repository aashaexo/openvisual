import { useEffect, useRef, type ReactNode } from "react";
import { IconButton } from "@/components/ui/IconButton";
import { CloseIcon } from "@/components/ui/Icons";

interface ModalProps {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  /** Set for flows the user must resolve, such as first-run setup. */
  dismissible?: boolean;
  width?: "sm" | "md" | "lg";
}

const WIDTHS = { sm: "28rem", md: "36rem", lg: "48rem" } as const;

/**
 * A small accessible dialog: labelled, escapable, focus moved in on open and
 * returned to the trigger on close, with focus kept inside while it is open.
 */
export function Modal({
  open,
  title,
  description,
  onClose,
  children,
  footer,
  dismissible = true,
  width = "md",
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    focusables(panel)[0]?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && dismissible) {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const targets = focusables(panelRef.current);
      if (targets.length === 0) return;

      const first = targets[0];
      const last = targets[targets.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      previouslyFocused.current?.focus?.();
    };
  }, [open, dismissible, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgb(0 0 0 / 0.45)" }}
      onMouseDown={(event) => {
        if (dismissible && event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ov-modal-title"
        aria-describedby={description ? "ov-modal-description" : undefined}
        className="ov-panel w-full overflow-hidden rounded-2xl border shadow-2xl"
        style={{ maxWidth: WIDTHS[width], maxHeight: "88vh" }}
      >
        <header
          className="flex items-start justify-between gap-4 border-b px-5 py-4"
          style={{ borderColor: "var(--ov-border)" }}
        >
          <div>
            <h2 id="ov-modal-title" className="ov-display text-xl">
              {title}
            </h2>
            {description && (
              <p
                id="ov-modal-description"
                className="mt-1 text-sm"
                style={{ color: "var(--ov-muted)" }}
              >
                {description}
              </p>
            )}
          </div>
          {dismissible && (
            <IconButton label="Close" onClick={onClose}>
              <CloseIcon />
            </IconButton>
          )}
        </header>

        <div className="overflow-y-auto px-5 py-4" style={{ maxHeight: "60vh" }}>
          {children}
        </div>

        {footer && (
          <footer
            className="flex items-center justify-end gap-2 border-t px-5 py-3"
            style={{ borderColor: "var(--ov-border)", background: "var(--ov-panel-alt)" }}
          >
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}

function focusables(root: HTMLElement | null): HTMLElement[] {
  if (!root) return [];
  return Array.from(
    root.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => element.offsetParent !== null || element === document.activeElement);
}
