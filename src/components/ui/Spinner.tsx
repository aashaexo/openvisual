interface SpinnerProps {
  className?: string;
  label?: string;
}

export function Spinner({ className = "", label }: SpinnerProps) {
  return (
    <span className="inline-flex items-center gap-2" role="status" aria-live="polite">
      <svg
        className={`ov-spinner ${className}`}
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        focusable="false"
      >
        <circle
          cx="12"
          cy="12"
          r="9"
          stroke="currentColor"
          strokeOpacity="0.25"
          strokeWidth="2.5"
        />
        <path
          d="M21 12a9 9 0 0 0-9-9"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
      {label && <span>{label}</span>}
    </span>
  );
}
