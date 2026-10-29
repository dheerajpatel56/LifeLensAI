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

Light, fixed. Paper ground, near-black ink, figures as the darkest marks on the
page — the way a printed statistical table reads. It survives a bright room and a
washed-out projector, and it reads as a report rather than as an app.

Neutrals are near-chromatic-zero and faintly cool. The warm cream/sand band is
deliberately avoided: it is the saturated default and reads as a template rather
than as paper. Colour strategy is **restrained** — one institutional ink-blue
accent for action and selection, plus a functional data ramp darkened for a light
ground.

No translucency anywhere. Every surface is opaque. (An earlier build used
`backdrop-blur` on the header — glass as a default surface is banned, and that
was the tell.)

## Tokens

Defined as CSS custom properties in `src/index.css`, consumed through Tailwind v4's
`@theme`. OKLCH throughout.

| Role | Token | Value |
|---|---|---|
| Paper | `--color-base` | `oklch(0.991 0.001 265)` |
| Chrome band | `--color-base-deep` | `oklch(0.958 0.002 265)` |
| Surface | `--color-surface` | `oklch(0.972 0.002 265)` |
| Raised | `--color-raised` | `oklch(0.941 0.003 265)` |
| Line | `--color-line` | `oklch(0.881 0.004 265)` |
| Line (strong) | `--color-line-strong` | `oklch(0.772 0.006 265)` |
| Ink | `--color-ink` | `oklch(0.212 0.013 265)` |
| Body | `--color-body` | `oklch(0.356 0.011 265)` |
| Muted | `--color-muted` | `oklch(0.492 0.011 265)` |
| Faint | `--color-faint` | `oklch(0.545 0.012 265)` |
| Accent (ink blue) | `--color-accent` | `oklch(0.448 0.132 257)` |

Data ramp, used for categorical series and semantic state only:
`--color-cyan`, `--color-positive`, `--color-warning`, `--color-negative`,
`--color-violet`.

Contrast, measured from rendered pixels rather than estimated: ink 17.2:1, body
10.8:1, muted 6.1:1, faint 4.8:1, accent 7.4:1, white-on-accent 7.6:1 — all above
AA. The faint step is kept **off** the tinted chrome band, where it would drop to
3.7:1; chrome text uses muted. Placeholders use muted, never a lighter grey.

## Type

**Three faces, each with a job.** Chrome, prose and data should not look alike:

- **Source Serif 4** for headings and document prose. The shift in face is what
  makes a heading a heading, without size or weight having to shout — and it is
  what makes the About page read as an article rather than as app furniture.
- **Inter** for interface chrome — labels, controls, navigation, table text.
- **JetBrains Mono** for every figure, via `.tnum`, `table`, `output` and `code`,
  with tabular figures so numbers do not shift as values change.

Serif is never used for UI labels, buttons or data — only for headings and prose.

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
