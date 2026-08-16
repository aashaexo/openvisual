import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

/**
 * A deliberately non-reactive handle on the Excalidraw instance.
 *
 * The imperative API is not state — putting it in the store would re-render the
 * whole app every time the canvas mounts — so it lives here and store actions
 * reach for it when they need to push a new scene.
 */
let api: ExcalidrawImperativeAPI | null = null;

export function setCanvasApi(next: ExcalidrawImperativeAPI | null): void {
  api = next;
}

export function getCanvasApi(): ExcalidrawImperativeAPI | null {
  return api;
}
