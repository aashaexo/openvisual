/**
 * Points Excalidraw at the fonts vendored into ./public/fonts.
 *
 * Without this, Excalidraw resolves every font against its CDN fallback
 * (`https://esm.sh/@excalidraw/excalidraw@…`), which both breaks the offline
 * promise and fails outright under this app's Content-Security-Policy.
 *
 * It lives in a module rather than an inline <script> in index.html precisely
 * because the CSP forbids inline scripts — an inline assignment is silently
 * dropped and the CDN fallback takes over unnoticed.
 *
 * Imported for its side effect at the very top of main.tsx.
 */
declare global {
  interface Window {
    EXCALIDRAW_ASSET_PATH?: string | string[];
  }
}

window.EXCALIDRAW_ASSET_PATH = "/";

export {};
