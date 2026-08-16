import { useState } from "react";
import { AlertIcon, CloseIcon } from "@/components/ui/Icons";
import { IconButton } from "@/components/ui/IconButton";
import type { AppError } from "@/types";

interface ErrorBannerProps {
  error: AppError;
  onDismiss: () => void;
  onRetry?: () => void;
}

/** User-facing failure surface. Raw detail stays collapsed and opt-in. */
export function ErrorBanner({ error, onDismiss, onRetry }: ErrorBannerProps) {
  const [showDetail, setShowDetail] = useState(false);

  return (
    <div
      role="alert"
      className="ov-panel pointer-events-auto mx-4 mt-3 rounded-xl border p-3 shadow-lg"
      style={{ borderColor: "color-mix(in srgb, var(--ov-danger) 40%, var(--ov-border))" }}
    >
      <div className="flex items-start gap-3">
        <span style={{ color: "var(--ov-danger)" }} aria-hidden="true">
          <AlertIcon />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{error.title}</p>
          <p className="mt-0.5 text-sm" style={{ color: "var(--ov-muted)" }}>
            {error.message}
          </p>
          {error.hint && (
            <p className="mt-1 text-xs" style={{ color: "var(--ov-muted)" }}>
              {error.hint}
            </p>
          )}

          <div className="mt-2 flex items-center gap-3">
            {error.retryable && onRetry && (
              <button type="button" className="ov-btn" onClick={onRetry}>
                Try again
              </button>
            )}
            {error.detail && (
              <button
                type="button"
                className="text-xs underline"
                style={{ color: "var(--ov-muted)" }}
                onClick={() => setShowDetail((value) => !value)}
                aria-expanded={showDetail}
              >
                {showDetail ? "Hide technical details" : "Technical details"}
              </button>
            )}
          </div>

          {showDetail && error.detail && (
            <pre className="ov-code mt-2 max-h-40 overflow-auto whitespace-pre-wrap">
              {error.detail}
            </pre>
          )}
        </div>
        <IconButton label="Dismiss" onClick={onDismiss}>
          <CloseIcon />
        </IconButton>
      </div>
    </div>
  );
}
