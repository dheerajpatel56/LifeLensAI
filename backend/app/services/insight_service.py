"""Deterministic insight generation.

Every sentence here is built from a template filled with numbers that the mining
services actually computed. No language model, no external API, no invented
findings. Observations are separated from suggestions, and suggestions are phrased
as experiments to try, never as predicted outcomes.
"""

from __future__ import annotations

from datetime import datetime, timezone

import pandas as pd

from app.core.constants import (
    FIELD_LABELS,
    OUTCOME_FIELDS,
    SOURCE_DEMO,
    SOURCE_LABELS,
    WEAK_EVIDENCE_SAMPLES,
)
from app.db.schemas import (
    ClusterResponse,
    CorrelationResponse,
    InsightGroup,
    InsightItem,
    InsightsResponse,
    RulesResponse,
)
from app.services.analytics import assess_sufficiency

SYNTHETIC_DISCLAIMER = (
    "These observations come from the built-in synthetic demo dataset. The patterns were "
    "created by the data generator and are not findings about real people."
)
USER_DATA_NOTE = (
    "These observations come from your own recorded data. They describe this dataset only."
)
GENERAL_DISCLAIMERS = [
    "LifeLens AI is not a medical or diagnostic tool and gives no clinical advice.",
    "Mood and productivity are self-reported scores, not measured outcomes.",
    "Every relationship shown is an association within this dataset. None of it establishes cause.",
    "Small samples produce unstable numbers. Sample sizes are shown so you can judge the evidence.",
]


def _evidence_text(sample_size: int) -> str:
    if sample_size < WEAK_EVIDENCE_SAMPLES:
        return f"n = {sample_size} (small sample — treat as a hint)"
    return f"n = {sample_size}"


def _correlation_items(correlations: CorrelationResponse) -> tuple[list[InsightItem], list[InsightItem]]:
    """Return `(positive, negative)` correlation insights involving the outcomes."""
    positive: list[InsightItem] = []
    negative: list[InsightItem] = []
    if not correlations.available:
        return positive, negative

    for pair in correlations.ranked_pairs:
        if pair.evidence == "insufficient" or pair.strength in {"negligible"}:
            continue
        involves_outcome = pair.x_field in OUTCOME_FIELDS or pair.y_field in OUTCOME_FIELDS
        if not involves_outcome:
            continue

        item = InsightItem(
            id=f"corr-{pair.x_field}-{pair.y_field}",
            category="correlation",
            kind="observation",
            title=f"{pair.x_label} and {pair.y_label} move together"
            if pair.coefficient > 0
            else f"{pair.x_label} and {pair.y_label} move in opposite directions",
            detail=pair.interpretation,
            evidence=(
                f"{correlations.method.title()} correlation {pair.coefficient:+.2f}, "
                f"{_evidence_text(pair.sample_size)}"
            ),
            sample_size=pair.sample_size,
            strength=pair.strength,
            confidence_note=(
                "Sample is small, so the coefficient is unstable."
                if pair.evidence == "limited"
                else None
            ),
            related_page="/patterns",
        )
        (positive if pair.coefficient > 0 else negative).append(item)

    return positive[:5], negative[:5]


def _rule_items(rules: RulesResponse) -> list[InsightItem]:
    items: list[InsightItem] = []
    if not rules.available:
        return items
    for index, rule in enumerate(rules.rules[:6]):
        items.append(
            InsightItem(
                id=f"rule-{index}",
                category="association",
                kind="observation",
                title=f"{rule.antecedent_text} → {rule.consequent_text}",
                detail=rule.interpretation,
                evidence=(
                    f"support {rule.support:.1%}, confidence {rule.confidence:.1%}, "
                    f"lift {rule.lift:.2f}, {rule.matching_transactions} matching day(s)"
                ),
                sample_size=rule.matching_transactions,
                strength="strong" if rule.lift >= 1.5 else "moderate",
                confidence_note=(
                    "Few matching days — this rule may not hold as more data arrives."
                    if rule.matching_transactions < WEAK_EVIDENCE_SAMPLES
                    else None
                ),
                related_page="/patterns",
            )
        )
    return items


