# Testing

## Commands

**Backend — all tests**

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
python -m pytest
```

**Backend — verbose, or one area**

```powershell
python -m pytest -v
python -m pytest tests\test_mining.py -v
python -m pytest tests\test_datasets.py::test_import_valid_csv -v
```

**Frontend — type check and production build**

```powershell
cd frontend
npm run typecheck
npm run build
```

## Recorded results

Last run on Windows 11, Python 3.11.5, Node 24.11.1:

```
backend:   74 passed in 13.10s
frontend:  tsc -b            → no errors
frontend:  vite build        → built in 7.09s, 4 chunks, no warnings
```

| Suite | Tests | Covers |
|---|---:|---|
| `tests/test_api_checkins.py` | 15 | health endpoint, CRUD, validation, duplicate dates |
| `tests/test_datasets.py` | 18 | demo loading, source isolation, CSV import, preview, export, reset |
| `tests/test_mining.py` | 28 | clustering, correlation, association-rule arithmetic, metrics, insights |
| `tests/test_api_analytics.py` | 13 | analytics and insights endpoints over seeded data |
| **Total** | **74** | |

## Test design

**Isolation.** Every test gets its own throwaway SQLite file under pytest's `tmp_path`,
so tests never touch `backend/lifelens.db`, never depend on each other's data, and can
run in any order. The `client` fixture builds `TestClient` without its context manager
so the lifespan hook — which seeds demo data into the real database — does not fire.

**No network.** Nothing in the suite makes an outbound request. The one test that
loads the demo dataset reads the committed CSV from disk.

**Determinism.** Fixtures are small and hand-constructed. `make_records` generates a
known monotonic sleep/productivity relationship. `small_frame` is eight rows whose
Spearman coefficient can be worked out by hand. Clustering tests use seeded blobs.

## What is verified, and how

### Health and CRUD (`test_api_checkins.py`)

- `/api/health` returns `ok` with per-source record counts.
- Full create → read → update → list → delete cycle, asserting the values at each step.
- A second check-in on the same date returns **409** naming the existing record id.
- An update cannot steal another record's date.
- `by-date` lookup returns the record or 404, which is what drives the form's
  duplicate warning.

**Invalid input** — each rejected with 422 and a message naming the field:
sleep above 24; mood at 0 and at 11; a fractional mood; social media above screen
time; exercise above 1440; an invalid calendar date (`2024-02-31`); notes over 500
characters. One test then asserts that a rejected payload leaves **no** partial
record behind — invalid data is never silently corrected.

### Datasets (`test_datasets.py`)

- Demo load inserts > 1000 records and **is idempotent**: a second call inserts 0 and
  says so. Reloading with `replace=True` leaves the count unchanged.
- Loading demo data does not alter the user's own records.
- Switching the active source returns different record counts for each source,
  proving the three datasets are not merged.
- CSV import: a valid file accepts all rows and activates; alias headers
  (`Day`, `Sleep`, `Screen Time`) map to canonical fields.
- A deliberately broken file (one problem per row: out-of-range sleep, unparseable
  date, mood of 12, social media above screen time, a duplicate date) accepts exactly
  the two good rows, rejects five, counts one in-file duplicate, and reports the right
  `(row_number, field)` for every rejection.
- A file missing `mood_score` / `productivity_score` is rejected wholesale with those
  columns named.
- Non-`.csv` extensions and empty files are rejected with 422.
- A second import replaces the first import only — user records are untouched.
- Summary reports record count, date range, outcome availability and duplicate dates;
  an empty dataset reports `analyses_available: false` and explains itself.
- Preview paginates; export round-trips (61 lines for 60 records, header included).
- Clearing one source leaves the others intact.
- `safe_filename` neutralises `../../etc/passwd` → `passwd`.

### Algorithms (`test_mining.py`)

**Clustering**

- Two well-separated synthetic blobs are recovered with silhouette > 0.5 and all
  60 rows assigned.
- Labels are derived from profiles: two distinct names, none starting with "Cluster",
  and every cluster has at least one feature flagged above or below typical.
- Three rows refuse to cluster, with the 10-row minimum stated in the message.
- An empty frame returns `available: false` rather than raising.
- 20 rows containing only 2 distinct observations cap `k` at 2 when 6 was requested,
  and the response explains the reduction.
- Constant columns, `id` and `date` are excluded from `features_used`.
- A single `NaN` causes imputation, not row loss — all 60 rows still used.

**Correlation**

- The hand-checkable fixture returns **ρ = 0.994** for sleep vs productivity. The test
  documents why it is not exactly 1: ranks are 1–8 against 1, 2.5, 2.5, 4, 5, 6, 7, 8,
  and that single tie costs 0.006.
- A negative relationship is reported as negative.
- Pearson output matches `numpy.corrcoef` on the same slice to 1e-4.
- Blanking three stress values gives that pair `n = 5` while sleep/productivity keeps
  `n = 8` — per-pair sample sizes are real, not a single global count.
- A constant column is excluded with "constant" in the reason.
- Raising `min_samples` above the available data marks every pair "insufficient".
- A target filter returns only pairs involving that target; an unavailable target is
  explained rather than silently ignored.

**Association rules**

The core arithmetic test uses a 10-row table (doubled to 20 to clear the minimum)
constructed so the answer is computable on paper:

```
rows 1-6 : sleep 5 (Short), stress 8 (High); rows 1-5 productivity 3 (Low)
rows 7-10: sleep 8 (Long),  stress 2 (Low),  productivity 9 (High)

