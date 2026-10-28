# LifeLens AI — product context

**Full title:** Mining the Hidden Patterns Behind Your Daily Life
**Tagline:** Understand your patterns. Discover your rhythm. Make every day count.
**Register:** product (design serves the task — this is a tool, not a campaign page)

## What it is

A local-first personal behavioural analytics tool. The user records a daily
check-in (sleep, screen time, exercise, study/work, caffeine, stress, plus
self-reported mood and productivity), and the app mines that data for patterns
using K-Means clustering, correlation analysis and association-rule mining.

The whole product is one pipeline, and the UI exists to make each stage legible:

> Data → Cleaning → Mining → Pattern discovery → Explanation → Visualisation → Insight

## What it is not

- Not a medical or diagnostic system. It gives no clinical advice.
- Not mood detection. Mood and productivity are **self-reported**, never inferred
  from screen time, notes or sensors.
- Not a prediction engine. It describes associations in one dataset and says so.
- Not a cloud product. No accounts, no API keys, no telemetry, no uploads leaving
  the machine.

## Who uses it

A student running their own data, in two situations:

1. **Nightly, alone, on a laptop, lights low** — filling in one check-in, glancing
   at whether the week is trending.
2. **Live, in front of a class and an examiner, on a projector in a dim room** —
   walking through the pipeline and defending the methodology out loud.

Both scenes are low-light and chart-heavy, and the second one punishes thin
hairlines and pale greys on a washed-out projector. That forces the theme: **dark,
with charts and numbers as the brightest things on screen.**

## Jobs to be done

| Job | Surface |
|---|---|
| Log today honestly, in under a minute | `/check-in` |
| See whether this week differs from last | `/` overview |
| Find which habits move with mood and productivity | `/patterns` |
| Get a plain-English read on what the numbers mean | `/insights` |
| Bring in / export my own data, and know which dataset I'm looking at | `/datasets` |
| Explain and defend the method | `/about` |

## Non-negotiables

- Every number on screen is computed from the active dataset. No decorative stats.
- Sample size travels with every claim. Weak evidence is labelled as weak.
- The active dataset (synthetic demo / own check-ins / imported CSV) is always
  visible, because every number means something different depending on which it is.
- Correlation is never presented as cause, anywhere, in any string.
- Empty and insufficient-data states explain what is missing and how to fix it.
