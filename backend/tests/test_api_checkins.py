"""Health endpoint and check-in CRUD, including validation and duplicate dates."""

from __future__ import annotations


def test_health_reports_ok(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["app"] == "LifeLens AI"
    assert set(body["record_counts"]) == {"demo", "user", "import"}


def test_create_then_read_update_delete(client, valid_payload):
    created = client.post("/api/checkins", json=valid_payload)
    assert created.status_code == 201, created.text
    record = created.json()
    record_id = record["id"]
    assert record["mood_score"] == 7
    assert record["source"] == "user"

    fetched = client.get(f"/api/checkins/{record_id}")
    assert fetched.status_code == 200
    assert fetched.json()["sleep_hours"] == 7.5

    updated_payload = {**valid_payload, "mood_score": 3, "notes": "Rough day."}
    updated = client.put(f"/api/checkins/{record_id}", json=updated_payload)
    assert updated.status_code == 200
    assert updated.json()["mood_score"] == 3
    assert updated.json()["notes"] == "Rough day."

    listing = client.get("/api/checkins")
    assert listing.status_code == 200
    assert listing.json()["total"] == 1

    deleted = client.delete(f"/api/checkins/{record_id}")
    assert deleted.status_code == 204
    assert client.get(f"/api/checkins/{record_id}").status_code == 404
    assert client.get("/api/checkins").json()["total"] == 0


def test_duplicate_date_is_rejected_with_conflict(client, valid_payload):
    assert client.post("/api/checkins", json=valid_payload).status_code == 201
    clash = client.post("/api/checkins", json=valid_payload)
    assert clash.status_code == 409
    assert "already exists" in clash.json()["detail"]


def test_duplicate_date_lookup_helps_the_form(client, valid_payload):
    client.post("/api/checkins", json=valid_payload)
    found = client.get("/api/checkins/by-date/2024-03-01")
    assert found.status_code == 200
    assert found.json()["date"] == "2024-03-01"
    assert client.get("/api/checkins/by-date/2024-03-02").status_code == 404


def test_update_cannot_steal_another_records_date(client, valid_payload):
    first = client.post("/api/checkins", json=valid_payload).json()
    second = client.post("/api/checkins", json={**valid_payload, "date": "2024-03-02"}).json()
    clash = client.put(
        f"/api/checkins/{second['id']}", json={**valid_payload, "date": first["date"]}
    )
    assert clash.status_code == 409


class TestInvalidInput:
    def test_sleep_hours_above_range(self, client, valid_payload):
        response = client.post("/api/checkins", json={**valid_payload, "sleep_hours": 25})
        assert response.status_code == 422
        assert "sleep_hours" in response.json()["detail"]

    def test_mood_outside_scale(self, client, valid_payload):
        assert client.post("/api/checkins", json={**valid_payload, "mood_score": 0}).status_code == 422
        assert client.post("/api/checkins", json={**valid_payload, "mood_score": 11}).status_code == 422

    def test_mood_must_be_whole_number(self, client, valid_payload):
        response = client.post("/api/checkins", json={**valid_payload, "mood_score": 7.5})
        assert response.status_code == 422

    def test_social_media_cannot_exceed_screen_time(self, client, valid_payload):
        response = client.post(
            "/api/checkins",
            json={**valid_payload, "screen_time_hours": 2.0, "social_media_hours": 5.0},
        )
        assert response.status_code == 422
        assert "social_media_hours" in response.json()["detail"]

    def test_exercise_minutes_upper_bound(self, client, valid_payload):
        response = client.post("/api/checkins", json={**valid_payload, "exercise_minutes": 1441})
        assert response.status_code == 422

    def test_invalid_date(self, client, valid_payload):
        response = client.post("/api/checkins", json={**valid_payload, "date": "2024-02-31"})
        assert response.status_code == 422

    def test_notes_length_limit(self, client, valid_payload):
        response = client.post("/api/checkins", json={**valid_payload, "notes": "x" * 501})
        assert response.status_code == 422

    def test_invalid_data_is_not_silently_corrected(self, client, valid_payload):
        """A rejected payload must leave no partial record behind."""
        client.post("/api/checkins", json={**valid_payload, "sleep_hours": 99})
        assert client.get("/api/checkins").json()["total"] == 0


def test_date_range_filter_on_listing(client, valid_payload):
    for day in ("2024-03-01", "2024-03-05", "2024-03-10"):
        client.post("/api/checkins", json={**valid_payload, "date": day})
    filtered = client.get("/api/checkins", params={"start": "2024-03-04", "end": "2024-03-06"})
    assert filtered.json()["total"] == 1
    assert filtered.json()["items"][0]["date"] == "2024-03-05"


def test_listing_rejects_reversed_range(client):
    response = client.get("/api/checkins", params={"start": "2024-03-10", "end": "2024-03-01"})
    assert response.status_code == 422
