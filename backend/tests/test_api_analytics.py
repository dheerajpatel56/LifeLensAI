"""Analytics and insights endpoints against seeded data."""

from __future__ import annotations

from app.services import dataset_service


def _activate_user(client):
    return client.post("/api/datasets/active", json={"source": "user"})


def test_overview_computes_from_the_active_dataset(client, seeded_session):
    _activate_user(client)
    body = client.get("/api/analytics/overview").json()

    assert body["source"] == "user"
    assert body["record_count"] == 60
    assert body["filtered_count"] == 60
    assert body["is_synthetic"] is False

    metrics = {metric["key"]: metric for metric in body["metrics"]}
    assert metrics["mood_score"]["sample_size"] == 60
    assert metrics["mood_score"]["value"] is not None
    assert body["trend"]
    assert body["sleep_vs_productivity"]["sample_size"] == 60
    assert body["mood_vs_stress"]["sample_size"] == 60
    assert len(body["recent_checkins"]) == 7


def test_overview_date_filter_changes_the_numbers(client, seeded_session):
    _activate_user(client)
    full = client.get("/api/analytics/overview").json()
    windowed = client.get(
        "/api/analytics/overview", params={"start": "2024-01-01", "end": "2024-01-10"}
    ).json()

    assert windowed["filtered_count"] == 10
    assert windowed["record_count"] == 60  # unfiltered total is still reported
    full_sample = next(m for m in full["metrics"] if m["key"] == "mood_score")["sample_size"]
    window_sample = next(m for m in windowed["metrics"] if m["key"] == "mood_score")["sample_size"]
    assert window_sample == 10 and full_sample == 60


def test_overview_rejects_bad_dates(client):
    assert client.get("/api/analytics/overview", params={"start": "nope"}).status_code == 422
    assert (
        client.get(
            "/api/analytics/overview", params={"start": "2024-05-01", "end": "2024-01-01"}
        ).status_code
        == 422
    )


def test_overview_on_empty_dataset_explains_itself(client):
    _activate_user(client)
    body = client.get("/api/analytics/overview").json()
    assert body["record_count"] == 0
    assert body["trend"] == []
    assert body["cluster_distribution"] == []
    assert body["data_sufficiency"]["sufficient"] is False
    assert all(metric["value"] is None for metric in body["metrics"])


def test_clusters_endpoint(client, seeded_session):
    response = client.post(
        "/api/analytics/clusters", json={"source": "user", "n_clusters": 3}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["available"] is True
    assert body["rows_used"] == 60
    assert len(body["profiles"]) == body["n_clusters"]
    assert body["limitations"]


def test_clusters_endpoint_validates_cluster_count(client, seeded_session):
    assert client.post("/api/analytics/clusters", json={"n_clusters": 1}).status_code == 422
    assert client.post("/api/analytics/clusters", json={"n_clusters": 99}).status_code == 422


def test_correlations_endpoint_reports_sample_sizes(client, seeded_session):
    response = client.post(
        "/api/analytics/correlations",
        json={"source": "user", "method": "spearman", "target": "productivity_score"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["available"] is True
    assert body["ranked_pairs"]
    assert all(pair["sample_size"] > 0 for pair in body["ranked_pairs"])
    assert all(
        "productivity_score" in {pair["x_field"], pair["y_field"]}
        for pair in body["ranked_pairs"]
    )
    assert body["caveats"]


def test_correlations_endpoint_rejects_unknown_method(client):
    assert (
        client.post("/api/analytics/correlations", json={"method": "kendall"}).status_code == 422
    )


def test_association_rules_endpoint(client, seeded_session):
    response = client.post(
        "/api/analytics/association-rules",
        json={"source": "user", "min_support": 0.1, "min_confidence": 0.4, "min_lift": 1.0},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["available"] is True
    assert body["transactions"] == 60
    assert body["bin_definitions"]
    for rule in body["rules"]:
        assert 0 < rule["support"] <= 1
        assert 0 < rule["confidence"] <= 1
        assert rule["lift"] > 0


def test_association_rules_validates_thresholds(client):
    assert (
        client.post("/api/analytics/association-rules", json={"min_support": 0}).status_code == 422
    )
    assert (
        client.post("/api/analytics/association-rules", json={"min_confidence": 1.5}).status_code
        == 422
    )


def test_insights_endpoint_returns_grouped_explanations(client, seeded_session):
    _activate_user(client)
    body = client.get("/api/insights").json()
    assert body["source"] == "user"
    assert body["record_count"] == 60
    assert body["groups"]
    assert body["disclaimers"]
    for group in body["groups"]:
        for item in group["items"]:
            assert item["detail"] and item["evidence"]


def test_insights_marks_demo_data_as_synthetic(client, db_session):
    dataset_service.load_demo_dataset(db_session)
    body = client.get("/api/insights", params={"source": "demo"}).json()
    assert body["is_synthetic"] is True
    assert any("synthetic" in text.lower() for text in body["disclaimers"])


def test_analytics_reject_unknown_source(client):
    assert (
        client.post("/api/analytics/clusters", json={"source": "bogus"}).status_code == 422
    )
    assert client.get("/api/insights", params={"source": "bogus"}).status_code == 422
