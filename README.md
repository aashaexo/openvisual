<h1 align="center">OpenVisual Local</h1>

<p align="center">
  <strong>Turn text into editable diagrams. Runs entirely on your machine.</strong><br />
  No account, no API key, nothing sent to a server.
</p>

<p align="center">
  <a href="./LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-blue.svg" /></a>
  <img alt="Local first" src="https://img.shields.io/badge/AI-100%25%20local-4f46e5" />
  <img alt="Built with Tauri" src="https://img.shields.io/badge/built%20with-Tauri%202-24C8DB" />
</p>

<p align="center">
  <!--
    Replace with docs/demo.gif once recorded: paste text, click Generate,
    diagram appears, drag a node. Ten seconds, no narration.
    See docs/README.md for what to capture.
  -->
  <em>Demo GIF goes here — see <a href="./docs/README.md">docs/README.md</a>.</em>
</p>

Paste an idea, click _Generate visual_, and a local [Ollama](https://ollama.com) model reads your
text and returns a structured description of the diagram. A deterministic layout engine decides
where everything goes, and the result opens in a fully editable
[Excalidraw](https://excalidraw.com) canvas you can rearrange, restyle, save and export.

The model only ever returns meaning. Every coordinate, colour and stroke is computed locally —
which is why the same input always produces the same drawing, and why a bad model response can
never inject markup into your canvas.

```bash
brew install ollama && ollama serve
ollama pull qwen3:4b
npm install && npm run tauri dev
```

---

## Screenshots

> **Wanted.** Drop these four images into [`docs/`](./docs) and this section fills itself in —
> [docs/README.md](./docs/README.md) has the filenames and what to capture.

| File                             | Shows                                           |
| -------------------------------- | ----------------------------------------------- |
| `docs/screenshot-main.png`       | Text on the left, editable diagram on the right |
| `docs/screenshot-dark.png`       | The Dark technical theme                        |
| `docs/screenshot-onboarding.png` | First-run setup checking Ollama                 |
| `docs/screenshot-export.png`     | The export menu with formats and scale          |

---

## The privacy promise

This is the whole point of the project, so it is worth being precise:

- The **only** network address the application may contact is `http://127.0.0.1:11434`, your
  local Ollama server. The address is a compile-time constant in the Rust backend with no
  setting, environment variable or command parameter that can change it.
- There is **no** telemetry, analytics, crash reporting, update check or usage ping.
- There are **no** remote fonts, scripts, stylesheets or images. Excalidraw's fonts are copied
  out of `node_modules` into `public/fonts` at install time, and its hardcoded CDN font fallback
  is rewritten at build time to point back at this app's own origin
  ([the plugin](./scripts/vite-plugin-local-excalidraw-assets.ts)), so even the CJK fallback face
  loads locally. A Content-Security-Policy blocks anything that slips past.
- Excalidraw's own routes off the machine are shut: its hosted "text to diagram" service
  (`aiEnabled={false}`), remote iframe embeds (`validateEmbeddable={false}`), the online shape
  library, and the promotional links in its default menu.
- Your projects live in this app's own IndexedDB database on your disk. Exports go where you
  put them.
- The app never downloads or installs a model for you. It tells you the command to run.
- Once Ollama and a model are installed, the app works with the network turned off.

---

## Features

**Generation**

- Six diagram types — flowchart, timeline, hierarchy, comparison, cycle, hub-and-spoke — chosen
  automatically by the model, or pinned by you.
- Three detail levels: simple, balanced, detailed.
- Local transformations of an existing diagram: **Regenerate**, **Simplify** (down to 3–6 nodes),
  **Add detail** (up to 10 nodes) and **Change type**.
- **Auto-layout** recalculates positions without calling the model at all.
- Generation is cancellable at any point.

**Editing**

- A real Excalidraw canvas: drag, resize, multi-select, copy and paste, delete, undo and redo,
  free-hand annotation, zoom and pan.
- Arrows are bound to their nodes, so connectors follow when you move things.
- Manual edits are preserved. Nothing overwrites your positions unless you ask for _Auto-layout_
  or _Regenerate_.
- Switching theme repaints the diagram in place — your layout and your own annotations survive.

**Themes** — Minimal, Editorial and Dark technical. The model never picks a colour; the theme
owns every colour, stroke, fill and font in the drawing.

**Export** — PNG, SVG, `.excalidraw` scene, and the underlying diagram JSON. Copy PNG straight to
the clipboard, choose 1x/2x/3x scale, and export with a transparent or themed background.

**Projects** — automatic local saving, rename, duplicate, delete with confirmation, search, sorted
by most recently updated, plus import of diagram JSON and `.excalidraw` files and per-project
backup export.

**Accessibility** — keyboard-operable controls, visible focus rings, tooltips on every icon-only
button, labelled form controls, `prefers-reduced-motion` support and light/dark compatible chrome.

---

## Architecture

The central rule: **the model produces meaning, the app produces pixels.**

```
your text
    │
    ▼
┌─────────────────┐   system prompt + JSON schema
│  src/ai         │──────────────────────────────► Ollama (127.0.0.1:11434)
│  prompts/client │◄──────────────────────────────  raw text response
└────────┬────────┘
         │  strip fences, thinking blocks, prose
         ▼
┌─────────────────┐
│  src/ai/parser  │  → candidate JSON
└────────┬────────┘
         ▼
┌─────────────────────────────┐   invalid?  ┌──────────────────┐
│ src/diagrams/validate (Zod) │────────────►│ src/ai/repair    │ one attempt
└────────┬────────────────────┘             └────────┬─────────┘
         │ valid DiagramSpec                         │ still invalid → clear error
         ▼
┌──────────────────────────┐
│ src/diagrams/measure     │  deterministic text metrics
│ src/diagrams/layout(s)   │  ELK + custom geometry, overlap-free
└────────┬─────────────────┘
         ▼
┌──────────────────────────────┐
│ src/diagrams/convertToExcali │  theme applies every colour here
└────────┬─────────────────────┘
         ▼
   Excalidraw canvas ──► src/export ──► PNG / SVG / .excalidraw / JSON
         │
         └──────────────► src/storage (IndexedDB)
```

Because the model never emits coordinates or colours, the same `DiagramSpec` always produces the
same drawing, and a bad model response can never inject markup or styling into the canvas.

**Layout strategy per type**

| Type          | Engine                                                               |
| ------------- | -------------------------------------------------------------------- |
| Flowchart     | ELK `layered`                                                        |
| Timeline      | ELK `layered` left-to-right, snapped to a baseline with a drawn axis |
| Hierarchy     | ELK `mrtree`                                                         |
| Comparison    | Deterministic multi-column layout driven by node categories          |
| Cycle         | Custom circular layout, radius derived from the largest node         |
| Hub-and-spoke | Custom radial layout around the highest-degree node                  |

A separation pass runs after every layout, so "no overlapping nodes" is a property of the engine
rather than of any one algorithm's tuning.

**Project structure**

```
src/
├── ai/           prompts, Ollama client, parser, repair, pipeline
├── components/   canvas/ editor/ onboarding/ projects/ ui/
├── diagrams/     schema, validate, measure, layout, layouts/, convertToExcalidraw, fixtures
├── export/       PNG · SVG · .excalidraw · JSON, clipboard, file saving
├── storage/      IndexedDB projects, preferences, import/export
├── store/        Zustand application state
├── themes/       the three themes; the only source of colour
├── types/        shared types
└── utils/        local logger, user-facing error construction

src-tauri/
├── src/commands/ollama.rs   check_ollama · list_ollama_models · generate_diagram
├── src/models/ollama.rs     DTOs, error mapping, cancellation state
├── capabilities/            a deliberately narrow permission set
└── tauri.conf.json
```

---

## Technology

Tauri 2 · React 19 · TypeScript · Vite 7 · Tailwind CSS 4 · Excalidraw · ELK.js · Zod 4 ·
Zustand · IndexedDB (`idb`) · Rust + `reqwest` · Vitest · ESLint · Prettier.

Requests to Ollama go through Rust commands rather than the webview, which sidesteps CORS
entirely and keeps the endpoint out of reach of the frontend.

---

## Installation

**Prerequisites**

- [Node.js](https://nodejs.org) 20 or newer
- [Rust](https://rustup.rs) (stable) — only needed for the desktop build
- Platform build tools: Xcode Command Line Tools on macOS, `build-essential` +
  `libwebkit2gtk-4.1-dev` + `libgtk-3-dev` on Linux, the MSVC C++ build tools on Windows
- [Ollama](https://ollama.com)

**Set-up**

```bash
brew install ollama
ollama serve
ollama pull qwen3:4b
npm install
npm run tauri dev
```

That is the entire set-up. There is no API key to obtain, no account to create and no `.env` file
to fill in — the project deliberately ships without one.

### Ollama

`ollama serve` starts the local server on `127.0.0.1:11434`. On macOS the Ollama desktop app
starts it for you. The first-run screen in OpenVisual checks whether the server is reachable,
whether any models are installed and whether the recommended model is present, and shows you the
exact command to run for whatever is missing — with a copy button. It never installs anything
itself.

### The model

`qwen3:4b` is the default: small enough to be quick on a laptop, good enough at structured output
to be reliable. Any installed Ollama model can be selected instead, and your choice is remembered.
Models that support structured output work best, since the app asks Ollama to constrain the
response to the diagram JSON schema rather than merely requesting JSON in prose.

```bash
ollama pull qwen3:4b     # recommended default
ollama list              # see what you already have
```

---

## Development

```bash
npm install          # also vendors Excalidraw's fonts into public/fonts
npm run dev          # frontend only, in a browser at http://localhost:1420
npm run tauri dev    # the actual desktop application
npm run typecheck
npm run lint
npm test
npm run format
```

`npm run dev` is useful for UI work: the app detects that it is not running under Tauri and talks
to Ollama over `fetch` instead of through Rust. Everything else behaves identically.

Tests never require Ollama, a network connection or a Tauri runtime — the Ollama transport is
swapped for a fake through `setOllamaTransport()`.

### Production build

```bash
npm run build          # typecheck + frontend bundle into dist/
npm run tauri build    # the packaged desktop application
```

The installer lands in `src-tauri/target/release/bundle/`. To regenerate the app icons after
changing the mark:

```bash
npm run make-icon
```

---

## Troubleshooting

**"Ollama is not running"** — start it with `ollama serve` and press _Check again_. Confirm it is
listening with `curl http://127.0.0.1:11434/api/version`.

**"No local models installed"** — run `ollama pull qwen3:4b`, then _Check again_.

**"That model is no longer installed"** — you deleted the model that was selected. Pick another in
the model dropdown, or pull it again.

**"The model took too long"** — a large model on a small machine can exceed the time limit. Try a
shorter input, a smaller model, or the _Simple_ detail level.

**"The model returned an unusable diagram"** — the response failed validation twice, including one
repair attempt. Small models occasionally do this; press _Try again_, or move up a model size.
This is the system working as designed: unvalidated output is never drawn.

**The diagram looks cramped or overlapping** — press _Auto-layout_ to recalculate positions from
the semantic diagram.

**`npm run tauri dev` fails to compile** — install the Rust toolchain via [rustup](https://rustup.rs)
and your platform's WebView build dependencies, then try again.

**Projects are not saving** — your browser or profile has blocked IndexedDB. The app tells you so
and keeps working; export your diagram to keep a copy.

---

## Roadmap

- [ ] More diagram types (matrix, swimlane, quadrant)
- [ ] Per-node manual type and shape overrides
- [ ] Streaming generation with progressive rendering
- [ ] User-defined themes in the interface
- [ ] Multi-diagram documents
- [ ] Linux and Windows release binaries
- [ ] Optional local embedding model for smarter node grouping

---

## Contributing

Contributions are welcome — see [CONTRIBUTING.md](./CONTRIBUTING.md) and the
[Code of Conduct](./CODE_OF_CONDUCT.md). The one architectural rule to preserve: **the model
returns semantic JSON only; layout, styling and rendering stay deterministic and local.** Pull
requests that add a cloud service, telemetry, an analytics hook, a remote asset or an API key
requirement will not be merged.

Third-party licences, including ELK.js's Eclipse Public License, are recorded in
[THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

## Licence

MIT — see [LICENSE](./LICENSE).