def _cluster_items(clusters: ClusterResponse) -> list[InsightItem]:
    items: list[InsightItem] = []
    if not clusters.available:
        return items

    for profile in sorted(clusters.profiles, key=lambda p: p.size, reverse=True):
        if profile.size == 0:
            continue
        notable = [f for f in profile.features if f.direction != "typical"]
        notable.sort(key=lambda f: abs(f.z_score), reverse=True)
        traits = ", ".join(
            f"{f.label.lower()} {f.mean:g}{f.unit or ''} vs {f.overall_mean:g} overall"
            for f in notable[:3]
        )
        detail = profile.description
        if traits:
            detail += f" Compared with the whole dataset: {traits}."
        items.append(
            InsightItem(
                id=f"cluster-{profile.cluster_id}",
                category="cluster",
                kind="observation",
                title=f"{profile.label} — {profile.size} day(s), {profile.share:.0%} of records",
                detail=detail,
                evidence=(
                    f"K-Means group {profile.cluster_id} of {clusters.n_clusters}, "
                    f"{profile.size} day(s)"
                    + (
                        f", silhouette {clusters.silhouette_score:+.2f}"
                        if clusters.silhouette_score is not None
                        else ""
                    )
                ),
                sample_size=profile.size,
                strength=None,
                confidence_note=(
                    "Descriptive label derived from this group's own averages, not a diagnosis."
                ),
                related_page="/patterns",
            )
        )
    return items


def _suggestion_items(
    correlations: CorrelationResponse, rules: RulesResponse
) -> list[InsightItem]:
    """Turn the strongest observations into cautious experiments to try."""
    suggestions: list[InsightItem] = []

    for pair in correlations.ranked_pairs if correlations.available else []:
        if pair.evidence != "reasonable" or pair.strength not in {"moderate", "strong"}:
            continue
        if pair.y_field not in OUTCOME_FIELDS:
            continue
        if pair.coefficient > 0:
            action = f"track whether deliberately increasing {pair.x_label.lower()}"
        else:
            action = f"track whether deliberately reducing {pair.x_label.lower()}"
        suggestions.append(
            InsightItem(
                id=f"suggest-{pair.x_field}-{pair.y_field}",
                category="correlation",
                kind="suggestion",
                title=f"Worth testing: {pair.x_label} and {pair.y_label}",
                detail=(
                    f"Because {pair.x_label.lower()} and {pair.y_label.lower()} are associated in "
                    f"this dataset ({correlations.method} {pair.coefficient:+.2f}, n = "
                    f"{pair.sample_size}), you could {action} changes your recorded "
                    f"{pair.y_label.lower()} over the next few weeks. This is an experiment to run, "
                    "not a predicted result."
                ),
                evidence=f"{correlations.method.title()} {pair.coefficient:+.2f}, {_evidence_text(pair.sample_size)}",
                sample_size=pair.sample_size,
                strength=pair.strength,
                related_page="/check-in",
            )
        )
        if len(suggestions) >= 3:
            break

    if rules.available and rules.rules:
        top = rules.rules[0]
        suggestions.append(
            InsightItem(
                id="suggest-rule-0",
                category="association",
                kind="suggestion",
                title=f"Watch the combination: {top.antecedent_text}",
                detail=(
                    f"Days with {top.antecedent_text.lower()} coincided with "
                    f"{top.consequent_text.lower()} {top.confidence:.0%} of the time "
                    f"({top.matching_transactions} day(s)). Keep logging days that match this "
                    "combination to see whether the pattern holds for you."
                ),
                evidence=(
                    f"support {top.support:.1%}, confidence {top.confidence:.1%}, lift {top.lift:.2f}"
                ),
                sample_size=top.matching_transactions,
                strength=None,
                related_page="/patterns",
            )
        )
    return suggestions


