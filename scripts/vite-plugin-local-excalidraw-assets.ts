import { readFile } from "node:fs/promises";
import type { Plugin } from "vite";

/**
 * Redirects Excalidraw's hardcoded CDN font fallback to this app's own origin.
 *
 * Excalidraw resolves each font to a list of sources: the path under
 * `window.EXCALIDRAW_ASSET_PATH` first, then an unconditional
 * `https://esm.sh/@excalidraw/excalidraw@<version>/dist/prod/` fallback that no
 * public option turns off. Most fonts never reach the fallback, but the CJK
 * fallback face does — which would be a network request this app promises never
 * to make.
 *
 * The fallback base is rewritten to `${window.location.origin}/`, where the
 * fonts vendored by scripts/sync-excalidraw-assets.mjs already live, so both
 * sources resolve to local files.
 *
 * If a future Excalidraw version changes that expression, the replacement finds
 * nothing and the plugin warns. That degrades to the previous behaviour, where
 * the Content-Security-Policy blocks the request anyway: it never fails open.
 */

const TARGET = /@excalidraw[\\/]excalidraw[\\/].*\.js$/;
const CDN_BASE = /`https:\/\/esm\.sh\/[\s\S]{0,200}?\/dist\/prod\/`/g;
const LOCAL_BASE = "`${window.location.origin}/`";

function rewrite(code: string): { code: string; changed: boolean } {
  const replaced = code.replace(CDN_BASE, LOCAL_BASE);
  return { code: replaced, changed: replaced !== code };
}

export function localExcalidrawAssets(): Plugin {
  let rewroteAny = false;

  return {
    name: "openvisual:local-excalidraw-assets",
    enforce: "pre",

    config() {
      return {
        optimizeDeps: {
          // esbuild pre-bundles dependencies before Vite plugins can transform
          // them, so the `transform` hook below would miss dev entirely.
          esbuildOptions: {
            plugins: [
              {
                name: "openvisual:local-excalidraw-assets-dev",
                setup(build) {
                  build.onLoad({ filter: TARGET }, async (args) => {
                    const source = await readFile(args.path, "utf8");
                    const { code, changed } = rewrite(source);
                    if (changed) rewroteAny = true;
                    return { contents: code, loader: "js" };
                  });
                },
              },
            ],
          },
        },
      };
    },

    transform(code, id) {
      if (!TARGET.test(id)) return null;
      const { code: next, changed } = rewrite(code);
      if (!changed) return null;
      rewroteAny = true;
      return { code: next, map: null };
    },

    buildEnd() {
      if (!rewroteAny) {
        this.warn(
          "Excalidraw's CDN font fallback was not found, so nothing was rewritten. Check whether " +
            "the upstream bundle changed: fonts still resolve locally first and the CSP blocks the " +
            "fallback, but verify before releasing.",
        );
      }
    },
  };
}
