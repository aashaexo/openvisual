import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";
import { localExcalidrawAssets } from "./scripts/vite-plugin-local-excalidraw-assets";

// Tauri expects a fixed dev port and gives us the target triple via env vars.
const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [localExcalidrawAssets(), react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  define: {
    // Excalidraw's bundle references process.env at runtime.
    "process.env.IS_PREACT": JSON.stringify("false"),
  },
  // Everything is bundled locally: no CDN, no remote fonts, no analytics.
  build: {
    target: "es2022",
    sourcemap: true,
    chunkSizeWarningLimit: 2500,
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: "ws", host, port: 1421 } : undefined,
    watch: { ignored: ["**/src-tauri/**"] },
  },
});
