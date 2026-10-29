# LifeLens AI

**Mining the Hidden Patterns Behind Your Daily Life**

> Understand your patterns. Discover your rhythm. Make every day count.

A local-first personal behavioural analytics application. You record daily
lifestyle data — sleep, screen time, exercise, study/work, caffeine, stress, plus
**self-reported** mood and productivity — and LifeLens mines that data for
patterns with K-Means clustering, correlation analysis and association-rule mining.

```
DATA → CLEANING → DATA MINING → PATTERN DISCOVERY → EXPLANATION → VISUALISATION → INSIGHTS
```

---

## Contents

1. [What this is, and what it is not](#1-what-this-is-and-what-it-is-not)
2. [Problem statement](#2-problem-statement)
3. [Motivation](#3-motivation)
4. [Objectives](#4-objectives)
5. [Key features](#5-key-features)
6. [Data-mining algorithms](#6-data-mining-algorithms)
7. [Technology stack](#7-technology-stack)
8. [Architecture](#8-architecture)
9. [Folder structure](#9-folder-structure)
10. [Dataset](#10-dataset)
11. [Synthetic-data disclaimer](#11-synthetic-data-disclaimer)
12. [Installation (Windows)](#12-installation-windows)
13. [Environment configuration](#13-environment-configuration)
14. [Running the backend](#14-running-the-backend)
15. [Running the frontend](#15-running-the-frontend)
16. [Running the tests](#16-running-the-tests)
17. [Example CSV format](#17-example-csv-format)
18. [API reference](#18-api-reference)
19. [Known limitations](#19-known-limitations)
20. [Future enhancements](#20-future-enhancements)

---

## 1. What this is, and what it is not

**It is** a data-mining project that analyses one person's lifestyle records and
reports the statistical structure it finds, with the sample size attached to every
claim.

**It is not:**

- a medical or diagnostic system — it offers no clinical advice;
- a mood detector — mood and productivity are typed in by you, never inferred
  from screen time, notes or sensors;
- a prediction engine — it describes associations inside one dataset;
- a cloud product — no accounts, no API keys, no telemetry, nothing leaves the machine.

Correlation is never presented as causation anywhere in the application.

## 2. Problem statement

People generate a dense trail of daily lifestyle data and almost never examine it.
The relationships connecting those habits to how a day actually felt stay hidden,
because nobody mines their own records. Consumer wellness apps rarely help: they
either show raw logs with no analysis, or assert conclusions with no visible
evidence and no sample size. The gap is not data collection — it is honest,
inspectable pattern discovery over data a person already has.

## 3. Motivation

- Demonstrate a complete data-mining pipeline end to end, not one algorithm in isolation.
- Apply unsupervised techniques where they are genuinely the right tool.
- Show that analytical honesty — sample sizes, caveats, stated limitations — makes
  a tool more useful, not less.
- Keep everything local: the user's data never leaves their machine.

## 4. Objectives

1. Capture daily lifestyle data with validation strict enough that bad records never reach the models.
2. Discover routine archetypes with K-Means over standardised features.
3. Quantify habit–outcome relationships with correlation analysis, reporting each pair's own sample size.
4. Mine multi-condition patterns with Apriori, reporting support, confidence and lift.
5. Explain every result in plain language generated deterministically from the computed numbers.
6. Handle empty, sparse and malformed data without inventing results.

## 5. Key features

| Page | What it does |
|---|---|
| **Overview** (`/`) | Metrics, trends, sleep-vs-productivity and stress-vs-mood scatter plots, top patterns, cluster mix, recent check-ins. Every figure recomputed from the active dataset and date filter. |
| **Daily check-in** (`/check-in`) | Eleven validated fields plus notes. Create, edit, list, delete. Warns before a duplicate date and offers to edit the existing record. |
| **Pattern explorer** (`/patterns`) | Three tabs: K-Means clustering with PCA projection and silhouette score; correlation heatmap and ranked pairs; Apriori rules with adjustable thresholds. |
| **Insights** (`/insights`) | Deterministic plain-English readings grouped by positive / negative associations, rules, clusters, suggestions and data-quality notes. |
| **Datasets** (`/datasets`) | Switch between the three sources, see column coverage and missingness, preview, import CSV with a validation report, export CSV, reload demo data, clear a source. |
| **About & method** (`/about`) | Problem, architecture, why clustering rather than classification, evaluation, viva-ready explanations, limitations. |

Cross-cutting: light, print-like responsive UI, loading skeletons, empty/error states,
inline confirmation for destructive actions, keyboard-accessible controls, and a
dataset bar that always shows which data is being analysed.

## 6. Data-mining algorithms

### K-Means clustering
`scikit-learn` `KMeans(random_state=42, n_init=10)` over `StandardScaler`-normalised
features. Rows missing more than half the selected features are dropped; remaining
gaps are median-imputed and every imputation is counted. The cluster count is
validated against the number of rows and *distinct* observations. Silhouette score
is computed only when mathematically defined. PCA gives a 2D projection for the chart.

Cluster labels ("Balanced Routine", "Digital Night Owl", "High-Stress Achiever",
"Active and Rested", "Inconsistent Schedule"…) are derived from each cluster's own
z-scored profile, never from its id, and are descriptive — not diagnoses.

### Correlation analysis
Pearson or Spearman via SciPy, computed per pair on that pair's **pairwise-complete**
observations, with its own `n` reported. Constant columns are excluded with a stated
reason. Evidence is banded (insufficient / limited / reasonable) against a
configurable minimum sample size. A p-value is shown where computable and is
explicitly described as a test of the no-association null, uncorrected for multiple
comparisons.

### Association-rule mining
Apriori implemented directly in `app/services/association_rules.py` so the
arithmetic is inspectable and hand-verifiable. Continuous variables are discretised
into fixed, documented bands. For a rule X → Y over N transactions:

```
support(X→Y)    = count(X ∪ Y) / N
confidence(X→Y) = support(X ∪ Y) / support(X)
lift(X→Y)       = confidence(X→Y) / support(Y)
```

Lift above 1 means the two sides co-occur more often than independence predicts.
It is not a causal statement.

## 7. Technology stack

**Frontend** — React 19, Vite 7, TypeScript 5.8, Tailwind CSS 4, React Router 7,
Recharts 2, Lucide icons, React Hook Form + Zod, Sonner (toasts).

**Backend** — Python 3.11+, FastAPI, Uvicorn, Pydantic 2, SQLAlchemy 2, SQLite,
pandas, NumPy, scikit-learn, SciPy, pytest, HTTPX.

No paid APIs, no cloud services, no API keys, no external AI services.

## 8. Architecture

```
  Browser (localhost:5173)
        │  fetch /api/*  (JSON over HTTP; Vite proxies to the backend in dev)
        ▼
  FastAPI (localhost:8000)
        │
        ├─ api/routes/        request validation, HTTP status codes, error shaping
        │
        ├─ services/          preprocessing → clustering / correlation / rules
        │                     → insight_service (deterministic templates)
        │
        └─ db/                SQLAlchemy ORM → SQLite file (lifelens.db)
                              sources: demo | user | import   (never merged)
```

Business logic lives in `services/`, never in route handlers. The browser holds no
business logic and never touches the database.

## 9. Folder structure

```
LifeLensAI/
├─ backend/
│  ├─ app/
│  │  ├─ main.py                  FastAPI app, CORS, error handlers, startup seeding
│  │  ├─ core/
│  │  │  ├─ config.py             environment-driven settings
│  │  │  └─ constants.py          canonical fields, ranges, aliases, thresholds
│  │  ├─ db/
│  │  │  ├─ database.py           engine, session, init_db
│  │  │  ├─ models.py             CheckIn, AppState, ImportBatch
│  │  │  └─ schemas.py            Pydantic request/response contracts
│  │  ├─ api/routes/              health, checkins, datasets, analytics, insights
│  │  ├─ services/
│  │  │  ├─ preprocessing.py      cleaning, feature matrix, pairwise frame
│  │  │  ├─ clustering.py         K-Means + PCA + label derivation
│  │  │  ├─ correlation.py        Pearson / Spearman with per-pair n
│  │  │  ├─ association_rules.py  Apriori, support / confidence / lift
│  │  │  ├─ analytics.py          dashboard metrics, trends, sufficiency
│  │  │  ├─ insight_service.py    deterministic explanation templates
│  │  │  └─ dataset_service.py    sources, demo loading, CSV import/export
│  │  └─ utils/validation.py      row- and column-level validation
│  ├─ data/
│  │  ├─ lifelens_demo.csv        1,200 synthetic records
│  │  ├─ lifelens_test_fixture.csv  40-row held-out file
│  │  └─ README.md                dataset documentation
│  ├─ scripts/generate_demo_dataset.py
│  ├─ tests/                      74 pytest tests
│  ├─ requirements.txt
│  └─ .env.example
├─ frontend/
│  └─ src/
│     ├─ components/  layout · ui · charts · dashboard · patterns
│     ├─ pages/       Overview · CheckIn · Patterns · Insights · Datasets · About
│     ├─ services/api.ts          single API client
│     ├─ hooks/       useApi · useDataset
│     ├─ types/api.ts             TypeScript mirrors of the Pydantic schemas
│     ├─ utils/format.ts
│     └─ index.css                design tokens
├─ docs/            problem statement, architecture, data dictionary, methodology, testing, viva prep
├─ PRODUCT.md       product context
├─ DESIGN.md        design system
└─ README.md
```

## 10. Dataset

`backend/data/lifelens_demo.csv` holds **1,200 synthetic daily records** across five
routine profiles, generated with a fixed seed (`20240517`). It loads automatically on
first backend start, so the application is never empty on arrival.

Fields: `record_id`, `date`, `sleep_hours`, `sleep_quality`, `screen_time_hours`,
`social_media_hours`, `study_work_hours`, `exercise_minutes`, `caffeine_servings`,
`stress_score`, `mood_score`, `productivity_score`, `notes`.

See [`backend/data/README.md`](backend/data/README.md) for generation details and
[`docs/DATA_DICTIONARY.md`](docs/DATA_DICTIONARY.md) for per-column types and ranges.

Regenerate it with:

```powershell
python scripts\generate_demo_dataset.py
```

## 11. Synthetic-data disclaimer

**The demo dataset is entirely simulated.** No real person's data is included. The
relationships inside it exist because the generator put them there, and they are
**not** scientific findings about human behaviour. The application labels this
dataset as synthetic in the dataset bar, on the Overview page, and on every insight
generated from it.

## 12. Installation (Windows)

Prerequisites: **Python 3.11+** and **Node.js 20+** (developed on Python 3.11.5,
Node 24.11.1, npm 11.6.2).

Open two PowerShell terminals in the project root.

**Terminal 1 — backend**

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

**Terminal 2 — frontend**

```powershell
cd frontend
npm install
```

> If PowerShell blocks `Activate.ps1`, run
> `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` in that terminal first.

## 13. Environment configuration

Both `.env` files are optional — every value has a working default.

```powershell
Copy-Item backend\.env.example backend\.env
Copy-Item frontend\.env.example frontend\.env
```

| Variable | Default | Purpose |
|---|---|---|
| `LIFELENS_DATABASE_URL` | `sqlite:///backend/lifelens.db` | SQLAlchemy URL |
| `LIFELENS_CORS_ORIGINS` | `http://localhost:5173,…` | allowed dev origins |
| `LIFELENS_MAX_UPLOAD_MB` | `10` | CSV upload size limit |
| `LIFELENS_UPLOAD_DIR` | `storage/uploads` | where accepted CSVs are kept |
| `VITE_API_BASE_URL` | *(unset)* | only needed when the built frontend is served from another origin |
| `VITE_PROXY_TARGET` | `http://127.0.0.1:8000` | dev-proxy target |

## 14. Running the backend

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
python -m uvicorn app.main:app --reload --port 8000
```

- API root: <http://127.0.0.1:8000/>
- Interactive docs (Swagger): <http://127.0.0.1:8000/docs>
- Alternative docs (ReDoc): <http://127.0.0.1:8000/redoc>
- Health: <http://127.0.0.1:8000/api/health>

The database is created and the demo dataset seeded on first start. Records persist
in `backend/lifelens.db` across restarts.

## 15. Running the frontend

```powershell
cd frontend
npm run dev
```

Open <http://localhost:5173>. The dev server proxies `/api` to port 8000, so no
CORS configuration is needed for local work.

Production build:

```powershell
npm run build
npm run preview
```

## 16. Running the tests

**Backend (74 tests):**

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
python -m pytest
```

Run one area:

```powershell
python -m pytest tests\test_mining.py -v
```

**Frontend type check and production build:**

```powershell
cd frontend
npm run typecheck
npm run build
```

See [`docs/TESTING.md`](docs/TESTING.md) for what each test covers and the latest
recorded results.

## 17. Example CSV format

```csv
date,sleep_hours,sleep_quality,screen_time_hours,social_media_hours,study_work_hours,exercise_minutes,caffeine_servings,stress_score,mood_score,productivity_score,notes
2024-05-01,7.5,8,5.0,1.5,6.0,30,2,4,7,8,Good day.
2024-05-02,6.0,5,8.0,3.0,7.0,0,4,7,4,4,
2024-05-03,8.0,9,3.0,1.0,5.0,60,1,3,9,9,Long run this morning.
```

Required columns: `date`, `sleep_hours`, `mood_score`, `productivity_score`.

Recognised aliases (case and punctuation insensitive): `sleep` / `sleep_duration`,
`screen_time`, `social_media`, `study_hours` / `work_hours`, `exercise`,
`caffeine`, `stress`, `mood`, `productivity`, `day` → `date`. Unrecognised columns
can be mapped by hand in the import panel.

Validation: file type and size, required columns, numeric parseability, documented
ranges, `social_media_hours ≤ screen_time_hours`, `sleep + study/work ≤ 24`,
duplicate dates, and missingness. Every rejected row is reported with its row
number, field and reason — nothing is silently dropped or corrected.

## 18. API reference

Full interactive documentation at `/docs` while the backend runs.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/health` | status, version, record counts, active source |
| `GET` | `/api/checkins` | list with pagination and date filters |
| `POST` | `/api/checkins` | create (409 on duplicate date) |
| `GET` | `/api/checkins/{id}` | fetch one |
| `PUT` | `/api/checkins/{id}` | update |
| `DELETE` | `/api/checkins/{id}` | delete (204) |
| `GET` | `/api/checkins/by-date/{date}` | duplicate-date lookup for the form |
| `POST` | `/api/checkins/activate` | make your own check-ins the active dataset |
| `GET` | `/api/datasets/active` | active source plus per-source counts |
| `POST` | `/api/datasets/active` | switch active source |
| `GET` | `/api/datasets/summary` | counts, columns, missingness, date range |
| `GET` | `/api/datasets/preview` | paginated row preview |
| `POST` | `/api/datasets/demo?replace=` | load or reload demo data without duplicates |
| `POST` | `/api/datasets/upload` | validate and import a CSV (multipart) |
| `GET` | `/api/datasets/export` | export the selected source as CSV |
| `DELETE` | `/api/datasets/{source}` | clear one source |
| `GET` | `/api/analytics/overview` | dashboard metrics, trend, scatters, patterns |
| `POST` | `/api/analytics/clusters` | K-Means with validated `n_clusters` |
| `POST` | `/api/analytics/correlations` | correlations for a method / target |
| `POST` | `/api/analytics/association-rules` | rules with configurable thresholds |
| `GET` | `/api/insights` | grouped, computed explanations |

## 19. Known limitations

- Self-reported mood and productivity carry recall bias, mood-congruent reporting and inconsistent personal scales.
- Features and outcomes are recorded for the same day, so no temporal ordering is established and no lag effects are modelled.
- The demo dataset is simulated; its relationships are artefacts of the generator.
- K-Means assumes roughly spherical, comparably sized clusters, which real routine data does not guarantee. Silhouette scores on real lifestyle data are typically modest, and the application shows the number rather than hiding it.
- Association-rule bands are fixed cut points, so 5.9 hours and 3 hours of sleep both read as "Short".
- No multiple-comparison correction, so some correlations in a wide matrix will look notable by chance.
- Single user, single machine, no authentication. This is a local prototype, not a multi-tenant product, and makes no production-security or clinical-validity claims.
- Frontend behaviour is verified manually and through type checking plus a production build; there is no automated browser test suite.

## 20. Future enhancements

- Lagged correlation (does last night's sleep track today's productivity?).
- Side-by-side comparison of two date ranges.
- Quantile-based binning as an alternative to fixed bands.
- Hierarchical or DBSCAN clustering as a cross-check on K-Means.
- A downloadable analytics report carrying the figures and their caveats.
- Multiple-comparison correction on the correlation matrix.
- Automated end-to-end browser tests.

---

LifeLens AI · mood and productivity are self-reported · every relationship shown is
an association, not a causal claim.
