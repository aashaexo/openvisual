# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

Nothing yet.

## [0.1.0] — Unreleased

The first working version: text in, editable diagram out, entirely on your own machine.

### Added

- **Local generation.** A local Ollama model (default `qwen3:4b`, any installed model
  selectable) turns text into a structured diagram. Ollama's structured-output mode constrains
  the response to the diagram schema rather than merely asking for JSON in prose.
- **Six diagram types** — flowchart, timeline, hierarchy, comparison, cycle and hub-and-spoke —
  chosen automatically by the model or pinned by the user.
- **Deterministic layout engine.** ELK for layered and tree graphs, purpose-built geometry for
  comparison columns, cycles and radial hubs, with a separation pass that guarantees no
  overlapping nodes.
- **Strict validation.** Model output is parsed and validated against a Zod schema before
  anything is rendered; a single local repair attempt runs when validation fails.
- **Editable canvas.** Excalidraw with bound arrows, draggable and resizable nodes, undo and
  redo, multi-selection and free-hand annotation. Manual edits are preserved unless the user
  explicitly asks for auto-layout or regeneration.
- **Three themes** — Minimal, Editorial and Dark technical. The theme owns every colour; the
  model never picks one. Switching theme repaints in place without losing manual edits.
- **Local transformations** — regenerate, simplify, add detail, change type, and an auto-layout
  that needs no model call at all.
- **Export** to PNG, SVG, `.excalidraw` and diagram JSON, with 1x/2x/3x scale, transparent or
  themed backgrounds, and copy-PNG-to-clipboard.
- **Local project storage** in IndexedDB with automatic saving, rename, duplicate, delete,
  search, import and per-project backup export.
- **First-run onboarding** that checks whether Ollama is running, whether any model is installed
  and whether the recommended model is present, showing the exact command to run for whatever is
  missing. It never installs anything on the user's behalf.
- **Cancellable generation**, with cancellation propagated into the Rust HTTP request.
- 320 unit and integration tests. Ollama is mocked throughout; no test needs a running model.

### Security

- The Ollama endpoint is a compile-time constant in the Rust backend. No setting, environment
  variable or command parameter can point it anywhere else.
- A strict Content-Security-Policy, no telemetry, no analytics and no remote assets of any kind.
- Excalidraw's fonts are vendored locally and its hardcoded CDN font fallback is rewritten at
  build time, so no font request ever leaves the machine.
- Excalidraw's hosted AI feature, remote iframe embeds and online shape library are disabled.

[unreleased]: https://github.com/OWNER/REPO/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/OWNER/REPO/releases/tag/v0.1.0
