// Must come first: it redirects Excalidraw's font loading away from its CDN.
import "@/excalidrawAssets";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "@/App";
import { setOllamaTransport } from "@/ai/client";
import { useAppStore } from "@/store/appStore";
import { FIXTURES } from "@/diagrams/fixtures";
import "@/index.css";

const root = document.getElementById("root");
if (!root) throw new Error("Root element is missing from index.html");

if (import.meta.env.DEV) {
  // Development handle: render the fixtures, or stand in for Ollama, without a
  // model installed. Stripped from production builds.
  Object.assign(window, {
    __openvisual: { store: useAppStore, fixtures: FIXTURES, setOllamaTransport },
  });
}

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
