"""Test fixtures.

Each test module gets its own throwaway SQLite file, so tests never touch the
developer's `lifelens.db` and never depend on each other's data or on the network.
"""

from __future__ import annotations

from collections.abc import Iterator
from datetime import date, timedelta

import pandas as pd
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.constants import SOURCE_USER
from app.db.database import Base, get_db
from app.db.models import CheckIn
from app.main import app


@pytest.fixture()
def db_session(tmp_path) -> Iterator[Session]:
    engine = create_engine(
        f"sqlite:///{(tmp_path / 'test.db').as_posix()}",
        connect_args={"check_same_thread": False},
        future=True,
    )
    Base.metadata.create_all(bind=engine)
    factory = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
    session = factory()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


@pytest.fixture()
def client(db_session: Session) -> Iterator[TestClient]:
    """A TestClient wired to the throwaway session, with no startup seeding."""

    def override_get_db() -> Iterator[Session]:
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    # TestClient is constructed without the context manager so the lifespan hook
    # (which seeds demo data into the real database) does not run.
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture()
def valid_payload() -> dict[str, object]:
    return {
        "date": "2024-03-01",
        "sleep_hours": 7.5,
        "sleep_quality": 8,
        "screen_time_hours": 5.0,
        "social_media_hours": 1.5,
        "study_work_hours": 6.0,
        "exercise_minutes": 30,
        "caffeine_servings": 2,
        "stress_score": 4,
        "mood_score": 7,
        "productivity_score": 8,
        "notes": "Good day.",
    }


def make_records(count: int, start: date = date(2024, 1, 1)) -> list[CheckIn]:
    """Deterministic records with a known monotonic sleep/productivity relationship."""
    records: list[CheckIn] = []
    for index in range(count):
        sleep = 5.0 + (index % 5)
        records.append(
            CheckIn(
                source=SOURCE_USER,
                date=start + timedelta(days=index),
                sleep_hours=sleep,
                sleep_quality=min(10, 4 + (index % 5)),
                screen_time_hours=9.0 - (index % 5),
                social_media_hours=min(9.0 - (index % 5), 3.0),
                study_work_hours=5.0,
                exercise_minutes=10.0 * (index % 5),
                caffeine_servings=float(4 - (index % 5) // 2),
                stress_score=max(1, 8 - (index % 5)),
                mood_score=min(10, max(1, 4 + (index % 5))),
                productivity_score=min(10, max(1, 3 + (index % 5) + (index % 2))),
                notes=None,
            )
        )
    return records


@pytest.fixture()
def seeded_session(db_session: Session) -> Session:
    db_session.add_all(make_records(60))
    db_session.commit()
    return db_session


@pytest.fixture()
def small_frame() -> pd.DataFrame:
    """A hand-checkable 8-row frame used for correlation and rule arithmetic."""
    return pd.DataFrame(
        {
            "date": pd.date_range("2024-01-01", periods=8, freq="D"),
            "sleep_hours": [5.0, 5.5, 6.0, 6.5, 7.0, 7.5, 8.0, 8.5],
            "productivity_score": [3, 4, 4, 5, 6, 7, 8, 9],
            "stress_score": [9, 8, 8, 6, 5, 4, 3, 2],
            "mood_score": [3, 3, 4, 5, 6, 7, 8, 9],
        }
    )
