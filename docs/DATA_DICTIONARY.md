# Data dictionary

Every field LifeLens AI stores, with its type, unit, valid range and how it is used.
These ranges are enforced in three places: the browser form, the Pydantic schema,
and the CSV import validator.

## Stored fields

| Field | Type | Unit | Valid range | Required | Model feature | Notes |
|---|---|---|---|---|---|---|
| `id` | integer | — | auto | yes | **no** | Internal primary key. Excluded from every feature matrix. |
| `source` | string | — | `demo` \| `user` \| `import` | yes | **no** | Which dataset the row belongs to. Sources are never merged. |
| `date` | date | — | any valid calendar date | yes | **no** | Unique *per source*. Excluded from features. |
| `sleep_hours` | float | hours | 0–24 | yes | yes | Total sleep for the night ending that day. |
| `sleep_quality` | integer | 1–10 | 1–10 whole | no | yes | Self-rated; 1 = terrible, 10 = excellent. |
| `screen_time_hours` | float | hours | 0–24 | no | yes | Total across all devices. |
| `social_media_hours` | float | hours | 0–24 | no | yes | Must be ≤ `screen_time_hours`. |
| `study_work_hours` | float | hours | 0–24 | no | yes | Focused study or work. `sleep_hours + study_work_hours ≤ 24`. |
| `exercise_minutes` | float | minutes | 0–1440 | no | yes | Deliberate physical activity. |
| `caffeine_servings` | float | servings | 0–20 | no | yes | Cups of coffee / tea / energy drink. |
| `stress_score` | integer | 1–10 | 1–10 whole | no | yes | Self-rated; 1 = none, 10 = overwhelming. |
| `mood_score` | integer | 1–10 | 1–10 whole | **yes** | yes | **Self-reported.** Never inferred. |
| `productivity_score` | integer | 1–10 | 1–10 whole | **yes** | yes | **Self-reported.** Never inferred. |
| `notes` | text | — | ≤ 500 characters | no | **no** | Free text. Never parsed, never used as a feature. |
| `created_at` | datetime | UTC | auto | yes | **no** | Set on insert. |
| `updated_at` | datetime | UTC | auto | yes | **no** | Updated on every change. |

"Required" means a row is rejected on import without it. `date`, `sleep_hours`,
`mood_score` and `productivity_score` are the four required fields; the daily
check-in form requires all eleven numeric fields, because a partially filled form
is almost always a mistake rather than a deliberate blank.

## Cross-field rules

| Rule | Message shown |
|---|---|
| `social_media_hours ≤ screen_time_hours` | "Social media use cannot exceed total screen time" |
| `sleep_hours + study_work_hours ≤ 24` | "Sleep plus study/work cannot exceed 24 hours in one day" |
| One record per date per source | 409 with the id of the existing record, and an offer to edit it |

## Accepted CSV column aliases

Matching ignores case, spaces, hyphens and underscores, so `Screen Time`,
`screen-time` and `screen_time` all resolve identically.

| Canonical field | Accepted aliases |
|---|---|
| `date` | `date`, `day`, `entry_date` |
| `record_id` | `record_id`, `id` |
| `sleep_hours` | `sleep_hours`, `sleep_duration`, `sleep`, `sleep_duration_hours` |
| `sleep_quality` | `sleep_quality`, `sleep_score` |
| `screen_time_hours` | `screen_time_hours`, `screen_time`, `screen` |
| `social_media_hours` | `social_media_hours`, `social_media`, `social` |
| `study_work_hours` | `study_hours`, `work_hours`, `study_work_hours`, `study_work` |
| `exercise_minutes` | `exercise_minutes`, `exercise`, `workout`, `workout_minutes` |
| `caffeine_servings` | `caffeine_servings`, `caffeine`, `coffee` |
| `stress_score` | `stress_score`, `stress`, `stress_level` |
| `mood_score` | `mood_score`, `mood` |
| `productivity_score` | `productivity_score`, `productivity` |
| `notes` | `notes`, `note`, `comment`, `comments` |

Anything unrecognised can be mapped by hand in the import panel.

## Accepted date formats

`YYYY-MM-DD` (preferred), `DD-MM-YYYY`, `DD/MM/YYYY`, `MM/DD/YYYY`, `YYYY/MM/DD`,
`DD Mon YYYY`, `DD Month YYYY`. A time component, if present, is discarded.

## Values treated as blank

`""`, `NA`, `N/A`, `NaN`, `null`, `-` (case-insensitive), and whitespace only.

## Discretisation bands (association-rule mining)

Fixed cut points, chosen for interpretability rather than derived from the data, so
a band means the same thing across datasets. Intervals are `[low, high)`.

| Variable | Band | Range |
|---|---|---|
| Sleep duration | Short / Moderate / Long | `< 6` / `6–8` / `≥ 8` hours |
| Sleep quality | Poor / Fair / Good | `< 5` / `5–8` / `≥ 8` |
| Screen time | Low / Moderate / High | `< 4` / `4–7` / `≥ 7` hours |
| Social media | Low / Moderate / High | `< 1.5` / `1.5–3` / `≥ 3` hours |
| Study/work | Light / Moderate / Heavy | `< 4` / `4–8` / `≥ 8` hours |
| Exercise | None / Some / Plenty | `< 10` / `10–45` / `≥ 45` minutes |
| Caffeine | Low / Moderate / High | `< 2` / `2–4` / `≥ 4` servings |
| Stress | Low / Moderate / High | `< 4` / `4–7` / `≥ 7` |
| Mood | Low / Moderate / High | `< 5` / `5–8` / `≥ 8` |
| Productivity | Low / Moderate / High | `< 5` / `5–8` / `≥ 8` |

## Analysis thresholds

| Constant | Value | Effect |
|---|---|---|
| `MIN_CORRELATION_SAMPLES` | 10 | Below this, a pair is labelled "insufficient" evidence. |
| `WEAK_EVIDENCE_SAMPLES` | 30 | Between 10 and 30, a pair is labelled "limited". |
| `MIN_CLUSTERING_ROWS` | 10 | Below this, clustering refuses to run and explains why. |
| `MIN_RULES_ROWS` | 20 | Below this, rule mining refuses to run and explains why. |
| `MINIMUM_RECOMMENDED_RECORDS` | 30 | Below this, the dashboard flags the view as provisional. |

## Demo-dataset-only column

`profile` appears in `lifelens_demo.csv` for documentation only. It records which
synthetic routine generated the row. It is **not** imported into the database, not
used as a model feature, and never treated as a ground-truth label — K-Means is
unsupervised and never sees it.
