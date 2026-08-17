---
name: Editorial
colors:
  primary: "#111111"
  secondary: "#f1f1f1"
  success: "#16A34A"
  warning: "#D97706"
  danger: "#DC2626"
  surface: "#FFFFFF"
  text: "#111827"
  neutral: "#FFFFFF"
typography:
  h1:
    fontFamily: "Gelasio"
    fontSize: 2.5rem
  body-md:
    fontFamily: "Gelasio"
    fontSize: 1rem
  label-caps:
    fontFamily: "Ubuntu Mono"
    fontSize: 0.875rem
  sourceScale: "14/16/18/24/32/40"
  weights: "100, 200, 300, 400, 500, 600, 700, 800, 900"
rounded:
  sm: 4px
  md: 8px
spacing:
  sm: 8px
  md: 16px
  sourceScale: "8pt baseline grid"
---

## Overview

Magazine-inspired editorial layout with refined serif typography, structured grids, and elegant reading experiences.

## Style Foundations

- **Visual style:** modern, editorial
- **Typography scale:** 14/16/18/24/32/40
- **Typography fonts:** primary=Gelasio, display=Gelasio, mono=Ubuntu Mono
- **Typography weights:** 100, 200, 300, 400, 500, 600, 700, 800, 900
- **Color palette:** primary, secondary, neutral, success
- **Spacing scale:** 8pt baseline grid

## Colors

- **Primary (#111111):** Token from style foundations.
- **Secondary (#f1f1f1):** Token from style foundations.
- **Success (#16A34A):** Token from style foundations.
- **Warning (#D97706):** Token from style foundations.
- **Danger (#DC2626):** Token from style foundations.
- **Surface (#FFFFFF):** Token from style foundations.
- **Text (#111827):** Token from style foundations.
- **Neutral (#FFFFFF):** Derived from the surface token for official format compatibility.

---

## How this is applied in OpenVisual Local

Pulled with `npx typeui.sh pull editorial` from
[bergside/awesome-design-skills](https://github.com/bergside/awesome-design-skills).

Two deliberate deviations:

**Fonts.** The spec names Gelasio and Ubuntu Mono, which are Google Fonts. This app does not
load a single byte from a CDN, so the editorial _intent_ is kept with system stacks instead:
`--ov-font-display` resolves to New York on macOS (a genuine editorial serif), and
`--ov-font-mono` to SF Mono. Zero requests, zero licence obligations, same register. If the
project ever vendors real webfonts, they must be committed to `public/fonts` and recorded in
THIRD_PARTY_NOTICES.md — never fetched at runtime.

**Colour.** The spec's palette is not applied wholesale, because colour here belongs to the
theme system (`src/themes/index.ts`), which owns all three themes and every colour in the
rendered diagram. The editorial pass is therefore typographic and structural — display serif,
mono caps labels, the 14/16/18/24/32/40 scale, 4px/8px radii, 8pt spacing — all of which are
theme-independent and apply equally to Minimal, Editorial and Dark technical.

Tokens live at the top of `src/index.css`. Display type is opt-in via the `.ov-display` class
rather than applied to headings globally, so body copy and form controls stay in the sans face
where they read better at small sizes.