{Sleep: Short, Stress: High} → {Productivity: Low}
  count(Short ∧ High)            = 6  → support 0.6
  count(Short ∧ High ∧ Prod Low) = 5  → support 0.5
  confidence = 5/6 = 0.8333
  support(Productivity: Low) = 0.5
  lift = 0.8333 / 0.5 = 1.6667
```

The test asserts every one of those figures, plus the matching-transaction count and
the presence of the "does not show that one caused" caveat in the interpretation.

Additional tests check Apriori counts against brute force, confirm pruning below
`min_support`, confirm an informative empty state when thresholds are impossible,
confirm the 20-transaction refusal, and confirm the published band definitions.

**Metrics and insights**

- Overview means match the fixture exactly (sleep 6.75, productivity 5.75), and an
  absent column reports `null` with `sample_size` 0 rather than a misleading zero.
- Metrics ignore `NaN`: `[4, NaN, 8]` yields 6.0 with `n = 2`.
- An empty frame produces `sufficient: false` and "No records" guidance.
- Insights built from real mining output carry a detail, evidence and kind on every
  item; demo data is labelled synthetic; an empty dataset produces no invented findings.

### Endpoints (`test_api_analytics.py`)

- Overview computes from the active dataset, with the right sample sizes and seven
  recent check-ins.
- A date filter changes the numbers: 10 records in the window against 60 recorded,
  with both counts reported separately.
- Bad dates and reversed ranges are rejected with 422.
- An empty dataset returns empty trend and cluster arrays and `sufficient: false`,
  with every metric `null`.
- `n_clusters` of 1 and 99 are rejected; an unknown correlation method is rejected;
  `min_support` of 0 and `min_confidence` of 1.5 are rejected.
- Every returned rule satisfies `0 < support ≤ 1`, `0 < confidence ≤ 1`, `lift > 0`.
- Insights are grouped, carry disclaimers, and mark demo data synthetic.

## Manual verification performed

Driven through the in-app browser against both servers running (backend on 8000,
frontend on 5173):

| Check | Result |
|---|---|
| Frontend reaches the real backend | 1,200 demo records loaded through the Vite proxy; all `/api/*` requests 200 |
| Demo dataset loads on first start | seeded automatically, idempotent on repeat |
| Overview metrics are real | mood 5.7, productivity 6.3, sleep 7.0 h, stress 5.1, screen 6.3 h — each with `n = 1,200` |
| Clustering runs | 1,200 rows, 10 features, silhouette 0.199, PCA 64% explained variance, four labelled groups |
| Correlations run | 9 pairs for the productivity target, screen time −0.60, sleep quality +0.55, all `n` reported |
| Rules run | 768 rules from 684 frequent itemsets; top rule lift 3.13, confidence 87.8%, 189 matching days |
| Form validation | social media 9 h against screen time 5 h blocked inline, record not saved |
| Create a check-in | saved, appeared in the recent list, duplicate warning fired on re-entry of the same date |
| Overview updates after a check-in | switching to "My check-ins" showed 1 record, `n = 1` on every metric, "Limited data" guidance, no fabricated clusters |
| CSV import | 40-row fixture accepted, 0 rejected, imported source activated |
| Dataset switching | demo 1,200 / user 1 / import 40 held separately; no merging |
| Persistence | records survived a backend restart |
| Responsive layout | desktop sidebar, mobile drawer, no horizontal overflow at 375 px |
| Console | no application errors; the only 404s are the intentional `by-date` duplicate-check lookups |

## Not covered

- There is no automated browser/end-to-end suite. Frontend behaviour is covered by
  TypeScript, the production build, and the manual pass recorded above.
- No load or performance testing beyond the 1,200-record demo dataset.
- No cross-browser matrix; verified in a Chromium-based browser only.
