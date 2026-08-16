import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import {
  exportToBlob,
  exportToClipboard,
  exportToSvg,
  serializeAsJSON,
} from "@excalidraw/excalidraw";
import { FIXTURES } from "@/diagrams/fixtures";
import type { ExportRequest } from "@/export/exportScene";
import { buildExportBlob, copyPngToClipboard } from "@/export/exportScene";
import { suggestFileName } from "@/export/saveFile";
import { THEMES } from "@/themes";

// Repeated as a literal inside the factory below: vi.mock is hoisted above
// every const, so the factory cannot close over this one.
const SERIALIZED_SCENE = '{"type":"excalidraw","elements":[]}';

vi.mock("@excalidraw/excalidraw", () => ({
  exportToBlob: vi.fn(async () => new Blob(["png-bytes"], { type: "image/png" })),
  exportToSvg: vi.fn(async () => document.createElementNS("http://www.w3.org/2000/svg", "svg")),
  exportToClipboard: vi.fn(async () => undefined),
  serializeAsJSON: vi.fn(() => '{"type":"excalidraw","elements":[]}'),
}));

const blobMock = vi.mocked(exportToBlob);
const svgMock = vi.mocked(exportToSvg);
const clipboardMock = vi.mocked(exportToClipboard);
const serializeMock = vi.mocked(serializeAsJSON);

function element(id: string, isDeleted = false): ExcalidrawElement {
  return { id, isDeleted } as unknown as ExcalidrawElement;
}

function makeRequest(overrides: Partial<ExportRequest> = {}): ExportRequest {
  return {
    format: "png",
    scale: 1,
    transparent: false,
    elements: [element("rect-1")],
    appState: {},
    files: null,
    theme: THEMES.minimal,
    spec: FIXTURES.flowchart,
    ...overrides,
  };
}

/** The options object Excalidraw was actually handed, whichever path ran. */
function lastRasterOptions() {
  const call = blobMock.mock.calls.at(-1);
  if (!call) throw new Error("exportToBlob was never called");
  return call[0];
}

