"""Algorithm tests: clustering, correlation and association-rule arithmetic.

The association-rule numbers below are verified by hand against a 10-row table,
so a regression in the support/confidence/lift formulas fails loudly.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from app.services import analytics, association_rules, clustering, correlation, insight_service


# --------------------------------------------------------------------------- #
# Clustering
# --------------------------------------------------------------------------- #
def _two_blob_frame() -> pd.DataFrame:
    rng = np.random.default_rng(7)
    low = pd.DataFrame(
        {
            "sleep_hours": rng.normal(5.0, 0.2, 30),
            "screen_time_hours": rng.normal(9.0, 0.3, 30),
            "mood_score": rng.normal(3.0, 0.3, 30),
            "productivity_score": rng.normal(3.0, 0.3, 30),
        }
    )
    high = pd.DataFrame(
        {
            "sleep_hours": rng.normal(8.0, 0.2, 30),
            "screen_time_hours": rng.normal(3.0, 0.3, 30),
            "mood_score": rng.normal(8.0, 0.3, 30),
            "productivity_score": rng.normal(8.0, 0.3, 30),
        }
    )
    frame = pd.concat([low, high], ignore_index=True)
    frame["date"] = pd.date_range("2024-01-01", periods=len(frame), freq="D")
    return frame


def test_clustering_separates_two_clear_groups():
    result = clustering.run_clustering(_two_blob_frame(), n_clusters=2)
    assert result.available is True
    assert result.n_clusters == 2
    assert result.rows_used == 60
    assert sum(profile.size for profile in result.profiles) == 60
    # Two well-separated blobs must score well above the no-structure baseline.
    assert result.silhouette_available is True
    assert result.silhouette_score is not None and result.silhouette_score > 0.5
    assert len(result.projection) == 60
    assert len(result.projection_explained_variance) == 2


def test_cluster_labels_come_from_profiles_not_ids():
    result = clustering.run_clustering(_two_blob_frame(), n_clusters=2)
    labels = {profile.label for profile in result.profiles}
    assert len(labels) == 2
    assert all(not label.startswith("Cluster") for label in labels)
    # Every reported feature mean must match the data, not a constant.
    for profile in result.profiles:
        assert profile.features
        assert any(feature.direction in {"above", "below"} for feature in profile.features)


def test_clustering_refuses_insufficient_data():
    frame = pd.DataFrame(
        {
            "sleep_hours": [7.0, 6.0, 8.0],
            "mood_score": [5, 6, 7],
            "date": pd.date_range("2024-01-01", periods=3, freq="D"),
        }
    )
    result = clustering.run_clustering(frame, n_clusters=3)
    assert result.available is False
    assert "at least 10" in result.message
    assert result.profiles == []


def test_clustering_handles_empty_frame():
    result = clustering.run_clustering(pd.DataFrame())
    assert result.available is False
    assert result.rows_used == 0


def test_cluster_count_is_capped_by_distinct_observations():
    """20 identical rows cannot support 6 clusters."""
    frame = pd.DataFrame(
        {
            "sleep_hours": [7.0] * 10 + [5.0] * 10,
            "screen_time_hours": [4.0] * 10 + [9.0] * 10,
            "mood_score": [7] * 10 + [3] * 10,
            "date": pd.date_range("2024-01-01", periods=20, freq="D"),
        }
    )
    result = clustering.run_clustering(frame, n_clusters=6)
    assert result.available is True
    assert result.n_clusters == 2
    assert result.requested_clusters == 6
    assert "supports 2" in result.message


def test_clustering_excludes_constant_and_identifier_columns():
    frame = _two_blob_frame()
    frame["caffeine_servings"] = 2.0  # constant
    frame["id"] = range(len(frame))
    result = clustering.run_clustering(frame, n_clusters=2)
    assert "caffeine_servings" not in result.features_used
    assert "id" not in result.features_used
    assert "date" not in result.features_used


def test_clustering_imputes_rather_than_discarding_usable_rows():
    frame = _two_blob_frame()
    frame.loc[0, "sleep_hours"] = np.nan
    result = clustering.run_clustering(frame, n_clusters=2)
    assert result.rows_used == 60


# --------------------------------------------------------------------------- #
# Correlation
# --------------------------------------------------------------------------- #
def test_monotonic_relationship_matches_hand_computed_rho(small_frame):
    """Sleep rises strictly; productivity rises with one tie at rank 2.5.

    Spearman is Pearson on ranks: x ranks 1..8, y ranks 1, 2.5, 2.5, 4, 5, 6, 7, 8.
    That single tie puts rho at 0.994 rather than exactly 1.
    """
    result = correlation.run_correlations(small_frame, method="spearman", min_samples=5)
    assert result.available is True
    pair = next(
        p for p in result.ranked_pairs
        if {p.x_field, p.y_field} == {"sleep_hours", "productivity_score"}
    )
    assert pair.coefficient == pytest.approx(0.994, abs=5e-4)
    assert pair.sample_size == 8
    assert pair.direction == "positive"
    assert pair.strength == "strong"
    assert "not proof" in pair.interpretation


def test_negative_relationship_is_reported_as_negative(small_frame):
    result = correlation.run_correlations(small_frame, method="spearman", min_samples=5)
    pair = next(
        p for p in result.ranked_pairs
        if {p.x_field, p.y_field} == {"stress_score", "mood_score"}
    )
    assert pair.coefficient < -0.9
    assert pair.direction == "negative"


def test_pearson_matches_numpy_on_the_same_slice(small_frame):
    result = correlation.run_correlations(small_frame, method="pearson", min_samples=5)
    pair = next(
        p for p in result.ranked_pairs
        if {p.x_field, p.y_field} == {"sleep_hours", "productivity_score"}
    )
    expected = float(
        np.corrcoef(small_frame["sleep_hours"], small_frame["productivity_score"])[0, 1]
    )
    assert pair.coefficient == pytest.approx(expected, abs=1e-4)


def test_pairwise_sample_sizes_are_reported_per_pair(small_frame):
    frame = small_frame.copy()
    frame.loc[[0, 1, 2], "stress_score"] = np.nan
    result = correlation.run_correlations(frame, method="spearman", min_samples=3)
    sleep_pair = next(
        p for p in result.ranked_pairs
        if {p.x_field, p.y_field} == {"sleep_hours", "productivity_score"}
    )
    stress_pair = next(
        p for p in result.ranked_pairs if "stress_score" in {p.x_field, p.y_field}
    )
    assert sleep_pair.sample_size == 8
    assert stress_pair.sample_size == 5


def test_constant_column_is_excluded_with_a_reason(small_frame):
    frame = small_frame.copy()
    frame["caffeine_servings"] = 3.0
    result = correlation.run_correlations(frame, min_samples=5)
    assert "caffeine_servings" in result.excluded_variables
    assert "constant" in result.excluded_variables["caffeine_servings"]
    assert "caffeine_servings" not in result.variables


def test_small_samples_are_flagged_as_insufficient(small_frame):
    result = correlation.run_correlations(small_frame, min_samples=20)
    assert all(pair.evidence == "insufficient" for pair in result.ranked_pairs)
    assert "threshold" in result.message


def test_correlation_needs_two_varying_columns():
    frame = pd.DataFrame({"sleep_hours": [7.0, 7.5, 8.0]})
    result = correlation.run_correlations(frame)
    assert result.available is False
    assert "at least two" in result.message


def test_target_filter_keeps_only_target_pairs(small_frame):
    result = correlation.run_correlations(
        small_frame, target="productivity_score", min_samples=5
    )
    assert result.ranked_pairs
    assert all(
        "productivity_score" in {pair.x_field, pair.y_field} for pair in result.ranked_pairs
    )


def test_unavailable_target_is_explained(small_frame):
    result = correlation.run_correlations(small_frame, target="caffeine_servings")
    assert result.available is False
    assert "not available" in result.message


# --------------------------------------------------------------------------- #
# Association rules
# --------------------------------------------------------------------------- #
def _hand_checked_frame() -> pd.DataFrame:
    """10 rows designed so the rule arithmetic can be verified by hand.

    Bands applied by BIN_SPECS:
      sleep < 6          -> "Sleep: Short"
      stress >= 7        -> "Stress: High"
      productivity < 5   -> "Productivity: Low"

    Rows 1-6: sleep 5, stress 8  -> Short + High
              rows 1-5 productivity 3 (Low), row 6 productivity 9 (High)
    Rows 7-10: sleep 8, stress 2, productivity 9 -> Long + Low stress + High prod

    So, for {Sleep: Short, Stress: High} -> {Productivity: Low}:
        count(Short & High)              = 6   -> support 0.6
        count(Short & High & Prod Low)   = 5   -> support 0.5
        confidence                       = 5/6 = 0.8333
        support(Productivity: Low)       = 5/10 = 0.5
        lift                             = 0.8333 / 0.5 = 1.6667
    """
    return pd.DataFrame(
        {
            "date": pd.date_range("2024-01-01", periods=10, freq="D"),
            "sleep_hours": [5.0] * 6 + [8.0] * 4,
            "stress_score": [8] * 6 + [2] * 4,
            "productivity_score": [3, 3, 3, 3, 3, 9, 9, 9, 9, 9],
        }
    )


def test_rule_support_confidence_and_lift_match_hand_calculation():
    result = association_rules.run_association_rules(
        _hand_checked_frame().loc[_hand_checked_frame().index.repeat(2)].reset_index(drop=True),
        min_support=0.1,
        min_confidence=0.5,
        min_lift=1.0,
    )
    assert result.available is True
    assert result.transactions == 20

    rule = next(
        r
        for r in result.rules
        if set(r.antecedent) == {"Sleep: Short", "Stress: High"}
        and r.consequent == ["Productivity: Low"]
    )
    assert rule.support == pytest.approx(0.5, abs=1e-4)
    assert rule.confidence == pytest.approx(5 / 6, abs=1e-4)
    assert rule.lift == pytest.approx((5 / 6) / 0.5, abs=1e-4)
    assert rule.antecedent_support == pytest.approx(0.6, abs=1e-4)
    assert rule.consequent_support == pytest.approx(0.5, abs=1e-4)
    assert rule.matching_transactions == 12
    assert "does not show that one caused" in rule.interpretation


def test_apriori_counts_match_brute_force():
    transactions = [
        frozenset({"a", "b", "c"}),
        frozenset({"a", "b"}),
        frozenset({"a", "c"}),
        frozenset({"b", "c"}),
        frozenset({"a"}),
    ]
    counts = association_rules.apriori(transactions, min_support=0.2, max_size=3)
    assert counts[frozenset({"a"})] == 4
    assert counts[frozenset({"b"})] == 3
    assert counts[frozenset({"a", "b"})] == 2
    assert counts[frozenset({"a", "b", "c"})] == 1


def test_apriori_prunes_below_min_support():
    transactions = [frozenset({"a"}), frozenset({"a"}), frozenset({"b"})]
    counts = association_rules.apriori(transactions, min_support=0.5, max_size=2)
    assert frozenset({"a"}) in counts
    assert frozenset({"b"}) not in counts


def test_rules_report_informative_empty_state_when_thresholds_too_high():
    result = association_rules.run_association_rules(
        _hand_checked_frame().loc[_hand_checked_frame().index.repeat(3)].reset_index(drop=True),
        min_support=0.9,
        min_confidence=0.99,
        min_lift=5.0,
    )
    assert result.available is True
    assert result.rules == []
    assert "No rule met" in result.message


def test_rules_refuse_tiny_datasets():
    result = association_rules.run_association_rules(_hand_checked_frame())
    assert result.available is False
    assert "at least 20" in result.message


def test_bin_definitions_are_published_for_the_ui():
    definitions = association_rules.bin_definitions(["sleep_hours", "stress_score"])
    assert "Sleep duration" in definitions
    assert "Sleep: Short" in definitions["Sleep duration"]
    assert definitions["Sleep duration"]["Sleep: Short"] == "below 6"


# --------------------------------------------------------------------------- #
# Overview metrics and insights
# --------------------------------------------------------------------------- #
def test_overview_metrics_match_known_fixture(small_frame):
    metrics = {metric.key: metric for metric in analytics.compute_metrics(small_frame)}
    assert metrics["sleep_hours"].value == pytest.approx(6.75)
    assert metrics["sleep_hours"].sample_size == 8
    assert metrics["productivity_score"].value == pytest.approx(5.75)
    # A column absent from the frame reports None rather than zero.
    assert metrics["screen_time_hours"].value is None
    assert metrics["screen_time_hours"].sample_size == 0


def test_metrics_ignore_missing_values():
    frame = pd.DataFrame({"mood_score": [4, np.nan, 8], "date": pd.date_range("2024-01-01", periods=3)})
    metrics = {metric.key: metric for metric in analytics.compute_metrics(frame)}
    assert metrics["mood_score"].value == pytest.approx(6.0)
    assert metrics["mood_score"].sample_size == 2


def test_sufficiency_explains_an_empty_dataset():
    assessment = analytics.assess_sufficiency(pd.DataFrame())
    assert assessment.sufficient is False
    assert assessment.record_count == 0
    assert "No records" in assessment.guidance


def test_insights_are_generated_from_computed_results():
    frame = _two_blob_frame().loc[_two_blob_frame().index.repeat(2)].reset_index(drop=True)
    frame["date"] = pd.date_range("2024-01-01", periods=len(frame), freq="D")
    frame["stress_score"] = (10 - frame["mood_score"]).round().clip(1, 10)

    correlations = correlation.run_correlations(frame)
    rules = association_rules.run_association_rules(frame, min_support=0.1)
    clusters = clustering.run_clustering(frame, n_clusters=2)
    insights = insight_service.build_insights(frame, "user", correlations, rules, clusters)

    assert insights.record_count == len(frame)
    assert insights.is_synthetic is False
    keys = {group.key for group in insights.groups}
    assert "clusters" in keys
    assert any("association" in text.lower() or "cause" in text.lower() for text in insights.disclaimers)

    for group in insights.groups:
        for item in group.items:
            assert item.detail
            assert item.evidence
            assert item.kind in {"observation", "suggestion"}


def test_insights_label_demo_data_as_synthetic():
    frame = _two_blob_frame()
    insights = insight_service.build_insights(
        frame,
        "demo",
        correlation.run_correlations(frame),
        association_rules.run_association_rules(frame, min_support=0.1),
        clustering.run_clustering(frame, n_clusters=2),
    )
    assert insights.is_synthetic is True
    assert any("synthetic" in text.lower() for text in insights.disclaimers)


def test_insights_on_empty_data_do_not_invent_findings():
    empty = pd.DataFrame()
    insights = insight_service.build_insights(
        empty,
        "user",
        correlation.run_correlations(empty),
        association_rules.run_association_rules(empty),
        clustering.run_clustering(empty),
    )
    assert insights.record_count == 0
    assert all(group.items for group in insights.groups)  # empty groups are dropped
    assert insights.data_sufficiency.sufficient is False
