import type { ButtonHTMLAttributes, ReactNode } from "react";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Doubles as the accessible name and the tooltip text. */
  label: string;
  children: ReactNode;
}

/**
 * Icon-only control. The label is always exposed to assistive technology and
 * shown as a tooltip on hover and on keyboard focus.
 */
export function IconButton({ label, children, className = "", ...rest }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      data-tip={label}
      className={`ov-btn ov-btn-icon ov-tip ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
