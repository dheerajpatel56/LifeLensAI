# Data-mining methodology

How each technique is implemented, what it assumes, how it is evaluated, and where
it stops.

---

## 1. Preprocessing

`app/services/preprocessing.py`

### Cleaning (applies to every technique)

1. Every known numeric column is coerced with `pd.to_numeric(errors="coerce")`;
   unparseable cells become `NaN` rather than failing the request.
2. Dates are parsed; rows with an unparseable date are dropped and counted.
3. Values outside the documented valid range are set to `NaN` — **not** deleted with
   the row. One impossible caffeine entry should not discard an otherwise usable day.
4. Infinities are replaced with `NaN`.
5. Rows are sorted by date.

A `PreprocessSummary` records rows in/out, columns used, columns excluded with
reasons, imputation counts and out-of-range counts, so the interface can state
exactly what happened rather than silently reshaping the data.

### Feature eligibility

A column is excluded from modelling when it is:

- an identifier, date or free-text column (`id`, `record_id`, `date`, `notes`, `source`) — never a feature, on principle;
- absent from the active dataset;
- entirely missing;
- **constant** — zero variance carries no information for either clustering or correlation.

Every exclusion is returned with its reason and shown in the UI.

### Two paths, deliberately different

| | Clustering (`prepare_feature_matrix`) | Correlation (`pairwise_frame`) |
|---|---|---|
| Goal | one consistent NaN-free matrix | maximum usable observations per pair |
| Rows missing > 50% of features | dropped and counted | kept |
| Remaining gaps | median-imputed, every fill counted | kept as `NaN` |
| Sample size | one number for the whole model | one number **per pair** |
| Why | K-Means cannot accept `NaN`, and every row must contribute every feature for distances to mean anything | discarding a whole row because one unrelated column is blank would throw away valid evidence for other pairs |

The clustering matrix is asserted finite before it reaches the model.

---

## 2. K-Means clustering

`app/services/clustering.py`

### Procedure

1. Build the feature matrix (above).
2. `StandardScaler` → mean 0, standard deviation 1 per feature.
3. Validate `k` against the data: `k = max(2, min(requested, distinct_rows, n_rows))`.
   If the request is reduced, the response says so.
4. `KMeans(n_clusters=k, random_state=42, n_init=10)`.
5. Silhouette score — **only** when at least two labels exist, labels < samples, and
   distinct observations > labels. Otherwise reported as "not computable" rather than faked.
6. PCA to two components for the projection chart, with explained variance reported.
7. Per cluster: size, share, per-feature mean, median, overall mean, and z-score.
8. Label derivation from the z-scored profile.

### Why standardise

K-Means minimises squared Euclidean distance. Exercise runs 0–1440 minutes; sleep
quality runs 1–10. Unscaled, exercise alone would decide every cluster because its
numeric spread is two orders of magnitude larger. Standardisation makes "one standard
deviation of exercise" and "one standard deviation of sleep quality" count equally.

### Why the labels are not cluster ids

Cluster id 0 means nothing — it is an arbitrary index that changes between runs. The
label is derived from the cluster's own profile: features more than 0.45 standard
deviations from the overall mean are "notable", and an ordered set of rules maps
those to a descriptive name (Active and Rested, Digital Night Owl, High-Stress
Achiever, Balanced Routine, Inconsistent Schedule, and so on). Duplicates are
suffixed so two clusters never present the same name.

These are **descriptive labels, not psychological diagnoses**, and the UI says so.

### Limitations stated in the product

- Unsupervised: clusters are exploratory profiles, not predictions or diagnoses.
- Cluster numbers are arbitrary and can be relabelled by any re-run.
- The 2D chart is a projection; points close in two dimensions may be far apart across all features.
- K-Means assumes roughly spherical, comparably sized clusters. Real lifestyle data overlaps heavily, so modest silhouette scores are the expected honest result.

---

## 3. Correlation analysis

`app/services/correlation.py`

### Procedure

1. Build the pairwise frame (NaNs retained).
2. For each pair: mask to rows where both are present; require `n ≥ 3`; require
   non-zero variance in *that slice*; compute `scipy.stats.pearsonr` or `spearmanr`.
3. Return the coefficient, that pair's `n`, and the p-value where computable.
4. Band the strength: `|r| < 0.1` negligible, `< 0.3` weak, `< 0.5` moderate, else strong.
5. Band the evidence: `n < min_samples` insufficient, `n < 30` limited, else reasonable.
6. Orient each pair so the outcome (or the chosen target) reads as the dependent side,
   and generate the interpretation sentence.

### Pearson vs Spearman

**Pearson** measures linear association on the raw values; it is sensitive to
outliers and assumes the relationship is a straight line. **Spearman** correlates the
*ranks*, so it captures any monotonic relationship and is robust to outliers and to
the fact that a 1–10 self-report is ordinal rather than truly interval. Spearman is
the default here for exactly that reason; Pearson is offered for comparison.

