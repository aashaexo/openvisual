# Contributing to OpenVisual Local

Thanks for wanting to help. OpenVisual Local turns a paragraph of text into a clean, editable
diagram using a model running on your own machine. It has no accounts, no server, and no way to
send your text anywhere. That constraint is the product, not a limitation — please read
[The architecture rule](#the-architecture-rule) and [Non-negotiables](#non-negotiables) before
writing code.

---

## Setup

You need three things.

**Node 20 or newer.** Check with `node --version`. Anything older will fail on the build tooling.

**Rust, stable, via rustup.** Only needed for the desktop shell. Install from
<https://rustup.rs>, then `rustup default stable`. On macOS you also need the Xcode command line
tools (`xcode-select --install`); on Linux, the Tauri prerequisites listed at
<https://tauri.app/start/prerequisites/> (webkit2gtk, libappindicator, librsvg and friends).

**Ollama, running locally.** Install from <https://ollama.com>, then:

```sh
ollama pull qwen3:4b
ollama serve
```

`qwen3:4b` is the default model and the one everything is tuned against. Larger models work; the
app lists whatever `ollama list` reports. If `ollama serve` is not running, the app will tell you
so rather than failing silently — that path is worth keeping intact.

Then:

```sh
npm install
```

`postinstall` runs `scripts/sync-excalidraw-assets.mjs`, which copies Excalidraw's fonts out of
`node_modules` into `public/fonts`. Those files are generated and gitignored. If diagram text
renders in a fallback font, run `npm run sync-excalidraw-assets` and reload.

## The dev loop

```sh
npm run dev          # Vite only, in a browser. Fast. Use this for most work.
npm run tauri:dev    # the real desktop shell, with the Rust backend.
```

`npm run dev` is the right default. The frontend talks to Ollama through `fetch` when it is not
running under Tauri, so generation, layout, theming and export all work in a plain browser tab.
Reach for `npm run tauri:dev` when you are touching the Rust commands, file dialogs, the
filesystem plugin, or anything about how the window itself behaves — the first Rust build is slow,
subsequent ones are not.

## Quality gates

All four must pass before a pull request is ready. Run them locally — a reviewer will ask.

```sh
npm run typecheck    # tsc --noEmit
npm run lint         # eslint .
npm test             # vitest run
npm run build        # typecheck + production bundle
```

A few things that trip people up:

- `noUnusedLocals` and `noUnusedParameters` are on. An unused import is a build failure, not a
  warning.
- Type-only imports must be written `import type { Foo } from "@/…"`. The lint rule is an error.
- Cross-module imports use the `@/` alias, which maps to `src/`. Relative paths are for siblings.
- No `any`. Use `unknown` and narrow it. Model output in particular is `unknown` until it has been
  through `validateDiagramSpec`.
- Prettier settings are in `.prettierrc.json`: 100 columns, double quotes, semicolons, trailing
  commas, two-space indent. `npm run format` fixes formatting; don't hand-tune it.

## The architecture rule

This is the one design decision that everything else hangs off, and the one most likely to be
broken by a well-meaning change:

> **The model returns semantic JSON and nothing else. Layout, rendering and theming are
> deterministic, local, and completely independent of the model.**

Concretely, the model produces a `DiagramSpec` — a title, a type, nodes with labels and
descriptions and an emphasis level, and edges between them. It never returns a colour, a font, a
coordinate, a size, an SVG, or any markup. `src/diagrams/schema.ts` enforces this: appearance
fields are not in the schema, and text fields reject HTML, SVG, script and template syntax
outright.

Everything downstream is a pure function of that spec:

- `src/diagrams/measure.ts` computes node sizes from the shared typography metrics.
- `src/diagrams/layouts/*` position nodes; `src/diagrams/layout.ts` dispatches by diagram type and
  applies a separation pass so "no overlapping nodes" is a property of the engine rather than of
  any single algorithm's tuning.
- `src/themes/index.ts` supplies every colour and font in the output.
- `src/diagrams/convertToExcalidraw.ts` turns spec + layout + theme into Excalidraw elements.

The payoff: the same input always draws the same diagram, a bad model response can never produce a
broken or hostile render, and the visual engine can be developed and tested against the fixtures in
`src/diagrams/fixtures.ts` with no model in the loop at all.

Two rules follow directly:

1. **Never render unvalidated model output.** Everything from Ollama goes through
   `validateDiagramSpec` in `src/diagrams/validate.ts` first. If it fails, it fails — repair it via
   `src/ai/repair.ts` or surface an `AppError`, but do not draw it.
2. **Never let the model influence appearance.** If you find yourself wanting the model to pick a
   colour, a position or a size, the answer belongs in a theme or a layout module instead.

## Non-negotiables

These are not preferences. A pull request that violates one will be closed regardless of how good
the feature is.

- **No cloud services.** No hosted API, no SaaS backend, no "optional" remote provider, no fallback
  to a cloud model when Ollama is down.
- **No telemetry, no analytics, no crash reporting.** Not anonymised, not opt-in, not behind a
  flag. `src/utils/logger.ts` writes to the local console and nowhere else.
- **No remote assets.** No CDN scripts, no Google Fonts, no remote images or stylesheets. Fonts are
  vendored into `public/fonts` for exactly this reason.
- **No API keys, no credentials, no `.env`.** There is nothing to authenticate to.
- **The only permitted network destination is `http://127.0.0.1:11434`** — the local Ollama server.
  It is hardcoded in `src/ai/client.ts` as `OLLAMA_BASE_URL`, pinned in the Content-Security-Policy
  in `index.html`, and there is deliberately no setting that can point it elsewhere. Adding a
  configurable base URL is not an enhancement; it is the thing this app exists to avoid.

If you add a dependency, check what it does at runtime. A package that phones home, loads a remote
font, or ships an analytics hook does not belong here.

## Adding a new diagram type

Five places, in this order:

1. **`src/diagrams/schema.ts`** — add the type to `DIAGRAM_TYPES`. The Zod schema and the JSON
   schema handed to Ollama's structured-output mode both derive from that array.
2. **`src/diagrams/layouts/<yourType>.ts`** — a layout function taking a `LayoutContext` and
   returning a `DiagramLayout`. Read an existing one first; `cycle.ts` is the simplest piece of
   plain geometry, `hierarchy.ts` shows how to lean on ELK. Position nodes only — no colours, no
   fonts.
3. **`src/diagrams/layout.ts`** — register it in the `LAYOUTS` map. The map is keyed by diagram
   type, so TypeScript will tell you if you forget.
4. **`src/diagrams/fixtures.ts`** — add a hand-written spec for the new type. Fixtures are the
   reference input for the whole visual engine and are how the type gets developed without a model.
5. **A test** — `src/**/*.test.ts`, run by Vitest. At minimum: the fixture lays out without
   overlapping nodes, every edge resolves to real node ids, and the layout is stable across runs.

Also update the prompt guidance in `src/ai/prompts.ts` so the model knows when to choose the new
type, and check that a sensible fallback exists if it picks it for unsuitable input.

## Adding a new theme

One file: **`src/themes/index.ts`**. Add a `ThemeId`, add the `DiagramTheme` entry to `THEMES`, and
you are done.

Themes are purely visual by construction. Typography metrics live in `src/diagrams/typography.ts`
and are shared by every theme, so a new theme cannot change node sizes, spacing or layout. If you
find yourself needing to touch a layout module to make a theme look right, the theme is doing too
much. Pick fonts from the vendored set — adding a font means vendoring the file and its licence,
not linking one.

## Commits and pull requests

Keep commits focused and the subject line in the imperative mood, under ~72 characters: `Add cycle
layout`, `Fix edge routing for radial diagrams`, `Reject model output with duplicate node ids`.
Conventional Commit prefixes (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`) are welcome
but not required. Explain _why_ in the body when the reason is not obvious from the diff.

For pull requests:

- One concern per PR. A refactor and a feature in the same branch is two PRs.
- Fill in the template. It exists so reviewers can check the non-negotiables quickly.
- Include a before/after screenshot for anything that changes what a diagram looks like. Diagram
  output is the product; a description of a visual change is not reviewable.
- Say which model you tested with, and mention it if you only tested in the browser and not in the
  Tauri shell.
- Comments in code should be sparse and explain _why_. No banners, no JSDoc on every function. If a
  comment restates what the line does, delete it.

Open an issue before starting anything large. A new diagram type, a change to the schema, or
anything touching the model-to-render boundary is worth agreeing on first.

## Reporting bugs

Use the issue templates. The bug form asks for your OS, app version, Ollama version, the model you
used, and whether `ollama serve` was running — those five answers resolve most reports.

One request: **don't paste private text into an issue.** The whole point of this app is that your
input never leaves your machine, and a public bug tracker is not your machine. Reproduce the
problem with an innocuous paragraph before reporting it.

## Code of conduct

By participating you agree to the [Code of Conduct](./CODE_OF_CONDUCT.md).

## Licence

Contributions are accepted under the MIT licence (see [LICENSE](./LICENSE)). If you add a
dependency, update [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md) — that file records the
verified licence of everything shipped, and anything copyleft needs a dedicated section before it
can be merged.
