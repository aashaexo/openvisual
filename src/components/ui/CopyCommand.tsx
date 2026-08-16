import { useState } from "react";
import { CheckIcon, CopyIcon } from "@/components/ui/Icons";

interface CopyCommandProps {
  command: string;
  caption?: string;
}

/** A shell command with a copy button — used throughout onboarding. */
export function CopyCommand({ command, caption }: CopyCommandProps) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard access can be refused; the command is still selectable.
      setCopied(false);
    }
  };

  return (
    <div>
      {caption && (
        <p className="mb-1.5 text-sm" style={{ color: "var(--ov-muted)" }}>
          {caption}
        </p>
      )}
      <div className="flex items-stretch gap-2">
        <code className="ov-code flex-1">{command}</code>
        <button
          type="button"
          className="ov-btn shrink-0"
          onClick={copy}
          aria-label={`Copy command: ${command}`}
        >
          {copied ? <CheckIcon /> : <CopyIcon />}
          <span>{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>
    </div>
  );
}
