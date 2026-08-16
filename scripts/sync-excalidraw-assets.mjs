/**
 * Copies Excalidraw's font assets out of node_modules into ./public.
 *
 * Excalidraw otherwise fetches its fonts from a public CDN at runtime.
 * OpenVisual Local must never touch the network, so we vendor the fonts and
 * point `window.EXCALIDRAW_ASSET_PATH` at our own origin (see index.html).
 */
import { cp, mkdir, access } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const source = resolve(root, "node_modules/@excalidraw/excalidraw/dist/prod/fonts");
const target = resolve(root, "public/fonts");

try {
  await access(source);
} catch {
  console.warn("[sync-excalidraw-assets] @excalidraw/excalidraw is not installed yet; skipping.");
  process.exit(0);
}

await mkdir(dirname(target), { recursive: true });
await cp(source, target, { recursive: true });
console.log("[sync-excalidraw-assets] fonts copied to public/fonts");
