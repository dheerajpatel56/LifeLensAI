"""Preprocessing: turn stored records into clean, model-ready frames.

Two distinct paths exist on purpose:

* `prepare_feature_matrix` builds a single consistent row subset for clustering,
  because K-Means cannot work with NaN and every row must contribute every feature.
* `pairwise_frame` keeps all rows and lets the correlation step compute each pair
  on its own valid observations, reporting that pair's own sample size.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
import pandas as pd

from app.core.constants import (
    FIELD_RANGES,
    NON_FEATURE_FIELDS,
    NUMERIC_FIELDS,
)


@dataclass
class PreprocessSummary:
    """What preprocessing actually did, so the UI can explain itself."""

    rows_in: int = 0
    rows_out: int = 0
    rows_dropped: int = 0
    columns_used: list[str] = field(default_factory=list)
    columns_excluded: dict[str, str] = field(default_factory=dict)
    imputed_counts: dict[str, int] = field(default_factory=dict)
    out_of_range_counts: dict[str, int] = field(default_factory=dict)
    notes: list[str] = field(default_factory=list)


def coerce_numeric(frame: pd.DataFrame) -> pd.DataFrame:
    """Force every known numeric column to a float dtype, blanking unparseable cells."""
    result = frame.copy()
    for column in NUMERIC_FIELDS:
        if column in result.columns:
            result[column] = pd.to_numeric(result[column], errors="coerce")
    return result


def clean_frame(frame: pd.DataFrame) -> tuple[pd.DataFrame, PreprocessSummary]:
    """Normalise dtypes, drop impossible values and report what changed.

    Impossible values are set to NaN rather than deleting the whole row: one bad
    caffeine entry should not discard an otherwise usable day.
    """
    summary = PreprocessSummary(rows_in=len(frame))
    result = coerce_numeric(frame)

    if "date" in result.columns:
        result["date"] = pd.to_datetime(result["date"], errors="coerce")
        invalid_dates = int(result["date"].isna().sum())
        if invalid_dates:
            summary.notes.append(f"{invalid_dates} row(s) had an unparseable date and were dropped")
            result = result[result["date"].notna()].copy()

    for column, (low, high) in FIELD_RANGES.items():
        if column not in result.columns:
            continue
        series = result[column]
        outside = series.notna() & ((series < low) | (series > high))
        count = int(outside.sum())
        if count:
            summary.out_of_range_counts[column] = count
            result.loc[outside, column] = np.nan

    # Replace any infinities that survived coercion.
    numeric_columns = [c for c in NUMERIC_FIELDS if c in result.columns]
    if numeric_columns:
        result[numeric_columns] = result[numeric_columns].replace(
            [np.inf, -np.inf], np.nan
        )

    if "date" in result.columns:
        result = result.sort_values("date").reset_index(drop=True)

    summary.rows_out = len(result)
    summary.rows_dropped = summary.rows_in - summary.rows_out
    summary.columns_used = numeric_columns
    return result, summary


def eligible_features(frame: pd.DataFrame, requested: list[str] | None = None) -> tuple[list[str], dict[str, str]]:
    """Select usable model features and explain every exclusion.

    A column is excluded when it is an identifier, is absent, has no observations,
    or is constant (zero variance carries no clustering or correlation information).
    """
    excluded: dict[str, str] = {}
    candidates = list(requested) if requested else list(NUMERIC_FIELDS)

    selected: list[str] = []
    for column in candidates:
        if column in NON_FEATURE_FIELDS:
            excluded[column] = "identifier, date or free-text column — never a model feature"
            continue
        if column not in frame.columns:
            excluded[column] = "column is not present in the active dataset"
            continue
        series = pd.to_numeric(frame[column], errors="coerce")
        valid = series.dropna()
        if valid.empty:
            excluded[column] = "no valid numeric observations"
            continue
        if float(valid.std(ddof=0)) == 0.0 or valid.nunique() <= 1:
            excluded[column] = "constant column — zero variance carries no information"
            continue
        selected.append(column)

    return selected, excluded


def prepare_feature_matrix(
    frame: pd.DataFrame,
    features: list[str] | None = None,
    max_missing_share: float = 0.5,
) -> tuple[pd.DataFrame, list[str], PreprocessSummary]:
    """Build one consistent, NaN-free row subset for clustering.

    Rows missing more than `max_missing_share` of the selected features are
    dropped. Remaining gaps are median-imputed, and every imputation is counted
    so the UI can state exactly what was filled in.
    """
    cleaned, summary = clean_frame(frame)
    selected, excluded = eligible_features(cleaned, features)
    summary.columns_excluded = excluded

    if not selected:
        summary.columns_used = []
        summary.rows_out = 0
        summary.rows_dropped = summary.rows_in
        return pd.DataFrame(), [], summary

    subset = cleaned[selected].apply(pd.to_numeric, errors="coerce")
    missing_share = subset.isna().mean(axis=1)
    keep_mask = missing_share <= max_missing_share
    dropped_sparse = int((~keep_mask).sum())
    if dropped_sparse:
        summary.notes.append(
            f"{dropped_sparse} row(s) dropped for missing more than "
            f"{int(max_missing_share * 100)}% of the selected features"
        )

    subset = subset[keep_mask]
    index_kept = subset.index

    for column in selected:
        missing = int(subset[column].isna().sum())
        if missing:
            summary.imputed_counts[column] = missing
            median = float(subset[column].median())
            subset[column] = subset[column].fillna(median)

    # Guarantee the contract the models rely on.
    subset = subset.replace([np.inf, -np.inf], np.nan).dropna()
    if len(subset) and not np.isfinite(subset.to_numpy(dtype=float)).all():
        raise ValueError("feature matrix still contains non-finite values after preprocessing")

    summary.columns_used = selected
    summary.rows_out = len(subset)
    summary.rows_dropped = summary.rows_in - summary.rows_out
    if summary.imputed_counts:
        total = sum(summary.imputed_counts.values())
        summary.notes.append(f"{total} missing value(s) filled with the column median")

    # Carry identity forward for traceability on the projection chart.
    meta_columns = [c for c in ("id", "record_id", "date") if c in cleaned.columns]
    if meta_columns:
        subset = subset.join(cleaned.loc[index_kept, meta_columns])

    return subset, selected, summary


def pairwise_frame(
    frame: pd.DataFrame, variables: list[str] | None = None
) -> tuple[pd.DataFrame, list[str], dict[str, str], PreprocessSummary]:
    """Return a cleaned numeric frame that keeps NaNs for pairwise-complete analysis."""
    cleaned, summary = clean_frame(frame)
    selected, excluded = eligible_features(cleaned, variables)
    summary.columns_excluded = excluded
    summary.columns_used = selected
    if not selected:
        return pd.DataFrame(), [], excluded, summary
    subset = cleaned[selected].apply(pd.to_numeric, errors="coerce")
    subset = subset.replace([np.inf, -np.inf], np.nan)
    return subset, selected, excluded, summary
