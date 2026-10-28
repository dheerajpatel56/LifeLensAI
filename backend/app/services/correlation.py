"""Correlation discovery with honest sample sizes and no causal claims.

Every pair is computed on its own pairwise-complete observations, and that pair's
`n` travels with the coefficient all the way to the UI. A p-value is reported
only when SciPy can compute one for that pair; it is explicitly described as a
test of the null hypothesis of no monotonic/linear association, never as proof.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from scipy import stats

from app.core.constants import (
    FIELD_LABELS,
    MIN_CORRELATION_SAMPLES,
    OUTCOME_FIELDS,
    WEAK_EVIDENCE_SAMPLES,
)
from app.db.schemas import (
    CorrelationMatrixCell,
    CorrelationPair,
    CorrelationResponse,
)
from app.services.preprocessing import pairwise_frame

CAVEATS = [
    "Correlation describes how two variables move together. It is not evidence that one causes the other.",
    "Each coefficient is computed only on days where both variables were recorded, so sample sizes differ between pairs.",
    "A third factor you are not recording (an exam week, an illness, a holiday) can produce a strong correlation on its own.",
    "Spearman uses ranks and handles non-linear monotonic relationships and outliers better than Pearson.",
]


def _strength(coefficient: float) -> str:
    magnitude = abs(coefficient)
    if magnitude < 0.1:
        return "negligible"
    if magnitude < 0.3:
        return "weak"
    if magnitude < 0.5:
        return "moderate"
    return "strong"


def _evidence(sample_size: int, min_samples: int) -> str:
    if sample_size < min_samples:
        return "insufficient"
    if sample_size < WEAK_EVIDENCE_SAMPLES:
        return "limited"
    return "reasonable"


def _interpretation(
    x_label: str,
    y_label: str,
    coefficient: float,
    sample_size: int,
    method: str,
    evidence: str,
) -> str:
    strength = _strength(coefficient)
    if strength == "negligible":
        return (
            f"{x_label} and {y_label} show no meaningful association in this dataset "
            f"({method} = {coefficient:+.2f}, n = {sample_size})."
        )

    direction = "higher" if coefficient > 0 else "lower"
    sentence = (
        f"Within this dataset, higher {x_label.lower()} tended to occur alongside "
        f"{direction} {y_label.lower()} ({method} = {coefficient:+.2f}, n = {sample_size}, "
        f"{strength} association). This is an association, not proof that one caused the other."
    )
    if evidence == "insufficient":
        sentence += " The sample is too small to rely on."
    elif evidence == "limited":
        sentence += " The sample is small, so treat it as a hint rather than a finding."
    return sentence


def _pair_stats(x: pd.Series, y: pd.Series, method: str) -> tuple[float | None, int, float | None]:
    """Return `(coefficient, n, p_value)` for one pair of columns."""
    mask = x.notna() & y.notna()
    sample_size = int(mask.sum())
    if sample_size < 3:
        return None, sample_size, None

    x_values = x[mask].to_numpy(dtype=float)
    y_values = y[mask].to_numpy(dtype=float)

    # A constant slice has no variance, so no correlation is defined.
    if np.std(x_values) == 0.0 or np.std(y_values) == 0.0:
        return None, sample_size, None

    try:
        if method == "pearson":
            result = stats.pearsonr(x_values, y_values)
        else:
            result = stats.spearmanr(x_values, y_values)
        coefficient = float(result.statistic)
        p_value = float(result.pvalue)
    except (ValueError, FloatingPointError):
        return None, sample_size, None

    if not np.isfinite(coefficient):
        return None, sample_size, None
    p_value = p_value if np.isfinite(p_value) else None
    return coefficient, sample_size, p_value


def run_correlations(
    frame: pd.DataFrame,
    method: str = "spearman",
    variables: list[str] | None = None,
    target: str | None = None,
    min_samples: int = MIN_CORRELATION_SAMPLES,
    source: str = "demo",
) -> CorrelationResponse:
    """Build the full matrix plus a ranked list of the most notable pairs."""
    subset, selected, excluded, summary = pairwise_frame(frame, variables)

    empty = CorrelationResponse(
        available=False,
        message="",
        source=source,  # type: ignore[arg-type]
        method=method,  # type: ignore[arg-type]
        rows_considered=len(subset),
        variables=selected,
        labels={f: FIELD_LABELS.get(f, f) for f in selected},
        matrix=[],
        ranked_pairs=[],
        excluded_variables=excluded,
        caveats=CAVEATS,
    )

    if subset.empty or len(selected) < 2:
        empty.message = (
            "Correlation analysis needs at least two numeric columns that vary. "
            "The active dataset does not provide them yet."
        )
        return empty

    if target and target not in selected:
        empty.message = (
            f"'{FIELD_LABELS.get(target, target)}' is not available for correlation in this dataset"
            f" ({excluded.get(target, 'column not found')})."
        )
        return empty

    matrix: list[CorrelationMatrixCell] = []
    pairs: list[CorrelationPair] = []

    for i, x_field in enumerate(selected):
        for j, y_field in enumerate(selected):
            coefficient, sample_size, p_value = _pair_stats(
                subset[x_field], subset[y_field], method
            )
            matrix.append(
                CorrelationMatrixCell(
                    x_field=x_field,
                    y_field=y_field,
                    coefficient=None if coefficient is None else round(coefficient, 4),
                    sample_size=sample_size,
                )
            )
            if j <= i or coefficient is None:
                continue
            if target and target not in (x_field, y_field):
                continue

            # Orient the pair so the target (or the outcome field) reads as "y".
            x_name, y_name = x_field, y_field
            if target:
                if x_field == target:
                    x_name, y_name = y_field, x_field
            elif y_field not in OUTCOME_FIELDS and x_field in OUTCOME_FIELDS:
                x_name, y_name = y_field, x_field

            x_label = FIELD_LABELS.get(x_name, x_name)
            y_label = FIELD_LABELS.get(y_name, y_name)
            evidence = _evidence(sample_size, min_samples)
            pairs.append(
                CorrelationPair(
                    x_field=x_name,
                    y_field=y_name,
                    x_label=x_label,
                    y_label=y_label,
                    coefficient=round(coefficient, 4),
                    sample_size=sample_size,
                    p_value=None if p_value is None else round(p_value, 6),
                    strength=_strength(coefficient),  # type: ignore[arg-type]
                    direction=(
                        "positive" if coefficient > 0 else "negative" if coefficient < 0 else "none"
                    ),  # type: ignore[arg-type]
                    evidence=evidence,  # type: ignore[arg-type]
                    interpretation=_interpretation(
                        x_label, y_label, coefficient, sample_size, method, evidence
                    ),
                )
            )

    pairs.sort(key=lambda pair: (abs(pair.coefficient), pair.sample_size), reverse=True)

    usable = [p for p in pairs if p.evidence != "insufficient"]
    if not pairs:
        message = "No variable pair had enough overlapping observations to correlate."
    elif not usable:
        message = (
            f"All pairs fell below the {min_samples}-observation threshold. "
            "Results are shown but the evidence is insufficient."
        )
    else:
        message = (
            f"Computed {len(pairs)} variable pairs using {method.title()} correlation. "
            f"{len(usable)} pair(s) met the {min_samples}-observation threshold."
        )

    return CorrelationResponse(
        available=True,
        message=message,
        source=source,  # type: ignore[arg-type]
        method=method,  # type: ignore[arg-type]
        rows_considered=len(subset),
        variables=selected,
        labels={f: FIELD_LABELS.get(f, f) for f in selected},
        matrix=matrix,
        ranked_pairs=pairs,
        excluded_variables=excluded,
        caveats=CAVEATS,
    )
