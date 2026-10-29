# Novelty and research gap

Written to be defended, not to impress. An examiner will probe the novelty claim
harder than anything else in the project, and the fastest way to lose that
exchange is to claim more than the work supports. This document states the
contribution precisely, and states just as precisely what is **not** claimed.

---

## 1. What kind of contribution this is

**It is not an algorithmic contribution.** Every algorithm used is textbook:

| Technique | Origin |
|---|---|
| K-Means | Lloyd (1957), MacQueen (1967) |
| Pearson correlation | Pearson (1895) |
| Spearman rank correlation | Spearman (1904) |
| Apriori | Agrawal & Srikant (1994) |
| Silhouette coefficient | Rousseeuw (1987) |
| PCA | Pearson (1901), Hotelling (1933) |

Nothing here improves on any of them, and the project should never suggest it does.

**The contribution is in composition and discipline** — which combination of
established methods is applied to which problem, and what the system refuses to
say. That is a legitimate category of contribution for an applied project, and it
is the category this work belongs to.

---

## 2. The research gap

Work on lifestyle and behavioural analytics falls into three strands. The gap is
what sits between them.

### Strand A — population-level epidemiology

Large-N studies establish associations across populations: sleep and cognitive
performance, screen time and wellbeing, exercise and mood.

**Limitation for an individual.** A population-level coefficient describes a
group average and does not license an inference about one person. Treating it as
though it does is the **ecological fallacy** (Robinson, 1950). "Seven to nine
hours is associated with better outcomes across a cohort" does not establish what
*your* productive days look like. The direction, size, and even the sign of an
effect can differ for an individual.

### Strand B — consumer self-tracking applications

Phones, watches and wellness apps collect the data continuously. They then do one
of two things:

1. **Display without analysis** — a bar chart of steps, a ring of sleep hours.
   Every inference is left to the user, who reasons from memory, which is biased
   toward recent and dramatic days.
2. **Assert without evidence** — a confident statement with no coefficient, no
   sample size, and no way to check whether it rests on three days or three
   hundred. Some infer emotional state from device signals, which overreaches
   what the underlying data supports.

**Limitation.** Neither gives the user the thing required to actually trust a
finding about themselves: the number, the sample it came from, and an honest
statement of what it does and does not establish.

### Strand C — N-of-1 methodology

Single-case and N-of-1 designs are rigorous and are the methodologically correct
frame for individual inference. They are also typically **confirmatory** — a
hypothesis is specified in advance and tested, often with randomisation and a
clinician or researcher administering the design.

**Limitation.** They require expertise and a pre-specified hypothesis. They do not
help a person who does not yet know which of their habits is worth examining.

### The gap

> **Exploratory, unsupervised pattern discovery on a single person's own data,
> where the strength of evidence is reported alongside every claim and the system
> declines to report when the evidence is insufficient — usable without a
> statistician.**

Strand A has rigour but not individual relevance. Strand B has individual data but
no rigour. Strand C has both but requires a hypothesis and an expert, and is
confirmatory rather than exploratory.

LifeLens AI occupies the hypothesis-generating position: it does not test a claim,
it surfaces candidate patterns *with their uncertainty attached*, which a person
could then take into a properly designed N-of-1 test. That framing is also the
honest ceiling of what the system can do.

---

## 3. Novelty claims, ranked by how well they hold up

Claim them in this order. The first two are solid; the third is defensible; the
fourth is a design claim, not a research one.

### 3.1 Tri-technique composition over one personal dataset

Three unsupervised methods are applied to the *same* records, each answering a
question the others structurally cannot:

| Question | Method | Why the others cannot answer it |
|---|---|---|
| *What kinds of days do I have?* | K-Means | Correlation and rules describe variables, not whole days |
| *Which habits move with my outcomes, and how strongly?* | Correlation | Clustering gives groups, not a signed magnitude; rules work on bands, losing resolution |
| *Which **combinations** of conditions travel together?* | Apriori | Pairwise correlation cannot express a joint condition such as "short sleep **and** high stress" |

