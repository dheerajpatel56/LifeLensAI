"""CRUD for the user's own daily check-ins.

Check-ins always belong to the `user` source. Writing here never touches demo or
imported records, and the date-uniqueness conflict is reported with the id of the
existing record so the UI can offer to edit it instead.
"""

from __future__ import annotations

from datetime import date as date_type

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.constants import SOURCE_USER
from app.db.database import get_db
from app.db.models import CheckIn
from app.db.schemas import CheckInCreate, CheckInOut, CheckInPage, CheckInUpdate
from app.services import dataset_service

router = APIRouter(prefix="/api/checkins", tags=["check-ins"])


def _existing_on_date(db: Session, day: date_type, exclude_id: int | None = None) -> CheckIn | None:
    statement = select(CheckIn).where(CheckIn.source == SOURCE_USER, CheckIn.date == day)
    if exclude_id is not None:
        statement = statement.where(CheckIn.id != exclude_id)
    return db.execute(statement).scalars().first()


@router.get("", response_model=CheckInPage)
def list_checkins(
    db: Session = Depends(get_db),
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    start: date_type | None = Query(default=None),
    end: date_type | None = Query(default=None),
    order: str = Query(default="desc", pattern="^(asc|desc)$"),
) -> CheckInPage:
    if start and end and start > end:
        raise HTTPException(status_code=422, detail="start date must be on or before end date")

    base = select(CheckIn).where(CheckIn.source == SOURCE_USER)
    counter = select(func.count(CheckIn.id)).where(CheckIn.source == SOURCE_USER)
    if start:
        base = base.where(CheckIn.date >= start)
        counter = counter.where(CheckIn.date >= start)
    if end:
        base = base.where(CheckIn.date <= end)
        counter = counter.where(CheckIn.date <= end)

    ordering = CheckIn.date.desc() if order == "desc" else CheckIn.date.asc()
    rows = db.execute(base.order_by(ordering).limit(limit).offset(offset)).scalars().all()
    total = int(db.execute(counter).scalar_one())

    return CheckInPage(
        items=[CheckInOut.model_validate(row) for row in rows],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.post("", response_model=CheckInOut, status_code=status.HTTP_201_CREATED)
def create_checkin(payload: CheckInCreate, db: Session = Depends(get_db)) -> CheckInOut:
    clash = _existing_on_date(db, payload.date)
    if clash:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"A check-in for {payload.date.isoformat()} already exists (id {clash.id}). "
                "Edit that record instead of creating a second one for the same day."
            ),
        )

    record = CheckIn(source=SOURCE_USER, **payload.model_dump())
    db.add(record)
    db.commit()
    db.refresh(record)
    return CheckInOut.model_validate(record)


@router.get("/{checkin_id}", response_model=CheckInOut)
def get_checkin(checkin_id: int, db: Session = Depends(get_db)) -> CheckInOut:
    record = db.get(CheckIn, checkin_id)
    if not record or record.source != SOURCE_USER:
        raise HTTPException(status_code=404, detail=f"No check-in with id {checkin_id}")
    return CheckInOut.model_validate(record)


@router.put("/{checkin_id}", response_model=CheckInOut)
def update_checkin(
    checkin_id: int, payload: CheckInUpdate, db: Session = Depends(get_db)
) -> CheckInOut:
    record = db.get(CheckIn, checkin_id)
    if not record or record.source != SOURCE_USER:
        raise HTTPException(status_code=404, detail=f"No check-in with id {checkin_id}")

    clash = _existing_on_date(db, payload.date, exclude_id=checkin_id)
    if clash:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Another check-in already uses {payload.date.isoformat()} (id {clash.id})."
            ),
        )

    for field, value in payload.model_dump().items():
        setattr(record, field, value)
    db.commit()
    db.refresh(record)
    return CheckInOut.model_validate(record)


@router.delete(
    "/{checkin_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
def delete_checkin(checkin_id: int, db: Session = Depends(get_db)) -> Response:
    record = db.get(CheckIn, checkin_id)
    if not record or record.source != SOURCE_USER:
        raise HTTPException(status_code=404, detail=f"No check-in with id {checkin_id}")
    db.delete(record)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/by-date/{day}", response_model=CheckInOut)
def get_checkin_by_date(day: date_type, db: Session = Depends(get_db)) -> CheckInOut:
    """Used by the form to detect a duplicate date before the user submits."""
    record = _existing_on_date(db, day)
    if not record:
        raise HTTPException(status_code=404, detail=f"No check-in recorded for {day.isoformat()}")
    return CheckInOut.model_validate(record)


@router.post("/activate", response_model=dict)
def activate_user_dataset(db: Session = Depends(get_db)) -> dict[str, str]:
    """Convenience: make the user's own check-ins the active dataset."""
    dataset_service.set_active_source(db, SOURCE_USER)
    return {"source": SOURCE_USER, "message": "Your check-ins are now the active dataset."}