def _data_quality_items(frame: pd.DataFrame, source: str) -> list[InsightItem]:
    items: list[InsightItem] = []
    total = len(frame)
    if total == 0:
        return items

    for field in FIELD_LABELS:
        if field not in frame.columns:
            continue
        missing = int(pd.to_numeric(frame[field], errors="coerce").isna().sum())
        if missing == 0:
            continue
        share = missing / total
        if share < 0.05:
            continue
        items.append(
            InsightItem(
                id=f"quality-{field}",
                category="data_quality",
                kind="observation",
                title=f"{FIELD_LABELS[field]} is missing on {share:.0%} of days",
                detail=(
                    f"{missing} of {total} record(s) have no {FIELD_LABELS[field].lower()} value. "
                    "Analyses that use this column run on fewer days, which widens the uncertainty."
                ),
                evidence=f"{missing} missing of {total} record(s)",
                sample_size=total - missing,
                related_page="/datasets",
            )
        )
    return items[:4]


def build_insights(
    frame: pd.DataFrame,
    source: str,
    correlations: CorrelationResponse,
    rules: RulesResponse,
    clusters: ClusterResponse,
) -> InsightsResponse:
    """Assemble every insight group from already-computed mining results."""
    positive, negative = _correlation_items(correlations)
    sufficiency = assess_sufficiency(frame)

    groups: list[InsightGroup] = [
        InsightGroup(
            key="positive",
            title="Strongest positive associations",
            description=(
                "Variables that rose together within this dataset. Direction only — not cause."
            ),
            items=positive,
        ),
        InsightGroup(
            key="negative",
            title="Strongest negative associations",
            description="Variables that moved in opposite directions within this dataset.",
            items=negative,
        ),
        InsightGroup(
            key="rules",
            title="Notable association rules",
            description=(
                "Combinations of lifestyle bands that co-occurred more often than chance predicts."
            ),
            items=_rule_items(rules),
        ),
        InsightGroup(
            key="clusters",
            title="Routine profiles",
            description=(
                "Unsupervised K-Means groups, labelled from each group's own observed averages."
            ),
            items=_cluster_items(clusters),
        ),
        InsightGroup(
            key="suggestions",
            title="Things worth testing",
            description=(
                "Experiments you could run on yourself. These are suggestions, not predictions."
            ),
            items=_suggestion_items(correlations, rules),
        ),
        InsightGroup(
            key="quality",
            title="Data quality notes",
            description="Gaps that limit what the analyses above can say.",
            items=_data_quality_items(frame, source),
        ),
    ]

    disclaimers = [
        SYNTHETIC_DISCLAIMER if source == SOURCE_DEMO else USER_DATA_NOTE,
        *GENERAL_DISCLAIMERS,
    ]
    if not sufficiency.sufficient:
        disclaimers.insert(1, sufficiency.guidance)

    return InsightsResponse(
        source=source,  # type: ignore[arg-type]
        source_label=SOURCE_LABELS.get(source, source),
        is_synthetic=source == SOURCE_DEMO,
        record_count=len(frame),
        generated_at=datetime.now(timezone.utc),
        groups=[group for group in groups if group.items],
        disclaimers=disclaimers,
        data_sufficiency=sufficiency,
    )


def top_patterns(
    correlations: CorrelationResponse, rules: RulesResponse, limit: int = 4
) -> list[InsightItem]:
    """The few most notable findings, for the overview dashboard."""
    positive, negative = _correlation_items(correlations)

    # Correlation pairs already arrive ranked by |coefficient|; interleave the two
    # strands so the dashboard shows both correlation and rule findings.
    merged: list[InsightItem] = []
    correlation_items = positive + negative
    rule_items = _rule_items(rules)

    for index in range(max(len(correlation_items), len(rule_items))):
        if index < len(correlation_items):
            merged.append(correlation_items[index])
        if index < len(rule_items):
            merged.append(rule_items[index])
        if len(merged) >= limit:
            break
    return merged[:limit]