Most comparable student and consumer systems apply one technique. Composing three
and cross-referencing their outputs is the substantive methodological content of
this project. The honest phrasing is *"a composed pipeline"*, not *"a novel
algorithm"*.

### 3.2 Evidence-first reporting, including refusal

This is the strongest defensible claim, because it is a stance the system actually
implements rather than a feature it advertises:

- Every correlation carries **its own pairwise-complete sample size**, not one
  global `n`, because blanking three stress values changes the evidence for
  stress pairs and nothing else.
- Every pair is banded — insufficient / limited / reasonable — against a
  configurable threshold.
- Clustering **refuses** below 10 complete records; rule mining refuses below 20
  transactions; both explain why instead of producing a result that looks like an
  answer.
- Silhouette is reported **only when mathematically defined**, and reported as
  "not computable" otherwise rather than silently omitted.
- No correlation is ever described as "significant", because the multiple-
  comparison correction that would license that claim is not applied — and the
  interface says so.

The refusal behaviour is the part worth defending. A system that declines to
report is making a methodological commitment that a system optimising for
engagement cannot make.

### 3.3 Deterministic explanation rather than generative

Insights are produced by filling sentence templates with computed figures. No
language model, no external service.

The defensible consequence: **the explanation engine cannot describe a finding
that is not in the data.** A generative layer can produce fluent text
unsupported by the computation behind it; a template cannot. In a period when the
default move is to attach an LLM to the output, choosing not to — and giving a
methodological reason — is a position, not a limitation.

### 3.4 Provenance isolation by construction

Synthetic demo data, user-entered records and imported CSVs are stored with a
`source` discriminator and `UNIQUE(source, date)`, are never merged, and the
active source is labelled at the point every claim is made. Synthetic findings are
marked synthetic wherever they appear.

This is a software design claim. State it as engineering rigour, not research
novelty.

---

## 4. What is explicitly not claimed

Saying this first, unprompted, is worth more than any claim above. It signals you
know where the boundary is.

- **No new algorithm or statistical method.**
- **No empirical finding.** The demo dataset is synthetic; its relationships are
  artefacts of the generator and are labelled as such throughout.
- **No validation study.** No participants, no ground truth, no comparison against
  a baseline system, no user evaluation.
- **No causal claim.** The design makes causal language structurally impossible in
  the generated output.
- **No clinical or diagnostic claim.**
- **No generalisation.** Findings describe one dataset belonging to one person.
- **No predictive claim.** Mood and productivity are same-day self-reports; a
  model predicting them from that day's features would be close to circular.

---

## 5. Research gaps this project leaves open

These are the honest "future work" answers, and each names a real methodological
limitation rather than a feature wish.

### 5.1 Temporal structure — the largest gap

Features and outcomes are recorded for the **same day**, so no temporal ordering
is established. "Last night's sleep against today's productivity" is a different
and more defensible question than the one the system currently answers.

*Direction:* lagged correlation, cross-correlation at multiple lags, or
Granger-style testing adapted to short personal series. This single change would
most improve what the project can legitimately claim.

### 5.2 Multiple comparisons

A 10×10 matrix tests 45 pairs. Some will reach any conventional threshold by
chance. The system currently reports p-values, declines to call anything
significant, and states that no correction is applied.

*Direction:* Benjamini–Hochberg false discovery rate control, with the interface
distinguishing corrected from uncorrected claims.

### 5.3 No causal layer

Observational single-person data cannot separate reverse causation, confounding,
or coincidence.

*Direction:* guided N-of-1 trial support — the system proposes a candidate from
the exploratory stage, then helps run a randomised within-person test of it. This
is the natural research continuation and would move the work from Strand B into
Strand C.

### 5.4 Non-stationarity and within-person baselines

