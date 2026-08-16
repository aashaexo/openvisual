import {
  exportToBlob,
  exportToClipboard,
  exportToSvg,
  serializeAsJSON,
} from "@excalidraw/excalidraw";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { AppState, BinaryFiles } from "@excalidraw/excalidraw/types";
import type { DiagramSpec } from "@/diagrams/schema";
import { saveBlob, suggestFileName } from "@/export/saveFile";
import type { DiagramTheme } from "@/themes";
import type { AppError } from "@/types";
import { createAppError, toAppError } from "@/utils/errors";
import { log } from "@/utils/logger";

/**
 * Turns the live Excalidraw scene into a file.
 *
 * Nothing is uploaded and nothing is rendered server-side: every format is
 * produced in the page and handed straight to the filesystem. Appearance comes
 * from the theme, never from whatever the canvas happened to be showing, so an
 * export looks the same whether the editor is scrolled, zoomed or half hidden.
 */

export type ExportFormat = "png" | "svg" | "excalidraw" | "json";
export type ExportScale = 1 | 2 | 3;

export interface ExportRequest {
  format: ExportFormat;
  scale: ExportScale;
  /** PNG and SVG only: drop the theme background instead of painting it. */
  transparent: boolean;
  elements: readonly ExcalidrawElement[];
  appState: Partial<AppState>;
  files: BinaryFiles | null;
  theme: DiagramTheme;
  spec: DiagramSpec | null;
}

/** Excalidraw's own 10px default crops the artwork uncomfortably close. */
const EXPORT_PADDING = 24;

const EXTENSION: Record<ExportFormat, string> = {
  png: "png",
  svg: "svg",
  excalidraw: "excalidraw",
  json: "json",
};

const MIME_TYPE: Record<ExportFormat, string> = {
  png: "image/png",
  svg: "image/svg+xml",
  excalidraw: "application/json",
  json: "application/json",
};

export async function exportDiagram(request: ExportRequest): Promise<void> {
  const { blob, fileName } = await buildExportBlob(request);
  await saveBlob(blob, fileName);
  log.info("export", "Exported diagram", {
    fileName,
    format: request.format,
    scale: request.scale,
    bytes: blob.size,
  });
}

export async function copyPngToClipboard(request: Omit<ExportRequest, "format">): Promise<void> {
  const elements = drawableElements(request.elements);
  if (elements.length === 0) {
    throw nothingToExport("There is nothing on the canvas to copy.");
  }

  try {
    await exportToClipboard({
      elements,
      appState: exportAppState(request),
      files: request.files,
      type: "png",
      mimeType: MIME_TYPE.png,
      getDimensions: scaledDimensions(request.scale),
    });
  } catch (error) {
    throw toAppError(error, "export_failed");
  }
  log.info("export", "Copied the diagram to the clipboard as PNG");
}

/** The pure half of an export: everything up to, but not including, the disk. */
export async function buildExportBlob(
  request: ExportRequest,
): Promise<{ blob: Blob; fileName: string }> {
  const elements = drawableElements(request.elements);
  if (request.format !== "json" && elements.length === 0) {
    throw nothingToExport("There is nothing on the canvas to export.");
  }

  const fileName = suggestFileName(request.spec?.title ?? "diagram", EXTENSION[request.format]);

  try {
    return { blob: await renderBlob(request, elements), fileName };
  } catch (error) {
    throw toAppError(error, "export_failed");
  }
}

async function renderBlob(
  request: ExportRequest,
  elements: readonly ExcalidrawElement[],
): Promise<Blob> {
  switch (request.format) {
    case "json": {
      if (!request.spec) {
        throw nothingToExport("There is no diagram description to export.");
      }
      return textBlob(JSON.stringify(request.spec, null, 2), MIME_TYPE.json);
    }
    case "excalidraw": {
      const scene = serializeAsJSON(
        elements,
        exportAppState(request),
        request.files ?? {},
        "local",
      );
      return textBlob(scene, MIME_TYPE.excalidraw);
    }
    case "svg": {
      const svg = await exportToSvg({
        elements,
        appState: exportAppState(request),
        files: request.files,
        exportPadding: EXPORT_PADDING,
      });
      return textBlob(new XMLSerializer().serializeToString(svg), MIME_TYPE.svg);
    }
    case "png":
      return exportToBlob({
        elements,
        appState: exportAppState(request),
        files: request.files,
        mimeType: MIME_TYPE.png,
        exportPadding: EXPORT_PADDING,
        getDimensions: scaledDimensions(request.scale),
      });
  }
}

/**
 * `exportScale` alone only reaches the SVG path. The raster helpers always
 * install their own canvas factory, which renders at 1x unless a dimension
 * function overrides it, so scale has to be applied here as well.
 */
function scaledDimensions(scale: ExportScale) {
  return (width: number, height: number) => ({
    width: width * scale,
    height: height * scale,
    scale,
  });
}

/**
 * Scale, background and dark mode all reach Excalidraw through `appState`;
 * there are no separate arguments for them.
 */
function exportAppState(request: Omit<ExportRequest, "format">): Partial<AppState> {
  return {
    ...request.appState,
    exportBackground: !request.transparent,
    viewBackgroundColor: request.theme.canvas.exportBackground,
    exportScale: request.scale,
    // Always false, including for the dark theme. Excalidraw's dark mode is an
    // inversion filter meant for light-authored scenes; our themes author their
    // real colours and the on-canvas filter is disabled to match (see
    // index.css). Turning it on here would export a dark diagram as a light one.
    exportWithDarkMode: false,
    // Embedding the scene inside a PNG or SVG roughly doubles its size.
    exportEmbedScene: false,
  };
}

function drawableElements(elements: readonly ExcalidrawElement[]): readonly ExcalidrawElement[] {
  return elements.filter((element) => !element.isDeleted);
}

function textBlob(text: string, type: string): Blob {
  return new Blob([text], { type });
}

/** The stock "export failed" copy blames the file; an empty canvas needs its own. */
function nothingToExport(message: string): AppError {
  return {
    ...createAppError("export_failed"),
    message,
    hint: "Generate a diagram first, then export it.",
  };
}
