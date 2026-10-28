"""Deterministic generator for the LifeLens AI synthetic demo dataset.

The dataset is entirely simulated. No real person's data is used. Five routine
profiles are sampled, each with its own base habits and its own noisy mapping
from habits to *self-reported style* mood and productivity scores.

Run from the backend directory:

    python scripts/generate_demo_dataset.py

Output: data/lifelens_demo.csv (and data/lifelens_test_fixture.csv)
"""

from __future__ import annotations

import argparse
import sys
from datetime import date, timedelta
from pathlib import Path

import numpy as np
import pandas as pd

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.core.constants import FIELD_RANGES, INTEGER_SCALE_FIELDS  # noqa: E402

RANDOM_SEED = 20240517
START_DATE = date(2024, 1, 1)

# Each profile defines (mean, sd) for its habit variables plus weights that turn
# habits into noisy self-reported outcomes. Weights are intentionally modest so
# that no relationship in the demo data looks unrealistically deterministic.
PROFILES: dict[str, dict[str, object]] = {
    "consistent_routine": {
        "weight": 0.26,
        "habits": {
            "sleep_hours": (7.6, 0.6),
            "sleep_quality": (7.6, 1.0),
            "screen_time_hours": (4.2, 1.0),
            "social_media_ratio": (0.32, 0.08),
            "study_work_hours": (6.4, 1.1),
            "exercise_minutes": (34.0, 16.0),
            "caffeine_servings": (1.6, 0.8),
            "stress_base": (4.1, 1.2),
        },
    },
    "late_night_digital": {
        "weight": 0.22,
        "habits": {
            "sleep_hours": (5.7, 0.9),
            "sleep_quality": (4.5, 1.3),
            "screen_time_hours": (9.1, 1.7),
            "social_media_ratio": (0.58, 0.10),
            "study_work_hours": (4.3, 1.6),
            "exercise_minutes": (9.0, 11.0),
            "caffeine_servings": (3.1, 1.1),
            "stress_base": (6.1, 1.4),
        },
    },
    "high_workload_stress": {
        "weight": 0.20,
        "habits": {
            "sleep_hours": (6.2, 0.8),
            "sleep_quality": (5.0, 1.2),
            "screen_time_hours": (7.4, 1.4),
            "social_media_ratio": (0.22, 0.08),
            "study_work_hours": (9.6, 1.5),
            "exercise_minutes": (14.0, 14.0),
            "caffeine_servings": (3.8, 1.2),
            "stress_base": (7.6, 1.2),
        },
    },
    "active_rested": {
        "weight": 0.18,
        "habits": {
            "sleep_hours": (8.1, 0.6),
            "sleep_quality": (8.3, 0.9),
            "screen_time_hours": (3.3, 1.0),
            "social_media_ratio": (0.26, 0.08),
            "study_work_hours": (5.8, 1.2),
            "exercise_minutes": (72.0, 22.0),
            "caffeine_servings": (1.1, 0.7),
            "stress_base": (3.2, 1.1),
        },
    },
    "irregular_schedule": {
        "weight": 0.14,
        "habits": {
            "sleep_hours": (6.6, 1.9),
            "sleep_quality": (5.5, 2.0),
            "screen_time_hours": (6.5, 2.6),
            "social_media_ratio": (0.44, 0.14),
            "study_work_hours": (5.0, 2.8),
            "exercise_minutes": (26.0, 28.0),
            "caffeine_servings": (2.3, 1.5),
            "stress_base": (5.6, 2.0),
        },
    },
}

# Shared habit -> outcome weights. Noise is large relative to the signal, which
# keeps correlations in the "moderate" band rather than textbook-perfect.
MOOD_WEIGHTS = {
    "sleep_hours": 0.34,
    "sleep_quality": 0.30,
    "exercise_minutes": 0.011,
    "social_media_hours": -0.20,
    "stress_score": -0.42,
    "caffeine_servings": -0.07,
}
PRODUCTIVITY_WEIGHTS = {
    "sleep_hours": 0.40,
    "sleep_quality": 0.22,
    "study_work_hours": 0.14,
    "screen_time_hours": -0.17,
    "social_media_hours": -0.22,
    "stress_score": -0.26,
    "exercise_minutes": 0.008,
}
MOOD_INTERCEPT = 4.0
PRODUCTIVITY_INTERCEPT = 4.2
OUTCOME_NOISE_SD = 2.05

# Fraction of rows where a single optional field is blanked, so the import and
# missing-value reports have something real to show. Required fields stay intact.
MISSINGNESS_RATE = 0.012
OPTIONAL_MISSING_FIELDS = ("sleep_quality", "caffeine_servings", "exercise_minutes")

NOTE_POOL = {
    "consistent_routine": ["Steady day.", "Normal routine.", "Felt on top of things."],
    "late_night_digital": ["Up far too late.", "Doom-scrolled again.", "Hard to focus."],
    "high_workload_stress": ["Deadline crunch.", "Back-to-back sessions.", "Long day."],
    "active_rested": ["Good run this morning.", "Felt energetic.", "Early night."],
    "irregular_schedule": ["Odd schedule today.", "Slept at a strange hour.", "Mixed day."],
}
NOTE_RATE = 0.18


def _clip(name: str, values: np.ndarray) -> np.ndarray:
    low, high = FIELD_RANGES[name]
    return np.clip(values, low, high)