Clustering treats all records as drawn from one stable distribution. A person's
routine drifts — term time versus vacation, illness, a new job. Standardisation is
computed across the whole record set rather than against a moving personal
baseline.

*Direction:* time-aware or sequence clustering, change-point detection, rolling
standardisation.

### 5.5 Discretisation sensitivity

Association rules use fixed cut points, so 5.9 and 3.0 hours of sleep both read as
"Short", and 5.99 versus 6.01 fall in different bands. No sensitivity analysis is
performed.

*Direction:* quantile-based binning shown alongside fixed bands, plus a stability
check on whether a rule survives a change of cut point.

### 5.6 Measurement error in the outcome

Self-reported mood and productivity carry recall bias, mood-congruent reporting
and inconsistent personal scales. The system treats them as observed values with
no error term.

*Direction:* repeated or interval measurement, explicit uncertainty on the outcome.

### 5.7 Cluster validity

K-Means assumes roughly spherical, comparably sized clusters, which continuous
lifestyle data does not guarantee. Only one algorithm is used, so there is no
cross-check on whether the structure found is an artefact of that assumption.

*Direction:* agreement analysis across K-Means, hierarchical and DBSCAN; stability
under resampling.

---

## 6. Likely challenges, and how to answer them

**"What is actually new here? These are all standard algorithms."**
> Nothing in the algorithms. The contribution is the composition — three
> unsupervised methods answering three structurally different questions over one
> person's records — and the reporting discipline, in particular that the system
> refuses to produce a result when the evidence is insufficient rather than
> producing one that looks like an answer.

**"Isn't this just a dashboard?"**
> A dashboard displays what was recorded. This discovers structure that was not
> recorded: groups nobody defined, coefficients nobody entered, and combinations
> found across the whole dataset. The full pipeline — cleaning, transformation,
> mining, evaluation, interpretation — is implemented as separate modules.

**"Your silhouette score is only 0.199."**
> Correct, and it is displayed rather than hidden. Continuous lifestyle data lies
> on a continuum rather than in separated blobs. A high score on data like this
> would be more suspicious than a modest one — it would suggest leakage or a bug.

**"The demo data is synthetic, so you have found nothing."**
> Correct for the demo dataset, and the application says so wherever it appears.
> The synthetic data demonstrates that the pipeline works end to end; the system
> is designed to run on imported real data, which is where any finding would come
> from.

**"Where is your evaluation?"**
> There is no user study and no empirical validation — I am not claiming either.
> What is validated is correctness: 74 tests, including association-rule support,
> confidence and lift checked against a hand-computed table, and correlation
> output checked against NumPy on the same slice.

**"Why not use deep learning?"**
> The dataset is one person's daily records — hundreds of rows, roughly ten
> features. That regime does not support a deep model, and the questions being
> asked are grouping and association questions, which are not prediction problems.
> Using a deep model here would produce a worse answer with a more impressive name.

---

## 7. One-paragraph statement for the report

> Population-level studies establish associations across cohorts but cannot
> license inference about an individual; consumer self-tracking applications hold
> individual data but either present it without analysis or assert conclusions
> without evidence; N-of-1 designs are rigorous but confirmatory, requiring a
> pre-specified hypothesis and expert administration. LifeLens AI addresses the
> space between them: exploratory, unsupervised pattern discovery over a single
> person's lifestyle records, composing K-Means clustering, rank correlation and
> Apriori association-rule mining so that each answers a question the others
> cannot, and reporting the strength of evidence — pairwise sample size, evidence
> band, validity of the cluster metric — alongside every claim. The system
> declines to report when the evidence is insufficient, and generates its
> explanations from deterministic templates filled with computed figures rather
> than from a generative model, so that no stated insight can exceed what the data
> contains. The contribution is one of composition and reporting discipline rather
> than of algorithm; the work is hypothesis-generating, and its principal
> limitation — that features and outcomes share a day, establishing no temporal
> ordering — defines its clearest line of continuation.
