# LifeLens AI demo dataset

## This data is synthetic

`lifelens_demo.csv` contains **1,200 fully simulated daily records**. It was produced
by `backend/scripts/generate_demo_dataset.py` with a fixed random seed
(`20240517`), so regenerating it reproduces the same file byte for byte.

**No real person's data is included.** None of the relationships in this file are
scientific findings about human behaviour. They exist because the generator put
them there. Any number the application reports from this dataset describes the
simulation, not the world.

## How it was generated

1. Each record is assigned one of five routine **profiles** by weighted draw:

   | Profile | Share | Character |
   |---|---|---|
   | `consistent_routine` | 26% | ~7.6 h sleep, moderate screen time, low stress |
   | `late_night_digital` | 22% | ~5.7 h sleep, ~9 h screen time, high social media |
   | `high_workload_stress` | 20% | ~9.6 h study/work, high caffeine, high stress |
   | `active_rested` | 18% | ~8.1 h sleep, ~72 min exercise, low stress |
   | `irregular_schedule` | 14% | wide variance on every habit |

2. Habit variables are drawn from each profile's own normal distributions and
   clipped to the documented valid ranges.
3. Weekend days (by calendar date) get extra sleep, less study/work, more screen
   time and slightly lower stress — this adds within-profile variation.
4. `social_media_hours` is derived as a fraction of `screen_time_hours`, so the
   "social media cannot exceed screen time" rule always holds.
5. `mood_score` and `productivity_score` are computed from a linear combination
   of the habit variables **plus Gaussian noise with sd ≈ 2.05**, then clipped to
   1–10 and rounded to integers. The noise is deliberately large relative to the
   signal, which is why observed correlations land in the moderate 0.4–0.6 band
   rather than looking artificially perfect.
6. About 1.2% of rows have one *optional* field blanked (`sleep_quality`,
   `caffeine_servings` or `exercise_minutes`) so that the missing-value report
   and the import validator have real missingness to describe. Required fields
   (`date`, `sleep_hours`, `mood_score`, `productivity_score`) are never blank.
7. Notes are present on roughly 18% of rows, drawn from a small per-profile pool.

## Files

| File | Rows | Purpose |
|---|---|---|
| `lifelens_demo.csv` | 1,200 | Built-in demo dataset loaded by `POST /api/datasets/demo` |
| `lifelens_test_fixture.csv` | 40 | Small held-out file (different seed) for import testing |

The `profile` column exists only for documentation and is **not** used as a model
feature or a ground-truth label — K-Means is unsupervised and never sees it.

## Regenerating

From the `backend` directory, with the virtual environment active:

```powershell
python scripts\generate_demo_dataset.py
```

Options: `--records N`, `--seed N`, `--out PATH`.

## Limitations

- Mood and productivity are simulated **self-reports**, not measured outcomes.
- Relationships are stationary: there is no learning, seasonality or life event.
- Profiles are fixed archetypes; real routines drift over time.
- The dataset cannot be used to validate any real-world health or productivity claim.

See `docs/DATA_DICTIONARY.md` for per-column types, units and valid ranges.
