"""ORM models.

Records from the demo dataset, the user's own check-ins and imported CSVs all
live in one table but are kept logically separate by the `source` column. Date
uniqueness is enforced *per source*, so loading demo data can never collide with
a check-in the user typed.
"""

from __future__ import annotations

from datetime import date as date_type
from datetime import datetime, timezone

from sqlalchemy import (
    Date,
    DateTime,
    Float,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.constants import SOURCE_USER
from app.db.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class CheckIn(Base):
    """A single day of lifestyle data."""

    __tablename__ = "checkins"
    __table_args__ = (
        UniqueConstraint("source", "date", name="uq_checkin_source_date"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    source: Mapped[str] = mapped_column(String(16), default=SOURCE_USER, index=True, nullable=False)
    date: Mapped[date_type] = mapped_column(Date, nullable=False, index=True)

    sleep_hours: Mapped[float | None] = mapped_column(Float, nullable=True)
    sleep_quality: Mapped[int | None] = mapped_column(Integer, nullable=True)
    screen_time_hours: Mapped[float | None] = mapped_column(Float, nullable=True)
    social_media_hours: Mapped[float | None] = mapped_column(Float, nullable=True)
    study_work_hours: Mapped[float | None] = mapped_column(Float, nullable=True)
    exercise_minutes: Mapped[float | None] = mapped_column(Float, nullable=True)
    caffeine_servings: Mapped[float | None] = mapped_column(Float, nullable=True)
    stress_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    mood_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    productivity_score: Mapped[int | None] = mapped_column(Integer, nullable=True)

    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=_utcnow,
        onupdate=_utcnow,
        server_default=func.now(),
        nullable=False,
    )

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"<CheckIn id={self.id} source={self.source} date={self.date}>"


class AppState(Base):
    """Tiny key/value table. Currently holds the active dataset selection."""

    __tablename__ = "app_state"

    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    value: Mapped[str] = mapped_column(String(255), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False
    )


class ImportBatch(Base):
    """Provenance for each accepted CSV import."""

    __tablename__ = "import_batches"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    stored_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    rows_accepted: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    rows_rejected: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, nullable=False
    )
