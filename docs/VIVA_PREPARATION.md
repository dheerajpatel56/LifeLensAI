# Viva preparation

Everything below is answerable from the code in this repository. Where a number is
quoted, it comes from a real run on the demo dataset.

---

## The thirty-second answer

> LifeLens AI mines a person's daily lifestyle data for patterns connected to
> self-reported mood and productivity. It uses three unsupervised techniques —
> K-Means clustering to find routine archetypes, correlation analysis to measure
> habit–outcome relationships, and Apriori association-rule mining to find
> combinations of conditions that travel together. Every result carries its sample
> size, and nothing is presented as causal.

---

## 1. What problem does this solve?

People generate a dense trail of daily lifestyle data and never examine it, so they
reason about their own routines from memory — which is biased toward recent and
dramatic days. Existing apps either show raw logs with no analysis, or assert
conclusions with no visible evidence. LifeLens closes that gap: it mines the data a
person already has and shows the working.

## 2. Why is this a data-mining project rather than a dashboard?

A dashboard displays what was recorded. This project **discovers structure that was
not recorded**:

- K-Means finds groups nobody defined in advance.
- Correlation quantifies relationships nobody entered.
- Apriori finds co-occurring combinations across the whole dataset.

All three are unsupervised: the output is knowledge extracted from the data, not a
re-presentation of it. The full pipeline — collection, cleaning, transformation,
mining, evaluation, interpretation, visualisation — is implemented as distinct
modules, not as a diagram drawn afterwards.

## 3. Why clustering rather than classification?

Classification needs a ground-truth label that exists independently of the features.
Here, mood and productivity are the user's own ratings, recorded on the same day, by
the same person, in the same sitting as the features. Predicting them from that day's
habits would be close to circular, and treating a self-report as an objective target
would overstate what the data supports.

The real questions are "what kinds of days do I have?" (grouping) and "which habits
move with how my days go?" (association). Forcing a classifier onto those would
produce an accuracy figure that looks rigorous and means very little.

## 4. How does K-Means work?

1. Choose `k` initial centroids.
2. Assign every record to its nearest centroid by Euclidean distance.
3. Move each centroid to the mean of the records assigned to it.
4. Repeat 2–3 until assignments stop changing.

It minimises the total within-cluster sum of squared distances (the **inertia**).
This implementation fixes `random_state=42` and uses `n_init=10` — ten independent
initialisations, best result kept — so the same data always yields the same grouping.

## 5. Why standardise the features first?

K-Means measures straight-line distance, so a feature with a wide numeric range
dominates one with a narrow range. Exercise runs 0–1440 minutes while sleep quality
runs 1–10; unscaled, exercise alone would decide every cluster. `StandardScaler`
gives each feature mean 0 and standard deviation 1, so one standard deviation of
exercise counts the same as one standard deviation of sleep quality.

## 6. How do you choose k?

The user selects it (2–8), and the application validates it against the data:
`k = max(2, min(requested, distinct_observations, n_rows))`. Asking for 6 clusters
from 2 distinct observations is impossible, so it is reduced and the reduction is
stated. The silhouette score is displayed so the user can compare values of `k`
empirically.

## 7. How do you interpret the silhouette score?

For each record it compares the mean distance to its own cluster against the mean
distance to the nearest other cluster, giving a value in [−1, +1]:

- near **+1** — tight, well-separated clusters;
- near **0** — clusters overlap and the boundary is largely arbitrary;
- **negative** — records would fit a neighbouring cluster better.

The demo dataset scores about **0.199** at k=4. That is honest, not a failure: real
lifestyle data lies on a continuum rather than in separate blobs. A project reporting
0.9 on data like this would more likely be reporting a bug or a leak. The score is
computed only when it is mathematically defined (≥ 2 labels, labels < samples,
distinct observations > labels), and reported as "not computable" otherwise.

## 8. What does PCA do here?

Principal Component Analysis projects the ten standardised features onto the two
directions carrying the most variance, purely so the clusters can be drawn on a flat
screen. On the demo dataset those two components capture about **64%** of the total
variance — so roughly a third of the structure is not visible in that picture. Two
points that look adjacent on the chart may differ substantially on the discarded
dimensions. PCA is used for visualisation only; the clustering itself runs on all
features.

## 9. Why is correlation not causation?

A coefficient measures only co-movement. Three alternatives always remain:

1. **Reverse causation** — a good day prompts exercise, rather than exercise producing the good day.
2. **A confounder** — exam week compresses sleep and raises stress simultaneously, so the two correlate without either causing the other.
3. **Coincidence** — with 45 pairs in a 10×10 matrix, some will look notable by chance.

