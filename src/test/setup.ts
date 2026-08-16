import "@testing-library/jest-dom/vitest";

/**
 * jsdom does not implement the canvas or layout APIs Excalidraw touches, and
 * the tests here exercise logic rather than pixels, so the gaps are stubbed.
 */
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
}

if (!global.ResizeObserver) {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
