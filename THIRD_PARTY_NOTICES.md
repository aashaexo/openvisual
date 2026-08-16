# Third-party notices

OpenVisual Local is distributed under the MIT licence (see [LICENSE](./LICENSE)). It bundles
and links against third-party software that remains under its own licence terms. This file
records those terms.

Every JavaScript licence below was verified against the installed tree — the `license` field in
`node_modules/<package>/package.json`, cross-checked against the licence file the package ships
where it ships one. Versions are the **resolved** versions from the lockfile at the time of
writing, not the ranges in `package.json`. Rust crate licences are recorded as published by the
crate, because they are not vendored into this checkout (see
[Rust dependencies](#rust-dependencies)).

If you bump a dependency, re-run the check in [How to re-check this file](#how-to-re-check-this-file)
and update the tables.

---

## Summary by licence family

| Family                          | Packages                                                                                                                                     |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| MIT                             | @excalidraw/excalidraw, react, react-dom, zod, zustand, and most dev tooling                                                                 |
| ISC                             | idb                                                                                                                                          |
| Apache-2.0                      | typescript                                                                                                                                   |
| MIT **OR** Apache-2.0           | @tauri-apps/api, @tauri-apps/plugin-dialog, @tauri-apps/plugin-fs, @tauri-apps/cli, and the Rust crates                                      |
| EPL-2.0 **OR** GPL-3.0-or-later | elkjs — see [elkjs and the Eclipse Public License](#elkjs-and-the-eclipse-public-license), the only direct dependency that is not permissive |
| MPL-2.0 (transitive)            | dompurify (dual with Apache-2.0) and lightningcss — see [Transitive dependencies worth naming](#transitive-dependencies-worth-naming)        |
| Font licences                   | The Excalidraw font files vendored into `public/fonts` — see [Vendored fonts](#vendored-fonts)                                               |

`A OR B` is a disjunctive dual licence: the recipient chooses. For the Tauri packages and the
Rust crates, OpenVisual Local takes the **MIT** option. For elkjs, OpenVisual Local takes the
**EPL-2.0** option and does not exercise the GPL-3.0-or-later secondary licence.

---

## Direct runtime dependencies

| Package                   | Version | Licence (SPDX)                | Verified from                                        |
| ------------------------- | ------- | ----------------------------- | ---------------------------------------------------- |
| @excalidraw/excalidraw    | 0.18.1  | MIT                           | `package.json` (no licence file in the npm tarball)  |
| @tauri-apps/api           | 2.11.1  | `Apache-2.0 OR MIT`           | `package.json` + `LICENSE_APACHE-2.0`, `LICENSE_MIT` |
| @tauri-apps/plugin-dialog | 2.7.2   | `MIT OR Apache-2.0`           | `package.json` + `LICENSE.spdx`                      |
| @tauri-apps/plugin-fs     | 2.5.1   | `MIT OR Apache-2.0`           | `package.json` + `LICENSE.spdx`                      |
| elkjs                     | 0.12.0  | `EPL-2.0 OR GPL-3.0-or-later` | `package.json` + `LICENSE.md` (full EPL-2.0 text)    |
| idb                       | 8.0.3   | ISC                           | `package.json` + `LICENSE`                           |
| react                     | 19.2.8  | MIT                           | `package.json` + `LICENSE`                           |
| react-dom                 | 19.2.8  | MIT                           | `package.json` + `LICENSE`                           |
| zod                       | 4.4.3   | MIT                           | `package.json` + `LICENSE`                           |
| zustand                   | 5.0.15  | MIT                           | `package.json` + `LICENSE`                           |

All ten are compatible with shipping a MIT-licensed application, provided the notices in this
file travel with any distributed build. elkjs carries the extra conditions described below.

## Notable development dependencies

These are build-time only. They are not linked into the shipped application, but they are part of
what a contributor installs.

| Package                     | Version | Licence (SPDX)      | Verified from                                        |
| --------------------------- | ------- | ------------------- | ---------------------------------------------------- |
| vite                        | 7.3.6   | MIT                 | `package.json` + `LICENSE.md`                        |
| vitest                      | 3.2.7   | MIT                 | `package.json` + `LICENSE.md`                        |
| typescript                  | 5.9.3   | Apache-2.0          | `package.json` + `LICENSE.txt`                       |
| tailwindcss                 | 4.3.3   | MIT                 | `package.json` + `LICENSE`                           |
| @tailwindcss/vite           | 4.3.3   | MIT                 | `package.json` + `LICENSE`                           |
| eslint                      | 9.39.5  | MIT                 | `package.json` + `LICENSE`                           |
| @eslint/js                  | 9.39.5  | MIT                 | `package.json` + `LICENSE`                           |
| typescript-eslint           | 8.67.0  | MIT                 | `package.json` + `LICENSE`                           |
| prettier                    | 3.9.6   | MIT                 | `package.json` + `LICENSE`                           |
| eslint-config-prettier      | 10.1.8  | MIT                 | `package.json` + `LICENSE`                           |
| eslint-plugin-react-hooks   | 7.1.1   | MIT                 | `package.json` + `LICENSE`                           |
| eslint-plugin-react-refresh | 0.4.26  | MIT                 | `package.json` + `LICENSE`                           |
| @vitejs/plugin-react        | 5.2.0   | MIT                 | `package.json` + `LICENSE`                           |
| jsdom                       | 28.1.0  | MIT                 | `package.json` + `LICENSE.txt`                       |
| @testing-library/react      | 16.3.2  | MIT                 | `package.json` + `LICENSE`                           |
| @testing-library/jest-dom   | 6.9.1   | MIT                 | `package.json` + `LICENSE`                           |
| @tauri-apps/cli             | 2.11.4  | `Apache-2.0 OR MIT` | `package.json` + `LICENSE_APACHE-2.0`, `LICENSE_MIT` |
| globals                     | 16.5.0  | MIT                 | `package.json` + `license`                           |

## Transitive dependencies worth naming

The full transitive tree is not enumerated here — use the audit command below for that — but three
packages arrive indirectly with terms that are not plain MIT, and a reviewer will want them stated
rather than discovered.

| Package      | Version | Licence (SPDX)                        | Arrives via                                                          |
| ------------ | ------- | ------------------------------------- | -------------------------------------------------------------------- |
| dompurify    | 3.4.13  | `MPL-2.0 OR Apache-2.0`               | @excalidraw/excalidraw → @excalidraw/mermaid-to-excalidraw → mermaid |
| lightningcss | 1.32.0  | MPL-2.0                               | vite and @tailwindcss/vite (build-time only)                         |
| khroma       | 2.1.0   | MIT, but undeclared in `package.json` | @excalidraw/excalidraw → mermaid                                     |

- **dompurify** is dual-licensed; OpenVisual Local takes the **Apache-2.0** option, which is
  permissive and imposes no source obligation on the bundle.
- **lightningcss** is MPL-2.0, another file-level copyleft, but it is a build tool. It is not linked
  into the shipped application and its output (transformed CSS) is not a derivative of its source.
  Keep it a dev dependency and nothing follows from it.
- **khroma** declares no `license` field in its `package.json`; the `license` file it ships is the
  MIT text. The file is the authority here.

---

## elkjs and the Eclipse Public License

**elkjs 0.12.0 is not MIT.** Its `package.json` declares `EPL-2.0 OR GPL-3.0-or-later`, and the
bundled `LICENSE.md` is the full text of the Eclipse Public License 2.0, ending with the
"Exhibit A – Form of Secondary Licenses Notice" that names GNU General Public License v3.0 or
later as the secondary licence. elkjs is a JavaScript transpilation of the Eclipse Layout Kernel
(<https://github.com/kieler/elkjs>).

OpenVisual Local uses elkjs as an **unmodified dependency**, installed from npm and bundled by
Vite. It is not forked, patched or vendored with local edits.

What that means in practice:

- **The MIT licence on OpenVisual Local is unaffected.** EPL-2.0 is a file-level (weak) copyleft.
  Its copyleft attaches to the EPL-licensed files themselves and to Modified Works derived from
  them — not to separate works that merely link to or call into the Program. The EPL-2.0
  definitions section says as much explicitly: works that contain only declarations, interfaces
  or types of the Program solely in order to link to it are not Modified Works. Our own source
  stays MIT.
- **Distributing a built app distributes elkjs.** Vite inlines elkjs into the production bundle, so
  any release of OpenVisual Local is a distribution of EPL-2.0 code. Section 3.1(a) requires that
  the Program be available as Source Code and that the distribution carry a statement saying so and
  telling recipients how to obtain it; section 3.3 forbids stripping the notices inside it. This
  file is that statement: elkjs source is at <https://github.com/kieler/elkjs>, and the exact
  version used is on npm as `elkjs@0.12.0`. Section 3.2(b) additionally requires a copy of the
  Agreement whenever the Program travels in source form — a readable (unminified) bundle counts —
  so ship `node_modules/elkjs/LICENSE.md`, or the EPL-2.0 text, with any build rather than trying
  to decide which form you are in.
- **If you ever modify elkjs, the rules change.** Patched elkjs files become Modified Works and
  must be distributed under EPL-2.0 with source made available. Prefer configuring elkjs through
  its documented layout options — which is all `src/diagrams/layouts/elk.ts` does — over patching
  it.
- **We do not take the GPL option.** The `OR GPL-3.0-or-later` half is a secondary-licence
  election available to recipients under EPL-2.0's Exhibit A mechanism. Choosing it would pull
  GPL obligations onto the distributed combination. OpenVisual Local receives and redistributes
  elkjs under **EPL-2.0**, and contributors should not introduce anything that depends on the GPL
  election.
- **EPL-2.0 also carries a patent grant and a commercial-distribution indemnity** (sections 2(b)
  and 4). Read them before shipping a paid or branded redistribution of this app.

If elkjs's licence terms are unacceptable for your redistribution, the dependency is contained:
`src/diagrams/layouts/elk.ts` is the only module that imports it, and only three layouts route
through that module (`flowchart.ts`, `hierarchy.ts`, `timeline.ts`). The rest — `comparison.ts`,
`cycle.ts`, `hubSpoke.ts` — are plain geometry, and the dispatcher in `src/diagrams/layout.ts`
selects layouts by diagram type, so replacing the ELK-backed three is a bounded job.

---

## Vendored fonts

`scripts/sync-excalidraw-assets.mjs` copies
`node_modules/@excalidraw/excalidraw/dist/prod/fonts` into `public/fonts` on `postinstall`. This
exists so Excalidraw never fetches fonts from a CDN at runtime; it also means these font binaries
are shipped inside the application.

**The Excalidraw npm package does not ship licence files alongside these fonts.** Verified: there
are no `LICENSE`, `OFL`, `COPYING` or `NOTICE` files anywhere under `dist/prod/fonts`, and the
package publishes only `README.md`, `package.json` and `dist/`. The MIT licence in
`@excalidraw/excalidraw/package.json` covers Excalidraw's own code; the font binaries carry their
own upstream terms, which must be confirmed against their upstream projects rather than assumed
from the npm package.

The font families actually present in `public/fonts`, verified by listing the directory:

| Directory     | Font family     | Upstream licence, as published by the font's own project                                   |
| ------------- | --------------- | ------------------------------------------------------------------------------------------ |
| `Assistant`   | Assistant       | SIL Open Font License 1.1 (Google Fonts) — not verifiable from the installed package       |
| `Cascadia`    | Cascadia Code   | SIL Open Font License 1.1 (Microsoft) — not verifiable from the installed package          |
| `ComicShanns` | Comic Shanns    | Upstream terms unconfirmed — verify against the Comic Shanns project before redistributing |
| `Excalifont`  | Excalifont      | Excalidraw's own handwriting font; terms per the Excalidraw repository                     |
| `Liberation`  | Liberation Sans | SIL Open Font License 1.1 (Liberation Fonts) — not verifiable from the installed package   |
| `Lilita`      | Lilita One      | SIL Open Font License 1.1 (Google Fonts) — not verifiable from the installed package       |
| `Nunito`      | Nunito          | SIL Open Font License 1.1 (Google Fonts) — not verifiable from the installed package       |
| `Virgil`      | Virgil          | Excalidraw's original handwriting font; terms per the Excalidraw repository                |
| `Xiaolai`     | Xiaolai (CJK)   | SIL Open Font License 1.1 — not verifiable from the installed package                      |

Only the directory names and file lists in the table above were verified locally. The licence
column is stated as published upstream and is **not** confirmed by anything in this checkout. If
you cut a public release, confirm each family against its upstream source and, for anything under
the SIL OFL, ship the OFL text with the build — the OFL requires the licence to accompany the font
files. `public/fonts` is gitignored precisely because it is generated, so this notice is the only
record that travels with the repository.

---

## Rust dependencies

`src-tauri` is not present in this checkout, so no `Cargo.toml` or vendored crate source was
available to verify against. The following are recorded **as published by the crate on crates.io**
and should be re-verified with `cargo license` (or by reading `Cargo.toml`) once the Rust side is
in the tree.

| Crate      | Licence, as published by the crate |
| ---------- | ---------------------------------- |
| tauri      | `MIT OR Apache-2.0`                |
| reqwest    | `MIT OR Apache-2.0`                |
| serde      | `MIT OR Apache-2.0`                |
| serde_json | `MIT OR Apache-2.0`                |
| tokio      | `MIT`                              |
| thiserror  | `MIT OR Apache-2.0`                |

OpenVisual Local takes the MIT option wherever a choice is offered. Note that `tokio` publishes
under MIT alone, not a dual licence — do not fold it into the dual-licensed group when summarising.

---

## How to re-check this file

Run this from the repository root after `npm install`. It prints every direct dependency with its
resolved version and its declared licence, which is exactly what the tables above record:

```sh
node -e '
const fs = require("node:fs");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const names = [...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.devDependencies ?? {})].sort();
for (const name of names) {
  let row = "MISSING";
  try {
    const dep = JSON.parse(fs.readFileSync(`node_modules/${name}/package.json`, "utf8"));
    const files = fs.readdirSync(`node_modules/${name}`).filter((f) => /^(licen[sc]e|copying|notice)/i.test(f));
    row = `${dep.version}\t${dep.license ?? "UNDECLARED"}\t${files.join(",") || "(no licence file)"}`;
  } catch {}
  console.log(`${name}\t${row}`);
}'
```

To surface the whole transitive tree, including anything non-permissive that arrives indirectly:

```sh
npm ls --all --json | node -e 'let s="";process.stdin.on("data",(d)=>s+=d).on("end",()=>{const seen=new Map();(function walk(n){for(const [k,v] of Object.entries(n.dependencies??{})){seen.set(`${k}@${v.version}`,true);walk(v);}})(JSON.parse(s));console.log([...seen.keys()].sort().join("\n"));})'
```

For the Rust side, once `src-tauri` exists:

```sh
cargo install cargo-license   # once
cargo license --manifest-path src-tauri/Cargo.toml
```

Anything that reports a copyleft licence (EPL, MPL, LGPL, GPL, AGPL) needs to be accounted for in
this file before it is merged. Today that is elkjs among the direct dependencies — the only one
with a real obligation attached — plus dompurify and lightningcss arriving transitively, both
covered above.