None can be ruled out by observational data collected on a single person, so every
generated sentence in the application says "association, not proof".

## 10. Pearson or Spearman — and why is Spearman the default?

Pearson measures *linear* association on raw values and is sensitive to outliers.
Spearman correlates the **ranks**, so it captures any monotonic relationship and is
robust to outliers. Mood, stress and productivity are 1–10 ordinal self-reports where
the gap from 3 to 4 is not necessarily the gap from 8 to 9, which is exactly the case
Spearman is built for. Pearson is offered alongside for comparison.

## 11. Why does each correlation have a different n?

Because each pair is computed on its **pairwise-complete** observations. If stress is
missing on three days, pairs involving stress lose those three days while other pairs
keep them. Dropping the whole row would throw away valid evidence for every other
pair. The trade-off is that sample sizes differ between cells, so the application
reports each pair's own `n` rather than one headline number.

## 12. Explain support, confidence and lift.

For a rule X → Y across N transactions (one per day):

| Metric | Formula | Reads as |
|---|---|---|
| Support | `count(X ∪ Y) / N` | how much of the whole dataset this rule covers |
| Confidence | `support(X ∪ Y) / support(X)` | given X, how often Y also held |
| Lift | `confidence / support(Y)` | how much more often they co-occur than chance predicts |

Worked example from a real run:

> **Screen time: High + Study/work: Light → Social media: High**
> support 13.8%, confidence 87.8%, lift 3.13, 189 matching days of 1,200.

So 189 days had high screen time and light study/work; on 88% of those, social media
was also high; and that is 3.13× the rate expected if the two were unrelated (the
base rate of high social media being 28%).

**Lift = 1** means the rule adds nothing to base rates. **Lift > 1** means more
co-occurrence than independence predicts. Neither is a causal statement.

## 13. Why do you need all three metrics?

Each alone is misleading. High confidence with tiny support describes a handful of
days. High support with lift near 1 is just two common things coinciding because both
are common. High lift with 4 matching days is noise. Read together they say: it
happens often enough to matter, it holds reliably, and it is more than chance.

## 14. How does Apriori work, and what is the Apriori property?

1. Count all 1-itemsets; keep those above `min_support`.
2. Join frequent `(k−1)`-itemsets to generate `k`-itemset candidates.
3. **Prune** any candidate that has an infrequent subset.
4. Count the survivors, keep the frequent ones, repeat.

The pruning step is the Apriori property: *a superset can never be more frequent than
any of its subsets*. If "Short sleep" occurs on 20% of days, no itemset containing
"Short sleep" can exceed 20%. That lets the algorithm discard most candidates without
ever counting them, which is what makes it tractable.

It is implemented directly in `app/services/association_rules.py` rather than
imported, so the arithmetic is inspectable — and it is verified in the test suite
against a hand-computed 10-row table.

## 15. Why discretise, and what do you lose?

Association rules operate on items, not numbers — "Short sleep" is an item, "6.3
hours" is not. Fixed documented bands (sleep < 6 Short, 6–8 Moderate, ≥ 8 Long) keep
a rule meaning the same thing across datasets.

What is lost is resolution: 5.9 hours and 3 hours both read as "Short", and a day at
5.99 hours sits in a different band from one at 6.01. That is the stated trade-off;
quantile-based binning is listed as a future enhancement.

## 16. How was the synthetic dataset generated?

`backend/scripts/generate_demo_dataset.py`, seed `20240517`, 1,200 records:

1. Each day is assigned one of five routine profiles by weighted draw (consistent
   routine 26%, late-night digital 22%, high-workload 20%, active and rested 18%,
   irregular 14%).
2. Habit values are drawn from that profile's normal distributions and clipped to the
   documented valid ranges.
3. Weekends get more sleep, less study/work and slightly lower stress, adding
   within-profile variation.
4. Social media is derived as a fraction of screen time, so that constraint always holds.
5. Mood and productivity are a weighted sum of the habits **plus Gaussian noise with
   standard deviation ≈ 2.05**, clipped to 1–10 and rounded.
6. About 1.2% of rows have one optional field blanked, so the missing-value reporting
   has something real to describe. Required fields are never blank.

**Why so much noise?** With small noise the correlations came out at 0.65–0.74, which
is unrealistically clean for self-reported human data and would have made the demo
look rigged. At sd 2.05 they land at 0.40–0.61 — the moderate band real behavioural
data actually produces.

