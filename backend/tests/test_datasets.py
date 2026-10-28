"""Demo loading, dataset isolation and CSV import validation."""

from __future__ import annotations

import io

from app.core.constants import SOURCE_DEMO, SOURCE_IMPORT, SOURCE_USER
from app.services import dataset_service

GOOD_CSV = """date,sleep_hours,sleep_quality,screen_time_hours,social_media_hours,study_work_hours,exercise_minutes,caffeine_servings,stress_score,mood_score,productivity_score
2024-05-01,7.5,8,5,1.5,6,30,2,4,7,8
2024-05-02,6,5,8,3,7,0,4,7,4,4
2024-05-03,8,9,3,1,5,60,1,3,9,9
"""

ALIASED_CSV = """Day,Sleep,Screen Time,Social Media,Mood,Productivity,Stress
2024-06-01,7,5,2,7,8,4
2024-06-02,6,7,3,5,5,6
"""

# One deliberate problem per row: range, date format, scale, cross-field, duplicate.
BAD_CSV = """date,sleep_hours,mood_score,productivity_score,screen_time_hours,social_media_hours
2024-07-01,7,8,8,4,1
2024-07-02,99,8,8,4,1
not-a-date,7,8,8,4,1
2024-07-03,7,12,8,4,1
2024-07-05,7,8,8,2,5
2024-07-04,7,8,8,4,1
2024-07-04,7,8,8,4,1
"""

MISSING_COLUMN_CSV = """date,sleep_hours,screen_time_hours
2024-08-01,7,4
"""


def _upload(client, text: str, filename: str = "data.csv", **form):
    return client.post(
        "/api/datasets/upload",
        files={"file": (filename, io.BytesIO(text.encode("utf-8")), "text/csv")},
        data=form,
    )


def test_demo_loads_and_is_idempotent(db_session):
    first = dataset_service.load_demo_dataset(db_session)
    assert first.inserted > 1000
    assert first.activated is True

    second = dataset_service.load_demo_dataset(db_session)
    assert second.inserted == 0
    assert second.total_demo_records == first.total_demo_records
    assert "already loaded" in second.message


def test_demo_reload_with_replace_keeps_count_stable(db_session):
    first = dataset_service.load_demo_dataset(db_session)
    reloaded = dataset_service.load_demo_dataset(db_session, replace=True)
    assert reloaded.total_demo_records == first.total_demo_records


def test_demo_load_does_not_touch_user_records(db_session, seeded_session):
    before = dataset_service.count_by_source(db_session)[SOURCE_USER]
    dataset_service.load_demo_dataset(db_session)
    after = dataset_service.count_by_source(db_session)
    assert after[SOURCE_USER] == before
    assert after[SOURCE_DEMO] > 0


def test_switching_source_does_not_merge_records(client, seeded_session):
    dataset_service.load_demo_dataset(seeded_session)

    demo = client.post("/api/datasets/active", json={"source": "demo"}).json()
    assert demo["source"] == "demo"
    demo_count = demo["record_count"]

    user = client.post("/api/datasets/active", json={"source": "user"}).json()
    assert user["source"] == "user"
    assert user["record_count"] == 60
    assert user["record_count"] != demo_count


def test_unknown_source_is_rejected(client):
    assert client.post("/api/datasets/active", json={"source": "nope"}).status_code == 422
    assert client.get("/api/datasets/summary", params={"source": "nope"}).status_code == 422


def test_import_valid_csv(client):
    response = _upload(client, GOOD_CSV)
    assert response.status_code == 200, response.text
    report = response.json()
    assert report["accepted"] == 3
    assert report["rejected"] == 0
    assert report["activated"] is True
    assert report["missing_required_columns"] == []

    active = client.get("/api/datasets/active").json()
    assert active["source"] == "import"
    assert active["record_count"] == 3


def test_import_maps_column_aliases(client):
    report = _upload(client, ALIASED_CSV).json()
    assert report["accepted"] == 2
    assert report["detected_columns"]["Sleep"] == "sleep_hours"
    assert report["detected_columns"]["Screen Time"] == "screen_time_hours"
    assert report["detected_columns"]["Day"] == "date"