function lastSvgOptions() {
  const call = svgMock.mock.calls.at(-1);
  if (!call) throw new Error("exportToSvg was never called");
  return call[0];
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("suggestFileName", () => {
  it("slugifies and lowercases the title", () => {
    expect(suggestFileName("How An Agent Works", "png")).toBe("how-an-agent-works.png");
  });

  it("collapses runs of punctuation and spaces into a single hyphen", () => {
    expect(suggestFileName("Draft   ->  Review // Publish!", "svg")).toBe(
      "draft-review-publish.svg",
    );
  });

  it("strips accents down to ASCII", () => {
    expect(suggestFileName("Café Naïve Zürich", "json")).toBe("cafe-naive-zurich.json");
  });

  it("trims leading and trailing hyphens", () => {
    expect(suggestFileName("  ...retrieval system...  ", "json")).toBe("retrieval-system.json");
  });

  it("accepts the extension with or without a leading dot", () => {
    expect(suggestFileName("Scene", ".excalidraw")).toBe("scene.excalidraw");
    expect(suggestFileName("Scene", "excalidraw")).toBe("scene.excalidraw");
  });

  it("falls back to 'diagram' for empty or symbols-only titles", () => {
    expect(suggestFileName("", "png")).toBe("diagram.png");
    expect(suggestFileName("!!! ??? ***", "png")).toBe("diagram.png");
  });
});

describe("buildExportBlob: json", () => {
  it("round-trips the spec and names the file .json", async () => {
    const spec = FIXTURES.timeline;
    const { blob, fileName } = await buildExportBlob(makeRequest({ format: "json", spec }));

    expect(JSON.parse(await blob.text())).toEqual(spec);
    expect(fileName).toBe("from-draft-to-published-post.json");
  });

  it("exports the spec even when the canvas is empty", async () => {
    const { blob } = await buildExportBlob(makeRequest({ format: "json", elements: [] }));

    expect(JSON.parse(await blob.text())).toEqual(FIXTURES.flowchart);
  });

  it("throws an AppError when there is no spec", async () => {
    await expect(
      buildExportBlob(makeRequest({ format: "json", spec: null })),
    ).rejects.toMatchObject({ code: "export_failed" });
  });
});

describe("buildExportBlob: excalidraw", () => {
  it("carries serializeAsJSON's output under a .excalidraw name", async () => {
    const { blob, fileName } = await buildExportBlob(makeRequest({ format: "excalidraw" }));

    expect(serializeMock).toHaveBeenCalledTimes(1);
    expect(await blob.text()).toBe(SERIALIZED_SCENE);
    expect(blob.type).toBe("application/json");
    expect(fileName).toBe("how-an-ai-agent-completes-a-task.excalidraw");
  });
});

describe("buildExportBlob: empty canvas", () => {
  const cases: ExportRequest["format"][] = ["png", "svg", "excalidraw"];

  for (const format of cases) {
    it(`throws export_failed for ${format} when no elements remain`, async () => {
      await expect(buildExportBlob(makeRequest({ format, elements: [] }))).rejects.toMatchObject({
        code: "export_failed",
      });

      await expect(
        buildExportBlob(makeRequest({ format, elements: [element("gone", true)] })),
      ).rejects.toMatchObject({ code: "export_failed" });
    });
  }

  it("never reaches Excalidraw for an empty canvas", async () => {
    await expect(
      buildExportBlob(makeRequest({ format: "png", elements: [] })),
    ).rejects.toBeTruthy();

    expect(blobMock).not.toHaveBeenCalled();
    expect(svgMock).not.toHaveBeenCalled();
    expect(serializeMock).not.toHaveBeenCalled();
  });

  it("passes only the elements that are still alive", async () => {
    await buildExportBlob(
      makeRequest({ format: "png", elements: [element("keep"), element("gone", true)] }),
    );

    expect(lastRasterOptions().elements.map((item: ExcalidrawElement) => item.id)).toEqual([
      "keep",
    ]);
  });
});

describe("background handling", () => {
  it("drops the background when transparent is true", async () => {
    await buildExportBlob(makeRequest({ format: "png", transparent: true }));

    expect(lastRasterOptions().appState?.exportBackground).toBe(false);
  });

  it("paints the theme's export background when transparent is false", async () => {
    const theme = THEMES["dark-technical"];
    await buildExportBlob(makeRequest({ format: "png", transparent: false, theme }));

    const appState = lastRasterOptions().appState;
    expect(appState?.exportBackground).toBe(true);
    expect(appState?.viewBackgroundColor).toBe(theme.canvas.exportBackground);
  });

  it("applies the same rules on the SVG path", async () => {
    await buildExportBlob(
      makeRequest({ format: "svg", transparent: false, theme: THEMES.editorial }),
    );

    const appState = lastSvgOptions().appState;
    expect(appState?.exportBackground).toBe(true);
    expect(appState?.viewBackgroundColor).toBe(THEMES.editorial.canvas.exportBackground);
  });
});

describe("scale", () => {
  it("forwards exportScale on both the raster and vector paths", async () => {
    await buildExportBlob(makeRequest({ format: "png", scale: 3 }));
    expect(lastRasterOptions().appState?.exportScale).toBe(3);

    await buildExportBlob(makeRequest({ format: "svg", scale: 2 }));
    expect(lastSvgOptions().appState?.exportScale).toBe(2);
  });

  it("gives the raster path a getDimensions that multiplies by the scale", async () => {
    await buildExportBlob(makeRequest({ format: "png", scale: 2 }));

    const getDimensions = lastRasterOptions().getDimensions;
    expect(getDimensions).toBeTypeOf("function");
    expect(getDimensions?.(100, 50)).toEqual({ width: 200, height: 100, scale: 2 });
  });

  it("leaves dimensions untouched at 1x", async () => {
    await buildExportBlob(makeRequest({ format: "png", scale: 1 }));

    expect(lastRasterOptions().getDimensions?.(100, 50)).toEqual({
      width: 100,
      height: 50,
      scale: 1,
    });
  });
});

describe("dark mode", () => {
  // Excalidraw's dark mode is an inversion filter for light-authored scenes;
  // these themes author their real colours, so enabling it would export the
  // dark theme as a light diagram.
  it("stays off for the light theme", async () => {
    await buildExportBlob(makeRequest({ format: "png", theme: THEMES.minimal }));

    expect(lastRasterOptions().appState?.exportWithDarkMode).toBe(false);
  });

  it("stays off for the dark theme too", async () => {
    await buildExportBlob(makeRequest({ format: "png", theme: THEMES["dark-technical"] }));
    expect(lastRasterOptions().appState?.exportWithDarkMode).toBe(false);

    await buildExportBlob(makeRequest({ format: "svg", theme: THEMES["dark-technical"] }));
    expect(lastSvgOptions().appState?.exportWithDarkMode).toBe(false);
  });
});

describe("copyPngToClipboard", () => {
  it("asks Excalidraw for a PNG at the requested scale", async () => {
    const { format: _format, ...request } = makeRequest({ scale: 2 });
    await copyPngToClipboard(request);

    expect(clipboardMock).toHaveBeenCalledTimes(1);
    const options = clipboardMock.mock.calls[0][0];
    expect(options.type).toBe("png");
    expect(options.appState?.exportWithDarkMode).toBe(false);
    expect(options.getDimensions?.(100, 50)).toEqual({ width: 200, height: 100, scale: 2 });
  });

  it("throws an AppError when the canvas is empty", async () => {
    const { format: _format, ...request } = makeRequest({ elements: [element("gone", true)] });

    await expect(copyPngToClipboard(request)).rejects.toMatchObject({ code: "export_failed" });
    expect(clipboardMock).not.toHaveBeenCalled();
  });

  it("wraps a clipboard failure as an AppError", async () => {
    clipboardMock.mockRejectedValueOnce(new Error("clipboard denied"));
    const { format: _format, ...request } = makeRequest();

    await expect(copyPngToClipboard(request)).rejects.toMatchObject({ code: "export_failed" });
  });
});
