"""Shared constants for the LifeLens AI analytics pipeline.

Keeping the canonical field names, aliases and valid ranges in one module means
preprocessing, validation, CSV import and the demo generator cannot drift apart.
"""

from __future__ import annotations

# Canonical numeric lifestyle fields, in the order used for display and modelling.
NUMERIC_FIELDS: tuple[str, ...] = (
    "sleep_hours",
    "sleep_quality",
    "screen_time_hours",
    "social_media_hours",
    "study_work_hours",
    "exercise_minutes",
    "caffeine_servings",
    "stress_score",
    "mood_score",
    "productivity_score",
)

# Self-reported outcome fields. Analyses that depend on them are disabled when absent.
OUTCOME_FIELDS: tuple[str, ...] = ("mood_score", "productivity_score")

# Fields that must be present for a record to be usable at all.
REQUIRED_FIELDS: tuple[str, ...] = ("date", "sleep_hours", "mood_score", "productivity_score")

# Columns excluded from every model feature matrix.
NON_FEATURE_FIELDS: tuple[str, ...] = ("record_id", "id", "date", "notes", "source")

# Inclusive (min, max) bounds for each numeric field.
FIELD_RANGES: dict[str, tuple[float, float]] = {
    "sleep_hours": (0.0, 24.0),
    "sleep_quality": (1.0, 10.0),
    "screen_time_hours": (0.0, 24.0),
    "social_media_hours": (0.0, 24.0),
    "study_work_hours": (0.0, 24.0),
    "exercise_minutes": (0.0, 1440.0),
    "caffeine_servings": (0.0, 20.0),
    "stress_score": (1.0, 10.0),
    "mood_score": (1.0, 10.0),
    "productivity_score": (1.0, 10.0),
}

# Fields constrained to whole numbers on the 1-10 self-report scale.
INTEGER_SCALE_FIELDS: tuple[str, ...] = (
    "sleep_quality",
    "stress_score",
    "mood_score",
    "productivity_score",
)

# Human-readable labels used by charts, tables and generated insight text.
FIELD_LABELS: dict[str, str] = {
    "sleep_hours": "Sleep duration",
    "sleep_quality": "Sleep quality",
    "screen_time_hours": "Screen time",
    "social_media_hours": "Social media use",
    "study_work_hours": "Study/work hours",
    "exercise_minutes": "Exercise",
    "caffeine_servings": "Caffeine intake",
    "stress_score": "Stress level",
    "mood_score": "Mood",
    "productivity_score": "Productivity",
}

FIELD_UNITS: dict[str, str] = {
    "sleep_hours": "hours",
    "sleep_quality": "/10",
    "screen_time_hours": "hours",
    "social_media_hours": "hours",
    "study_work_hours": "hours",
    "exercise_minutes": "minutes",
    "caffeine_servings": "servings",
    "stress_score": "/10",
    "mood_score": "/10",
    "productivity_score": "/10",
}

# Accepted CSV header aliases -> canonical field name. Lookup is case-insensitive
# and ignores spaces, hyphens and underscores (see utils.validation.normalise_header).
COLUMN_ALIASES: dict[str, str] = {
    "date": "date",
    "day": "date",
    "entrydate": "date",
    "recordid": "record_id",
    "id": "record_id",
    "sleephours": "sleep_hours",
    "sleepduration": "sleep_hours",
    "sleep": "sleep_hours",
    "sleepdurationhours": "sleep_hours",
    "sleepquality": "sleep_quality",
    "sleepscore": "sleep_quality",
    "screentimehours": "screen_time_hours",
    "screentime": "screen_time_hours",
    "screen": "screen_time_hours",
    "socialmediahours": "social_media_hours",
    "socialmedia": "social_media_hours",
    "social": "social_media_hours",
    "studyhours": "study_work_hours",
    "workhours": "study_work_hours",
    "studyworkhours": "study_work_hours",
    "studywork": "study_work_hours",
    "exerciseminutes": "exercise_minutes",
    "exercise": "exercise_minutes",
    "workout": "exercise_minutes",
    "workoutminutes": "exercise_minutes",
    "caffeineservings": "caffeine_servings",
    "caffeine": "caffeine_servings",
    "coffee": "caffeine_servings",
    "stressscore": "stress_score",
    "stress": "stress_score",
    "stresslevel": "stress_score",
    "moodscore": "mood_score",
    "mood": "mood_score",
    "productivityscore": "productivity_score",
    "productivity": "productivity_score",
    "notes": "notes",
    "note": "notes",
    "comment": "notes",
    "comments": "notes",
}

MAX_NOTES_LENGTH = 500

# Dataset source identifiers. Records are kept logically separate by source.
SOURCE_DEMO = "demo"
SOURCE_USER = "user"
SOURCE_IMPORT = "import"
DATASET_SOURCES: tuple[str, ...] = (SOURCE_DEMO, SOURCE_USER, SOURCE_IMPORT)

SOURCE_LABELS: dict[str, str] = {
    SOURCE_DEMO: "Synthetic demo dataset",
    SOURCE_USER: "Your check-ins",
    SOURCE_IMPORT: "Imported CSV",
}

# Minimum pairwise sample size before a correlation is treated as anything but weak evidence.
MIN_CORRELATION_SAMPLES = 10
# Below this, correlations are reported but explicitly flagged as insufficient evidence.
WEAK_EVIDENCE_SAMPLES = 30
# Minimum rows required before K-Means is attempted.
MIN_CLUSTERING_ROWS = 10
# Minimum rows required before association-rule mining is attempted.
MIN_RULES_ROWS = 20
