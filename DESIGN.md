# LifeLens AI — design system

Register: **product**. This is an analysis tool. The interface should disappear
into the task, and the data should be the only thing with presence.

## The shape of the app

The governing decision, and the one that matters most:

> **This is a workspace, not a document.**

Chrome is fixed — a one-line toolbar at the top, a navigation rail at the left, a
status bar at the bottom. Only the canvas scrolls. Content sits in defined grid
cells, not in a single scrolling column of full-width slabs.

That rules out the default dashboard shape: page title → paragraph → heading +
explanatory subtitle → bordered card, repeated downward. That structure is
documentation laid out as UI; every section announces and explains itself in the
same voice at the same size, and the result reads as generated regardless of what
is in it.

Concretely:

- **`SectionHead` is one line.** A small-caps label, optional inline meta on the
  right. There is no descriptive paragraph under a heading, anywhere.
- **Method notes live behind `MethodNote`**, a disclosure. The explanations are
  kept — this project has to defend its method — but they stop competing with the
  data for the same visual weight.
- **`Rail` + `Canvas`** split parameters from results on analysis views, so
  controls stay put while results scroll.
- **Borders are reserved for containers** — tables, callouts. Everything else is
  separated by hairlines and spacing.

## Theme

Dark, fixed. Justified by the two real usage scenes in PRODUCT.md: a laptop at
night, and a projector in a dim room.

Neutrals are near-chromatic-zero **graphite** (chroma 0.003–0.005). An earlier
build tinted them navy-violet, which read as decoration; a reporting tool should
look like paper under a desk lamp. Colour strategy is **restrained**: one accent
for action and selection, plus a functional data ramp.

No translucency anywhere. Every surface is opaque. (The first build used
`backdrop-blur` on the header — glass as default is banned, and that was the tell.)

## Tokens

Defined as CSS custom properties in `src/index.css`, consumed through Tailwind v4's
`@theme`. OKLCH throughout.

| Role | Token | Value |
|---|---|---|
| Page | `--color-base` | `oklch(0.179 0.003 265)` |
| Chrome | `--color-base-deep` | `oklch(0.149 0.003 265)` |
| Surface | `--color-surface` | `oklch(0.207 0.003 265)` |
| Raised | `--color-raised` | `oklch(0.247 0.004 265)` |
| Line | `--color-line` | `oklch(0.288 0.004 265)` |
| Line (strong) | `--color-line-strong` | `oklch(0.372 0.005 265)` |
| Ink | `--color-ink` | `oklch(0.967 0.002 265)` |
| Body | `--color-body` | `oklch(0.838 0.003 265)` |
| Muted | `--color-muted` | `oklch(0.668 0.004 265)` |
| Faint | `--color-faint` | `oklch(0.545 0.005 265)` |
| Accent (steel blue) | `--color-accent` | `oklch(0.604 0.128 248)` |

Data ramp, used for categorical series and semantic state only:
`--color-cyan`, `--color-positive`, `--color-warning`, `--color-negative`,
`--color-violet`.

Contrast: body on surface ≈ 7:1, muted on surface ≈ 4.6:1, ink on surface ≈ 14:1.
Placeholders use `--color-muted`, never a lighter grey.

## Type

**Two faces, on purpose.** Chrome and data should not look alike:

- **Inter** for interface text — labels, prose, controls, navigation.
- **JetBrains Mono** for every figure. Applied via `.tnum`, `table`, `output` and
  `code`, with tabular figures so numbers do not shift as values change.

Fixed rem scale (not fluid — this is a tool, not a landing page), ratio ≈ 1.15:

`0.6875 / 0.75 / 0.8125 / 0.875 / 0.9375 / 1.0625 / 1.1875 / 1.375 / 1.625rem`

The `.label` utility — small, caps, `0.06em` tracking — is the single label style
for table headers, section heads and field legends. It is one consistent system
element, not an eyebrow above every section.

Headings `text-wrap: balance`; prose `text-wrap: pretty`, capped at 70ch.
Letter-spacing floor on headings: `-0.015em`.

## Space and shape

4px base step. Radii: **3px controls, 4px containers**, full pill never used.
Nothing is rounded past 4px — over-rounding is what made the first build read as
consumer software.

Elevation: a 1px `--color-line` border **or** a shadow, never both on one element.
Only overlays (dialog, toast, tooltip) get a shadow, under 6px blur.

## Motion

anime.js v4, wrapped in `src/utils/motion.ts`. Three rules the module enforces:

1. **Everything respects `prefers-reduced-motion`** — reduced motion places the
   element in its final state instead of animating.
2. **Content is visible by default.** Helpers animate *from* a transform; they
   never gate visibility on an animation completing, so a transition that never
   fires cannot leave a blank panel.
3. **140–260ms.** The user is in a task, not watching a show.

What is animated, and why each one earns it:

| Motion | Where | Why it is state, not decoration |
|---|---|---|
| Travelling indicator | Pattern explorer tabs | Shows which of a sequence is selected, and the distance between them. Axis-aware: horizontal when the strip is horizontal, vertical once the rail appears. |
| Directional panel entry | Pattern explorer tabs | Enters from the direction of travel, so tabs read as positions in a sequence rather than unrelated screens. |
| Staggered reveal | Results within a panel | Signals that a new result set arrived. |
| Route settle | Canvas on navigation | A short settle, deliberately smaller than a tab change. |
| Count-up | Overview figures | The figure changing *is* the information. |

No page-load choreography, no decorative motion, no bounce or elastic easing.

## Components

Every interactive element ships default / hover / focus-visible / active /
disabled, plus loading and error where relevant. Focus is a 2px accent ring at 1px
offset, never removed.

- Loading uses skeletons shaped like the content, not centred spinners.
- Empty states say what is missing and what to do next.
- Destructive actions confirm inline in the surface that owns them, not in a modal.

## Charts

Recharts. Rules that keep them readable on a projector:

- Grid lines at `--color-line`, 1px, horizontal only.
- Axis and tick labels at `--color-muted`, 12px minimum.
- Series colours in fixed order: accent, amber, emerald, violet, cyan, rose —
  distinguishable in both hue and lightness.
- Every chart states its sample size; none renders a fabricated zero when data is
  absent — it renders its empty state instead.
- Scatter points at 50% opacity so density is visible without over-plotting.

## Deliberate bans

No glass or translucent surfaces, no gradient text, no decorative side-stripe
borders, no identical card grids, no explanatory paragraph under every heading, no
uppercase eyebrow above every section, no numbered section scaffolding, no radius
above 4px on a container, no border-plus-wide-shadow on the same element, no
spinner in place of content.
