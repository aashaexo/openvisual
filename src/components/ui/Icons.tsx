/**
 * Inline icons. Nothing is fetched from an icon CDN — these ship in the bundle.
 */
interface IconProps {
  className?: string;
}

const base = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  focusable: false,
};

export const SparkIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9L12 3z" />
    <path d="M18 15l.9 2.1L21 18l-2.1.9L18 21l-.9-2.1L15 18l2.1-.9L18 15z" />
  </svg>
);

export const StopIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <rect x="6" y="6" width="12" height="12" rx="2" />
  </svg>
);

export const TrashIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3" />
  </svg>
);

export const ZoomInIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <circle cx="11" cy="11" r="6" />
    <path d="M20 20l-3.5-3.5M11 8.5v5M8.5 11h5" />
  </svg>
);

export const ZoomOutIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <circle cx="11" cy="11" r="6" />
    <path d="M20 20l-3.5-3.5M8.5 11h5" />
  </svg>
);

export const FitIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M4 9V5h4M20 9V5h-4M4 15v4h4M20 15v4h-4" />
  </svg>
);

export const UndoIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M9 7L4 12l5 5" />
    <path d="M4 12h9a6 6 0 0 1 0 12h-1" />
  </svg>
);

export const RedoIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M15 7l5 5-5 5" />
    <path d="M20 12h-9a6 6 0 0 0 0 12h1" />
  </svg>
);

export const LayoutIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="8.5" y="14" width="7" height="7" rx="1.5" />
    <path d="M6.5 10v2.5h11V10" />
  </svg>
);

export const RefreshIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M20 11a8 8 0 0 0-13.7-5.6L4 7.5" />
    <path d="M4 4v3.5h3.5" />
    <path d="M4 13a8 8 0 0 0 13.7 5.6L20 16.5" />
    <path d="M20 20v-3.5h-3.5" />
  </svg>
);

export const MinusIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M5 12h14" />
  </svg>
);

export const PlusIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const DownloadIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M12 4v10m0 0l-4-4m4 4l4-4" />
    <path d="M5 18h14" />
  </svg>
);

export const CopyIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15V5a2 2 0 0 1 2-2h8" />
  </svg>
);

export const CheckIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M5 12.5l4.5 4.5L19 7" />
  </svg>
);

export const FolderIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
  </svg>
);

export const SaveIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M5 4h11l3 3v13H5z" />
    <path d="M9 4v5h6V4M8 20v-6h8v6" />
  </svg>
);

export const AlertIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M12 4l9 16H3l9-16z" />
    <path d="M12 10v4M12 17.5v.01" />
  </svg>
);

export const LockIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <rect x="5" y="11" width="14" height="9" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </svg>
);

export const CloseIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);