def test_import_reports_row_level_errors_without_dropping_silently(client):
    report = _upload(client, BAD_CSV).json()
    assert report["accepted"] == 2  # 2024-07-01 and 2024-07-04
    assert report["rejected"] == 5
    assert report["duplicates_within_file"] == 1

    messages = {(e["row_number"], e["field"]) for e in report["row_errors"]}
    assert (3, "sleep_hours") in messages          # 99 hours of sleep
    assert (4, "date") in messages                 # unparseable date
    assert (5, "mood_score") in messages           # mood 12
    assert (6, "social_media_hours") in messages   # social media above screen time
    assert (8, "date") in messages                 # duplicate 2024-07-04
    assert all(e["message"] for e in report["row_errors"])


def test_import_rejects_file_missing_required_columns(client):
    report = _upload(client, MISSING_COLUMN_CSV).json()
    assert report["accepted"] == 0
    assert "mood_score" in report["missing_required_columns"]
    assert "productivity_score" in report["missing_required_columns"]
    assert "required column" in report["message"]


def test_import_rejects_non_csv_extension(client):
    response = _upload(client, GOOD_CSV, filename="notes.txt")
    assert response.status_code == 422


def test_import_rejects_empty_file(client):
    response = _upload(client, "")
    assert response.status_code == 422


def test_import_replaces_previous_import_only(client, seeded_session):
    _upload(client, GOOD_CSV)
    _upload(client, ALIASED_CSV)
    counts = dataset_service.count_by_source(seeded_session)
    assert counts[SOURCE_IMPORT] == 2       # the second file replaced the first
    assert counts[SOURCE_USER] == 60        # user records untouched


def test_summary_reports_missingness_and_range(client, seeded_session):
    client.post("/api/datasets/active", json={"source": "user"})
    summary = client.get("/api/datasets/summary").json()
    assert summary["record_count"] == 60
    assert summary["date_start"] == "2024-01-01"
    assert summary["has_outcome_fields"] is True
    assert summary["duplicate_date_count"] == 0
    assert any(column["name"] == "mood_score" and column["present"] for column in summary["columns"])


def test_summary_explains_empty_dataset(client):
    client.post("/api/datasets/active", json={"source": "user"})
    summary = client.get("/api/datasets/summary").json()
    assert summary["record_count"] == 0
    assert summary["analyses_available"] is False
    assert any("empty" in note.lower() for note in summary["notes"])


def test_preview_paginates(client, seeded_session):
    client.post("/api/datasets/active", json={"source": "user"})
    page = client.get("/api/datasets/preview", params={"limit": 10, "offset": 0}).json()
    assert page["total"] == 60
    assert len(page["rows"]) == 10
    second = client.get("/api/datasets/preview", params={"limit": 10, "offset": 10}).json()
    assert second["rows"][0]["date"] != page["rows"][0]["date"]


def test_export_round_trips(client, seeded_session):
    client.post("/api/datasets/active", json={"source": "user"})
    response = client.get("/api/datasets/export")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")
    lines = response.text.strip().splitlines()
    assert len(lines) == 61  # header + 60 rows
    assert "mood_score" in lines[0]


def test_reset_source_removes_only_that_source(client, seeded_session):
    dataset_service.load_demo_dataset(seeded_session)
    response = client.request("DELETE", "/api/datasets/user")
    assert response.status_code == 200
    assert response.json()["removed"] == 60
    counts = dataset_service.count_by_source(seeded_session)
    assert counts[SOURCE_USER] == 0
    assert counts[SOURCE_DEMO] > 0


def test_filename_is_sanitised():
    assert dataset_service.safe_filename("../../etc/passwd") == "passwd"
    assert dataset_service.safe_filename("my data (1).csv") == "my_data_1_.csv"
    assert dataset_service.safe_filename("") == "upload.csv"