### On p-values

A p-value is shown where SciPy can compute one, and is described in the UI as a test
of the null hypothesis of no association on those observations. It is explicitly
**not** corrected for multiple comparisons — a 10×10 matrix tests 45 pairs, so some
will look notable by chance. The application does not describe any correlation as
"statistically significant", because the test that would license that claim has not
been run with the necessary correction.

### Why correlation is never causation here

Three alternatives always remain and none can be ruled out by this data: reverse
causation (a good day prompts exercise rather than the reverse), a confounder driving
both (exam week compresses sleep and raises stress at once), or coincidence in a
small sample. Every generated sentence carries that qualification.

---

## 4. Association-rule mining

`app/services/association_rules.py`

### Discretisation

Continuous variables are placed into fixed, documented bands (see
[DATA_DICTIONARY.md](DATA_DICTIONARY.md)). Cut points are chosen for everyday
interpretability rather than derived from the data, so "Sleep: Short" means the same
thing across datasets and across presentations. Each day becomes one transaction: a
set of band labels.

### Apriori

Implemented directly rather than imported, so the arithmetic is inspectable:

1. Count all 1-itemsets; keep those with `support ≥ min_support`.
2. Generate `k`-itemset candidates by joining frequent `(k-1)`-itemsets.
3. **Prune**: discard any candidate with an infrequent subset (the Apriori property —
   a superset can never be more frequent than its subsets).
4. Count the survivors; keep the frequent ones; repeat until no candidates remain or
   the size cap is reached.

### Rule generation and metrics

For every frequent itemset of size ≥ 2, split into antecedent and a **single-item**
consequent (which keeps rules readable):

```
support(X→Y)    = count(X ∪ Y) / N
confidence(X→Y) = support(X ∪ Y) / support(X)
lift(X→Y)       = confidence(X→Y) / support(Y)
```

Rules below `min_confidence` or `min_lift` are dropped; the rest are sorted by lift,
then confidence, then support.

**Reading them:** support is how much of the whole dataset the rule covers — a rule
with high confidence but tiny support describes a handful of days. Confidence is how
often the consequent followed the antecedent. Lift compares that to the consequent's
own base rate: above 1 means more co-occurrence than independence predicts, exactly 1
means the rule adds nothing to base rates. **None of the three is a causal claim.**

### Empty results are a result

If no rule clears the thresholds, the response says so and offers to loosen them. It
does not lower the bar silently to produce something to display.

---

## 5. Insight generation

`app/services/insight_service.py`

Sentence templates filled with numbers the mining services computed. **No language
model, no external API.** The consequence is that the engine cannot describe a
finding the data does not contain.

Rules it follows:

- Observations and suggestions are separate categories and are labelled as such.
- Suggestions are framed as experiments to run ("track whether reducing X changes
  your recorded Y"), never as predicted outcomes.
- Sample size appears in every evidence line; small samples carry an explicit caveat.
- Findings below the evidence threshold are not promoted to insights at all.
- Demo-data insights are labelled synthetic; user-data insights are labelled as
  describing that dataset only.
- No medical advice and no causal language, anywhere.

---

## 6. Evaluation summary

| Technique | Measures reported | Honest failure mode |
|---|---|---|
| Clustering | silhouette (when defined), inertia, cluster sizes, per-feature profiles with z-scores | refuses below 10 rows; caps `k` at the number of distinct observations; says when silhouette is not computable |
| Correlation | coefficient, per-pair `n`, p-value where computable, strength band, evidence band | excludes constant columns with a reason; flags every pair as insufficient when all are below the threshold |
| Association rules | support, confidence, lift, antecedent support, consequent support, matching day count | refuses below 20 transactions; returns an informative empty state when nothing clears the thresholds |
| Overview | per-metric sample size; sufficiency assessment with specific guidance | reports `null` rather than 0 for an absent column |

Backend correctness is covered by 74 pytest tests, including association-rule
arithmetic verified against a hand-computed 10-row table and Pearson output verified
against NumPy on the same slice. See [TESTING.md](TESTING.md).

---

## 7. Why not classification

Classification learns a mapping from features to a known label and predicts that
label for unseen records. It needs a ground truth that exists independently of the
features.

LifeLens has none. Mood and productivity are the user's own ratings, recorded on the
same day as the features, by the same person, in the same sitting. "Predicting" them
from that day's habits would be close to circular, and treating a self-report as an
objective target would overstate what the data supports.

The questions this project actually asks are *"what kinds of days do I have?"* and
*"which habits move with how my days go?"* Those are grouping and association
questions. Forcing a classifier onto them would produce an accuracy score that looks
rigorous and means very little.
