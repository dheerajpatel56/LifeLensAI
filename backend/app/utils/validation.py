"""Row- and column-level validation shared by CSV import and preprocessing."""

from __future__ import annotations

import math
import re
from datetime import date, datetime
from typing import Any

from app.core.constants import (
    COLUMN_ALIASES,
    FIELD_RANGES,
    INTEGER_SCALE_FIELDS,
    MAX_NOTES_LENGTH,
    NUMERIC_FIELDS,
    REQUIRED_FIELDS,
)

_NON_ALNUM = re.compile(r"[^a-z0-9]+")

_DATE_FORMATS = (
    "%Y-%m-%d",
    "%d-%m-%Y",
    "%d/%m/%Y",
    "%m/%d/%Y",
    "%Y/%m/%d",
    "%d %b %Y",
    "%d %B %Y",
)


def normalise_header(header: str) -> str:
    """Lower-case a CSV header and strip everything that is not alphanumeric."""
    return _NON_ALNUM.sub("", str(header).strip().lower())


def map_columns(headers: list[str]) -> tuple[dict[str, str], list[str]]:
    """Map raw CSV headers onto canonical field names.

    Returns `(mapping, unmapped)` where `mapping` is raw header -> canonical name.
    A canonical name is claimed by the first header that matches it, so a file
    containing both `sleep` and `sleep_hours` will not silently overwrite itself.
    """
    mapping: dict[str, str] = {}
    unmapped: list[str] = []
    claimed: set[str] = set()

    for header in headers:
        canonical = COLUMN_ALIASES.get(normalise_header(header))
        if canonical and canonical not in claimed:
            mapping[header] = canonical
            claimed.add(canonical)
        else:
            unmapped.append(header)
    return mapping, unmapped


def missing_required_columns(canonical_columns: set[str]) -> list[str]:
    return [field for field in REQUIRED_FIELDS if field not in canonical_columns]


def is_blank(value: Any) -> bool:
    if value is None:
        return True
    if isinstance(value, float) and math.isnan(value):
        return True
    return str(value).strip() == "" or str(value).strip().lower() in {"na", "n/a", "nan", "null", "-"}


def parse_date(value: Any) -> date:
    """Parse a date from the formats a student spreadsheet realistically contains."""
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value

    text = str(value).strip()
    if not text:
        raise ValueError("date is empty")
    # Trim a time component if one is present.
    text = text.split("T")[0].split(" ")[0] if "T" in text or ":" in text else text

    for fmt in _DATE_FORMATS:
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    raise ValueError(f"'{value}' is not a recognised date (expected e.g. 2024-03-18)")


def parse_number(field: str, value: Any) -> float:
    """Parse and range-check one numeric field. Raises ValueError with a clear message."""
    text = str(value).strip().replace(",", "")
    try:
        number = float(text)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"'{value}' is not a number") from exc

    if math.isnan(number) or math.isinf(number):
        raise ValueError("value must be a finite number")

    low, high = FIELD_RANGES[field]
    if number < low or number > high:
        raise ValueError(f"value {number:g} is outside the valid range {low:g}-{high:g}")

    if field in INTEGER_SCALE_FIELDS:
        rounded = round(number)
        if abs(number - rounded) > 1e-9:
            raise ValueError(f"value must be a whole number from {int(low)} to {int(high)}")
        return float(rounded)
    return number


def validate_notes(value: Any) -> str | None:
    if is_blank(value):
        return None
    text = str(value).strip()
    if len(text) > MAX_NOTES_LENGTH:
        raise ValueError(f"notes exceed the {MAX_NOTES_LENGTH} character limit")
    return text


def cross_field_errors(record: dict[str, Any]) -> list[tuple[str, str]]:
    """Checks that involve more than one field. Returns `(field, message)` pairs."""
    errors: list[tuple[str, str]] = []
    social = record.get("social_media_hours")
    screen = record.get("screen_time_hours")
    if social is not None and screen is not None and social > screen + 1e-9:
        errors.append(
            (
                "social_media_hours",
                f"social media ({social:g} h) cannot exceed screen time ({screen:g} h)",
            )
        )

    sleep = record.get("sleep_hours")
    work = record.get("study_work_hours")
    if sleep is not None and work is not None and sleep + work > 24 + 1e-9:
        errors.append(
            ("study_work_hours", f"sleep ({sleep:g} h) plus study/work ({work:g} h) exceeds 24 h")
        )
    return errors


def numeric_fields_present(columns: set[str]) -> list[str]:
    return [field for field in NUMERIC_FIELDS if field in columns]