def generate(n_records: int, seed: int = RANDOM_SEED) -> pd.DataFrame:
    """Build `n_records` synthetic daily records as a DataFrame."""
    rng = np.random.default_rng(seed)

    names = list(PROFILES)
    weights = np.array([float(PROFILES[n]["weight"]) for n in names])
    weights = weights / weights.sum()
    assigned = rng.choice(names, size=n_records, p=weights)

    rows: list[dict[str, object]] = []
    for index in range(n_records):
        profile = assigned[index]
        habits = PROFILES[profile]["habits"]  # type: ignore[index]

        sleep_hours = float(rng.normal(*habits["sleep_hours"]))
        sleep_quality = float(rng.normal(*habits["sleep_quality"]))
        screen_time = float(rng.normal(*habits["screen_time_hours"]))
        social_ratio = float(rng.normal(*habits["social_media_ratio"]))
        study_work = float(rng.normal(*habits["study_work_hours"]))
        exercise = float(rng.normal(*habits["exercise_minutes"]))
        caffeine = float(rng.normal(*habits["caffeine_servings"]))
        stress = float(rng.normal(*habits["stress_base"]))

        # Weekends shift the routine for everyone, adding within-profile variety.
        current_date = START_DATE + timedelta(days=index)
        if current_date.weekday() >= 5:
            sleep_hours += rng.normal(0.55, 0.3)
            study_work *= rng.uniform(0.35, 0.75)
            screen_time += rng.normal(0.7, 0.6)
            stress -= rng.normal(0.6, 0.4)

        screen_time = float(_clip("screen_time_hours", np.array(screen_time)))
        social_ratio = float(np.clip(social_ratio, 0.05, 0.95))
        social_media = screen_time * social_ratio

        record = {
            "sleep_hours": float(_clip("sleep_hours", np.array(sleep_hours))),
            "sleep_quality": float(_clip("sleep_quality", np.array(sleep_quality))),
            "screen_time_hours": screen_time,
            "social_media_hours": float(_clip("social_media_hours", np.array(social_media))),
            "study_work_hours": float(_clip("study_work_hours", np.array(study_work))),
            "exercise_minutes": float(_clip("exercise_minutes", np.array(exercise))),
            "caffeine_servings": float(_clip("caffeine_servings", np.array(caffeine))),
            "stress_score": float(_clip("stress_score", np.array(stress))),
        }

        mood = MOOD_INTERCEPT + sum(
            weight * float(record[field]) for field, weight in MOOD_WEIGHTS.items()
        )
        productivity = PRODUCTIVITY_INTERCEPT + sum(
            weight * float(record[field]) for field, weight in PRODUCTIVITY_WEIGHTS.items()
        )
        mood += float(rng.normal(0.0, OUTCOME_NOISE_SD))
        productivity += float(rng.normal(0.0, OUTCOME_NOISE_SD))

        record["mood_score"] = float(_clip("mood_score", np.array(mood)))
        record["productivity_score"] = float(_clip("productivity_score", np.array(productivity)))
        record["date"] = current_date.isoformat()
        record["profile"] = profile
        record["notes"] = (
            str(rng.choice(NOTE_POOL[profile])) if rng.random() < NOTE_RATE else ""
        )
        rows.append(record)

    frame = pd.DataFrame(rows)

    # Round to the precision a person would plausibly report.
    for field in INTEGER_SCALE_FIELDS:
        frame[field] = frame[field].round().astype(int)
    for field in ("sleep_hours", "screen_time_hours", "social_media_hours", "study_work_hours"):
        frame[field] = frame[field].round(1)
    frame["exercise_minutes"] = frame["exercise_minutes"].round().astype(int)
    frame["caffeine_servings"] = frame["caffeine_servings"].round().astype(int)

    # Social media can never exceed total screen time after rounding.
    frame["social_media_hours"] = np.minimum(
        frame["social_media_hours"], frame["screen_time_hours"]
    )

    # Inject a small amount of missingness into optional fields only.
    n_missing = int(round(len(frame) * MISSINGNESS_RATE))
    if n_missing:
        missing_rows = rng.choice(len(frame), size=n_missing, replace=False)
        for row_index in missing_rows:
            field = str(rng.choice(OPTIONAL_MISSING_FIELDS))
            frame.loc[row_index, field] = np.nan

    frame.insert(0, "record_id", [f"demo-{i + 1:05d}" for i in range(len(frame))])
    ordered = [
        "record_id",
        "date",
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
        "notes",
        "profile",
    ]
    return frame[ordered]


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate the LifeLens AI demo dataset.")
    parser.add_argument("--records", type=int, default=1200, help="number of daily records")
    parser.add_argument("--seed", type=int, default=RANDOM_SEED, help="random seed")
    parser.add_argument(
        "--out",
        type=Path,
        default=BACKEND_DIR / "data" / "lifelens_demo.csv",
        help="output CSV path",
    )
    args = parser.parse_args()

    frame = generate(args.records, args.seed)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    frame.to_csv(args.out, index=False)
    print(f"Wrote {len(frame)} records to {args.out}")

    # A small held-out fixture used by the test suite and the import demo.
    fixture = generate(40, seed=args.seed + 1)
    fixture_path = args.out.parent / "lifelens_test_fixture.csv"
    fixture.to_csv(fixture_path, index=False)
    print(f"Wrote {len(fixture)} records to {fixture_path}")

    numeric = frame.select_dtypes("number")
    print("\nSummary (mean):")
    print(numeric.mean().round(2).to_string())
    print("\nProfile counts:")
    print(frame["profile"].value_counts().to_string())


if __name__ == "__main__":
    main()