## 17. Is the demo data presented as a real finding?

No. It is labelled synthetic in the dataset bar, in a banner on the Overview page, in
the dataset summary, and in the disclaimer on every insight generated from it. The
generation method and its limitations are documented in `backend/data/README.md`.

## 18. What does this application measure, and what can it not claim?

**It measures** what the user typed, and it describes statistical structure inside
that data.

**It cannot claim** clinical validity, diagnose anything, establish that any habit
causes any outcome, predict future mood or productivity, or generalise beyond the
person whose data it holds.

## 19. How is bad data handled?

Three layers: the browser (Zod) for immediate feedback, the API (Pydantic) because
the server never trusts the browser, and the CSV importer for bulk data.

Ranges, whole-number rules on 1–10 scales, and cross-field rules (social media ≤
screen time; sleep + study/work ≤ 24) are enforced at every layer. Out-of-range
values found during preprocessing are blanked rather than deleting the whole row.
Import reports every rejected row with its number, field and reason — nothing is
silently dropped or corrected. Duplicate dates return 409 naming the existing record,
and the form offers to edit it instead.

## 20. What happens when there is not enough data?

Each technique refuses with an explanation rather than producing something that looks
like an answer: clustering below 10 rows, rules below 20 transactions, correlations
below the sample threshold are flagged "insufficient". The dashboard states exactly
how many records exist and how many are needed. Empty datasets render empty states,
not empty charts.

## 21. How do you know the implementation is correct?

74 pytest tests. The ones that matter most:

- Association-rule support, confidence and lift checked against a hand-computed
  10-row table (the exact figures are in `docs/TESTING.md`).
- Pearson output checked against `numpy.corrcoef` on the same slice.
- Spearman checked against a hand-derived ρ of 0.994, with the tie that costs the
  remaining 0.006 documented in the test.
- Two separated synthetic blobs must recover with silhouette > 0.5.
- Per-pair sample sizes verified by blanking three values and asserting one pair
  drops to n=5 while another stays at n=8.
- A rejected check-in must leave no partial record behind.

## 22. Why FastAPI, SQLite and React?

FastAPI gives typed request/response schemas with validation and automatic API docs,
and it sits directly on the Python scientific stack where the mining actually
happens. SQLite needs no server process, which keeps the project local-first and
genuinely runnable on any laptop. React with TypeScript keeps the API contract typed
end to end — `types/api.ts` mirrors the Pydantic schemas.

## 23. Where is the business logic, and why does that matter?

Entirely in `app/services/`. Route handlers only validate, delegate and set status
codes. That separation is why the algorithms can be tested directly on DataFrames
without an HTTP client, and why the frontend can hold no business logic of its own.

## 24. How are the insight sentences produced? Is an LLM involved?

No. `insight_service.py` fills deterministic sentence templates with numbers the
mining services computed. The consequence is that the engine **cannot** describe a
finding the data does not contain. Observations and suggestions are separate
categories; suggestions are phrased as experiments to try, never as predicted outcomes.

## 25. What would you do next?

Lagged correlation, so last night's sleep can be tested against today's productivity
rather than the same day's — that is the single change that would most improve what
the project can claim. Then two-range comparison, quantile binning alongside the
fixed bands, DBSCAN as a cross-check on K-Means, and multiple-comparison correction
on the correlation matrix.

---

## Likely challenges, and honest answers

**"Your silhouette score is low."**
Yes — about 0.199. Real lifestyle data is continuous, not naturally separated into
blobs. The score is displayed rather than hidden precisely so that limitation is
visible. A high score here would be more suspicious than a modest one.

**"The relationships are just artefacts of your generator."**
In the demo dataset, correct — and the application says so everywhere that data is
shown. The demo exists to demonstrate that the pipeline works; the real test is
importing genuine data, which the application supports.

**"Isn't mood too subjective to analyse?"**
It is subjective, which is why it is never inferred and always labelled
self-reported. Subjective does not mean unanalysable: the same person rating days on
the same scale produces internally comparable data. It does mean the result describes
that person's reporting, not an objective quantity, and the limitations section says so.

**"Why not just use mlxtend for Apriori?"**
Because the arithmetic is the part most worth being able to defend. Writing it out
makes it inspectable, testable against a hand-computed example, and explicable line
by line.

**"Couldn't you get better numbers by lowering the thresholds?"**
Yes, and that is exactly why they are configurable and visible. Lowering
`min_support` surfaces more rules; the matching-day count then shows how little data
each one rests on. The application never quietly lowers a bar to produce something to
display.
