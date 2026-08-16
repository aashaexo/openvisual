import { isTauri } from "@tauri-apps/api/core";
import type { SaveDialogOptions } from "@tauri-apps/plugin-dialog";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import { createAppError } from "@/utils/errors";
import { log } from "@/utils/logger";

/**
 * Writing a file is the only place the app leaves its own sandbox, and it has
 * to work twice: through the native save dialog inside the Tauri shell, and
 * through a plain object-URL download when the same UI runs in a browser tab
 * during `vite dev`.
 */

const FILTER_NAMES: Record<string, string> = {
  png: "PNG image",
  svg: "SVG image",
  excalidraw: "Excalidraw scene",
  json: "JSON",
};

/** Cancelling the dialog is a normal outcome, so it resolves without an error. */
export async function saveBlob(blob: Blob, suggestedName: string): Promise<void> {
  try {
    if (isTauri()) {
      await saveThroughDialog(blob, suggestedName);
      return;
    }
    downloadInBrowser(blob, suggestedName);
  } catch (error) {
    throw createAppError("export_failed", error);
  }
}

/** ASCII, lowercase and hyphenated, so the name survives every filesystem. */
export function suggestFileName(title: string, extension: string): string {
  const suffix = extension.startsWith(".") ? extension : `.${extension}`;
  return `${slugify(title)}${suffix}`;
}

async function saveThroughDialog(blob: Blob, suggestedName: string): Promise<void> {
  const extension = suggestedName.split(".").pop() ?? "";
  const filterName = FILTER_NAMES[extension];

  const options: SaveDialogOptions = { title: "Export diagram", defaultPath: suggestedName };
  if (filterName) {
    options.filters = [{ name: filterName, extensions: [extension] }];
  }

  const path = await save(options);
  if (path === null) {
    log.debug("export", "Save dialog dismissed");
    return;
  }

  await writeFile(path, new Uint8Array(await blob.arrayBuffer()));
  log.info("export", "Wrote file", { path, bytes: blob.size });
}

function downloadInBrowser(blob: Blob, suggestedName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = suggestedName;
  anchor.rel = "noopener";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  // Some browsers abort the download if the object URL is revoked in the same tick.
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function slugify(title: string): string {
  const slug = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 64)
    .replace(/^-+|-+$/g, "");
  return slug || "diagram";
}
