# LifeLens AI — design system

Register: **product**. The interface should disappear into the task. Familiarity is
a feature; the charts are the only thing allowed to be loud.

## Theme

Dark, fixed (no light mode). Justified by the two real scenes in PRODUCT.md: a
laptop at night and a projector in a dim room. The content surface sits a step
above the page so panels read as objects without needing heavy borders.

Colour strategy: **restrained** — tinted neutrals plus one accent used for primary
action, current selection and state only. Chart series are the exception: data
needs categorical colour, and that is a functional use, not decoration.

## Tokens

Defined as CSS custom properties in `src/styles/theme.css`, consumed through
Tailwind v4's `@theme`. OKLCH throughout. Neutrals are tinted ~0.015 chroma toward
the indigo brand hue, so nothing reads as a dead grey.

| Role | Token | Value | Use |
|---|---|---|---|
| Page | `--color-base` | `oklch(0.17 0.022 275)` | app background |
| Surface | `--color-surface` | `oklch(0.213 0.023 275)` | panels, cards |
| Raised | `--color-raised` | `oklch(0.252 0.025 275)` | inputs, hover rows |
| Line | `--color-line` | `oklch(0.312 0.02 275)` | 1px borders, grid lines |
| Ink | `--color-ink` | `oklch(0.971 0.006 275)` | headings, numbers |
| Body | `--color-body` | `oklch(0.84 0.012 275)` | body copy (≥ 7:1 on surface) |
| Muted | `--color-muted` | `oklch(0.672 0.018 275)` | labels, units (≥ 4.6:1) |
| Accent | `--color-accent` | `oklch(0.646 0.178 285)` | primary action, selection |
| Cyan | `--color-cyan` | `oklch(0.76 0.123 215)` | second data series |
| Emerald | `--color-positive` | `oklch(0.724 0.142 158)` | positive association, success |
| Amber | `--color-warning` | `oklch(0.79 0.144 78)` | weak evidence, caution |
| Rose | `--color-negative` | `oklch(0.665 0.183 14)` | negative association, destructive |

Contrast: body on surface 7.4:1, muted on surface 4.6:1, ink on surface 14.8:1.
Placeholders use `--color-muted`, never a lighter grey.

## Type

One family — Inter, with `system-ui` fallback. Product UI does not need a display
pairing, and a second sans would only add noise across this many labels.

Fixed rem scale (not fluid; this is a dashboard, not a landing page), ratio ~1.2:

`0.6875 / 0.75 / 0.8125 / 0.875 / 1 / 1.125 / 1.25 / 1.5 / 1.875 / 2.25rem`

- Numbers use `font-variant-numeric: tabular-nums` so metrics do not jitter.
- Headings `text-wrap: balance`; prose `text-wrap: pretty`, capped at 72ch.
- Letter-spacing floor on large headings: `-0.02em`.

## Space and shape

4px base step. Radii: `6px` controls, `10px` panels, `999px` pills only.
Nothing above 16px — over-rounded cards are a tell.

Elevation: a 1px `--color-line` border **or** a shadow, never both on the same
element. Panels use the border. Only overlays (dialog, dropdown, toast) get a
shadow, and it stays under 8px blur with a tight spread.

## Motion

150–220ms, `cubic-bezier(0.22, 1, 0.36, 1)` (ease-out-quart). Motion only ever
conveys state: value change, loading, selection, enter/exit of an overlay. No
page-load choreography. Every transition has a `prefers-reduced-motion: reduce`
path that collapses to an instant change.

## Components

Every interactive element ships default / hover / focus-visible / active /
disabled, and where relevant loading and error. Focus is a 2px accent ring at 2px
offset, never removed.

- Loading uses skeletons shaped like the content, not centred spinners.
- Empty states teach the next action and say what is missing.
- Destructive actions confirm inline in the surface that owns them, not in a modal.

## Charts

Recharts. Rules that keep them readable on a projector:

- Grid lines at `--color-line`, 1px, horizontal only.
- Axis and tick labels at `--color-muted`, 12px minimum.
- Series colours in fixed order: accent (violet), cyan, emerald, amber, rose.
- Every chart states its sample size; no chart renders a fabricated zero when data
  is absent — it renders its empty state instead.
- Scatter points at 55% opacity so density is visible without over-plotting.

## Deliberate bans

No gradient text, no glass as a default surface (the sidebar's slight translucency
is the single exception and it sits over a static background), no decorative
side-stripe borders, no identical card grids, no uppercase tracked eyebrow above
every section, no numbered section scaffolding, no spinner-in-content.
