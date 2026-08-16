## Summary

<!-- What changes and why. One or two sentences is usually enough. -->

## Linked issue

<!-- Closes #123. If there is no issue, say why this did not need discussing first. -->

Closes #

## Screenshots

<!--
Required for anything that changes what a diagram looks like — layout, theming, conversion,
typography, export. Before and after, same input text, same model. Diagram output is the product;
a description of a visual change is not reviewable.

Delete this section if the change has no visual effect.
-->

## How this was tested

<!-- Model used, and whether you tested in the browser (npm run dev), the Tauri shell, or both. -->

- Model:
- Surface: <!-- browser / desktop / both -->

## Checklist

- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes
- [ ] `npm run build` passes
- [ ] No cloud services or telemetry added — no hosted API, no analytics, no crash reporting, no remote logging
- [ ] No remote assets added — no CDN scripts, no remote fonts, images or stylesheets
- [ ] The only network destination is still `http://127.0.0.1:11434`
- [ ] Model output is still validated before rendering — anything from Ollama goes through `validateDiagramSpec` first
- [ ] The model still returns semantic JSON only; layout, rendering and theming remain deterministic and local
- [ ] New dependencies (if any) are recorded in `THIRD_PARTY_NOTICES.md` with their verified licence
- [ ] Comments explain why, not what
