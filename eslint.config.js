import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  {
    ignores: ["dist", "public/fonts", "src-tauri/target", "src-tauri/gen", "coverage"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  reactHooks.configs.flat["recommended-latest"],
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: { "react-refresh": reactRefresh },
    rules: {
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "separate-type-imports" },
      ],
      // The app must never reach the network beyond the local Ollama server.
      "no-restricted-globals": [
        "error",
        { name: "XMLHttpRequest", message: "Use the local Ollama transport in src/ai/client.ts." },
      ],
    },
  },
  {
    files: ["**/*.test.{ts,tsx}", "src/test/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    files: ["scripts/**/*.mjs"],
    languageOptions: { globals: globals.node },
  },
  prettier,
);
