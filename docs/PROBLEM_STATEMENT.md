# Problem statement

## The problem

A person generates dozens of measurable lifestyle signals every day — how long they
slept and how well, how many hours they spent on a screen and how much of that was
social media, whether they exercised, how long they studied or worked, how much
caffeine they drank, how stressed they felt, how their mood actually was, how much
they got done.

Almost none of it is ever examined. Phones and watches log some of it; notebooks and
apps capture the rest; and it sits there. The relationships connecting those habits
to how a day actually turned out stay hidden, because nobody sits down and mines
their own records.

The result is that people reason about their own routines from memory, which is
exactly the wrong instrument: recall is biased toward recent days, dramatic days and
days that confirm what they already believe.

## Why existing tools do not close the gap

Consumer wellness applications fail in one of two directions:

1. **Logging without analysis.** They present the raw trail back — a bar chart of
   steps, a ring of sleep hours — and leave every inference to the user.
2. **Assertion without evidence.** They state conclusions ("your sleep is hurting
   your focus") with no visible coefficient, no sample size, and no way to check
   whether the claim rests on three days or three hundred. Several go further and
   infer emotional state from device signals, which is an overreach the underlying
   data cannot support.

Neither gives a person what they would need to actually trust a finding about
themselves: the number, the sample it came from, and an honest statement of what it
does and does not establish.

The gap is not data collection. It is **honest, inspectable pattern discovery over
data the person already has.**

## What LifeLens AI does about it

LifeLens AI applies three unsupervised data-mining techniques to one person's
lifestyle records and reports what it finds with the evidence attached:

- **K-Means clustering** over standardised lifestyle features, to answer "what kinds
  of days do I actually have?" — producing routine archetypes nobody defined in advance.
- **Correlation analysis** (Pearson or Spearman) computed pairwise-complete, to answer
  "which habits move with my mood and productivity?" — with each pair's own sample
  size carried all the way to the screen.
- **Association-rule mining** (Apriori) over discretised bands, to answer "which
  *combinations* of conditions travel together?" — scored by support, confidence and lift.

Every result is explained in plain English generated deterministically from the
computed numbers. There is no language model inventing narrative, and no external
service involved.

## Scope boundaries

These are design constraints, not caveats added afterwards:

| LifeLens does | LifeLens does not |
|---|---|
| Analyse data the user typed or imported | Infer mood from screen time, notes or sensors |
| Report associations with sample sizes | Claim that any habit *causes* any outcome |
| Describe structure in one dataset | Generalise to other people or to populations |
| Say when the evidence is too thin | Fill a sparse dataset with a confident-looking number |
| Run entirely on the local machine | Send data anywhere, or require an account or API key |
| Explain its own method and limits | Offer medical, clinical or diagnostic advice |

Mood and productivity are **self-reported**. That is a deliberate choice, not a
missing feature: a person's own rating of their day is the honest measurement
available, and treating a device signal as a proxy for an emotional state would make
every downstream number mean less than it appears to.

## Success criteria

The project succeeds if:

1. A user can record a day in under a minute, with invalid data caught and explained
   rather than silently corrected.
2. Every figure on screen is computed from the active dataset — no hardcoded or
   decorative statistics anywhere.
3. Each of the three mining techniques runs on real data and exposes its own
   parameters, so the method is inspectable rather than a black box.
4. Thin, empty and malformed data produce an honest explanation of what is missing,
   never an invented result.
5. The methodology can be defended out loud: why clustering rather than
   classification, why scaling matters, what lift means, why correlation is not cause.
