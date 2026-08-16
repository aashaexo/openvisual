import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  define: {
    "process.env.IS_PREACT": JSON.stringify("false"),
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    css: false,
    // Excalidraw's published bundle imports open-color's raw .json entry, which
    // Node refuses to load without an import attribute. Letting Vite transform
    // the package instead of externalising it keeps that import working.
    server: { deps: { inline: [/@excalidraw\/excalidraw/] } },
  },
});
