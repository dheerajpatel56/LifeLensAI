# System architecture

Two processes on one machine, with a strict separation: the browser renders and
validates for fast feedback, the API owns all business logic, and nothing but the
backend touches the database.

## Component view

```
┌──────────────────────────────────────────────────────────────────────┐
│ Browser — http://localhost:5173                                      │
│                                                                      │
│  pages/            Overview · CheckIn · Patterns · Insights ·        │
│                    Datasets · About                                  │
│  components/       layout · ui · charts · dashboard · patterns       │
│  hooks/            useDataset (active source + date filter)          │
│                    useAsync / useAction (loading + error state)      │
│  services/api.ts   the only module that calls the network            │
│  types/api.ts      TypeScript mirrors of the Pydantic schemas        │
└───────────────────────────────┬──────────────────────────────────────┘
                                │  JSON over HTTP
                                │  (Vite dev server proxies /api → :8000)
┌───────────────────────────────▼──────────────────────────────────────┐
│ FastAPI — http://127.0.0.1:8000                                      │
│                                                                      │
│  main.py           CORS, validation/DB/unhandled error handlers,     │
│                    lifespan: create tables + seed demo data          │
│                                                                      │
│  api/routes/       health · checkins · datasets · analytics ·        │
│                    insights                                          │
│                    → parse and validate, map to services, set status │
│                                                                      │
│  services/         ALL business logic lives here                     │
│    preprocessing   cleaning · feature matrix · pairwise frame        │
│    clustering      StandardScaler → KMeans → PCA → label derivation  │
│    correlation     Pearson / Spearman, per-pair sample sizes         │
│    association_    discretise → Apriori → support/confidence/lift    │
│      rules                                                           │
│    analytics       dashboard metrics, trends, sufficiency            │
│    insight_service deterministic explanation templates               │
│    dataset_service source selection, demo load, CSV import/export    │
│                                                                      │
│  utils/validation  row- and column-level rules, alias mapping        │
│  core/constants    canonical fields, ranges, aliases, thresholds     │
│                                                                      │
│  db/               SQLAlchemy ORM                                    │
└───────────────────────────────┬──────────────────────────────────────┘
                                │
┌───────────────────────────────▼──────────────────────────────────────┐
│ SQLite — backend/lifelens.db                                         │
│                                                                      │
│  checkins        one row per day per source                          │
│                  UNIQUE(source, date)                                │
│                  source ∈ {demo, user, import}  — never merged       │
│  app_state       key/value; holds the active source selection        │
│  import_batches  provenance for each accepted CSV import             │
└──────────────────────────────────────────────────────────────────────┘
```

## Request flow: "show me the Pattern Explorer"

1. `PatternsPage` reads the active source and date filter from `useDataset`.
2. Three `useAsync` hooks call `api.clusters`, `api.correlations` and
   `api.associationRules` with that scope plus the technique's own parameters.
3. Each route handler validates the request body against its Pydantic schema. An
   invalid `n_clusters` or an unknown source is rejected with 422 before any work starts.
4. `dataset_service.records_frame` loads only that source's rows, date-filtered, into
   a pandas DataFrame.
5. The service runs: preprocessing → the algorithm → a typed response model.
6. The response is serialised by its schema, so the frontend's TypeScript types and
   the backend's Pydantic models describe the same shape.
7. The page renders charts, tables and caveats. On thin data the service returns
   `available: false` with a message, and the page renders an empty state rather than
   an empty chart.

## Design decisions and why

**Business logic lives in `services/`, never in routes.** The services take
DataFrames and return typed models; they know nothing about HTTP. That is what makes
them testable directly in `tests/test_mining.py` without spinning up a client.

**One table, three sources, never merged.** Separate tables per source would
duplicate every query and every migration. A `source` column with
`UNIQUE(source, date)` gives the same isolation: loading demo data cannot collide
with a check-in the user typed on the same date, and switching datasets only moves a
pointer in `app_state`.

**The active dataset is global state; nothing else is.** Every number in the
application means something different depending on which dataset and date window is
active, so those two live in one React context. Everything else is fetched where it
is used. No store, no cache layer — which keeps it obvious where each number came from.

**The frontend re-validates, the backend decides.** Zod schemas in the browser mirror
the Pydantic ones so the user sees an error inline instead of after a round trip. The
server never trusts that: every rule runs again server-side.

**Two preprocessing paths, deliberately.** Clustering needs one consistent NaN-free
matrix (K-Means cannot take gaps), so it drops sparse rows and median-imputes the
rest, reporting every imputation. Correlation needs the opposite — each pair computed
on its own valid observations — so it keeps the NaNs and reports per-pair `n`.
Collapsing these into one path would either throw away usable correlation data or
silently fabricate values for clustering.

**Apriori is implemented, not imported.** The support, confidence and lift arithmetic
is the part of this project most likely to be questioned, so it is written out and
checked against a hand-computed table in the test suite.

**Insights are templates, not generation.** `insight_service` fills sentence
templates with computed numbers. No language model is involved anywhere, which means
no insight can describe a finding the data does not contain.

## Error handling

| Layer | Behaviour |
|---|---|
| Browser | Zod validation inline; `ApiError` surfaces the server's `detail`; a failed `fetch` reports that the backend may not be running. |
| Routes | 422 for invalid input, 404 for missing records, 409 for duplicate dates, 413 for oversized uploads, 503 when the demo CSV is absent. |
| App | `RequestValidationError` flattened to one readable sentence per field; `SQLAlchemyError` and unhandled exceptions logged server-side and returned as a generic message — no stack traces or SQL reach the client. |
| Services | Thin or malformed data returns `available: false` plus an explanation. Services do not raise for ordinary data conditions. |

## Security posture

This is a single-user local prototype with no authentication, and it makes no
production-security claims. What it does do:

- Uploaded CSVs are parsed as text only and never executed.
- Upload filenames are reduced to a sanitised basename; user-supplied paths are never
  trusted, so `../../etc/passwd` becomes `passwd`.
- Upload size is capped (10 MB by default) and the extension is checked.
- Stack traces, SQL and settings are never returned to the client.
- Nothing is sent to any external service; there are no API keys to leak.
