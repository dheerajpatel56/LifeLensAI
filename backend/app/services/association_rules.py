"""Association-rule mining with a self-contained Apriori implementation.

Apriori is implemented directly rather than pulled from a library so the support,
confidence and lift arithmetic is inspectable and hand-verifiable in the test suite.

Definitions used throughout, with N = number of transactions (one per day):

    support(X)          = count(X) / N
    confidence(X -> Y)  = support(X ∪ Y) / support(X)
    lift(X -> Y)        = confidence(X -> Y) / support(Y)

Lift > 1 means X and Y co-occur more often than independence would predict. It is
not a causal statement.
"""

from __future__ import annotations

from itertools import combinations

import pandas as pd

from app.core.constants import FIELD_LABELS, MIN_RULES_ROWS
from app.db.schemas import AssociationRule, FrequentItemset, RulesResponse
from app.services.preprocessing import clean_frame

# Fixed, documented cut points. Chosen from everyday interpretation rather than
# from the data, so a rule means the same thing across datasets.
BIN_SPECS: dict[str, tuple[str, list[tuple[str, float, float]]]] = {
    "sleep_hours": (
        "Sleep",
        [("Short", -float("inf"), 6.0), ("Moderate", 6.0, 8.0), ("Long", 8.0, float("inf"))],
    ),
    "sleep_quality": (
        "Sleep quality",
        [("Poor", -float("inf"), 5.0), ("Fair", 5.0, 8.0), ("Good", 8.0, float("inf"))],
    ),
    "screen_time_hours": (
        "Screen time",
        [("Low", -float("inf"), 4.0), ("Moderate", 4.0, 7.0), ("High", 7.0, float("inf"))],
    ),
    "social_media_hours": (
        "Social media",
        [("Low", -float("inf"), 1.5), ("Moderate", 1.5, 3.0), ("High", 3.0, float("inf"))],
    ),
    "study_work_hours": (
        "Study/work",
        [("Light", -float("inf"), 4.0), ("Moderate", 4.0, 8.0), ("Heavy", 8.0, float("inf"))],
    ),
    "exercise_minutes": (
        "Exercise",
        [("None", -float("inf"), 10.0), ("Some", 10.0, 45.0), ("Plenty", 45.0, float("inf"))],
    ),
    "caffeine_servings": (
        "Caffeine",
        [("Low", -float("inf"), 2.0), ("Moderate", 2.0, 4.0), ("High", 4.0, float("inf"))],
    ),
    "stress_score": (
        "Stress",
        [("Low", -float("inf"), 4.0), ("Moderate", 4.0, 7.0), ("High", 7.0, float("inf"))],
    ),
    "mood_score": (
        "Mood",
        [("Low", -float("inf"), 5.0), ("Moderate", 5.0, 8.0), ("High", 8.0, float("inf"))],
    ),
    "productivity_score": (
        "Productivity",
        [("Low", -float("inf"), 5.0), ("Moderate", 5.0, 8.0), ("High", 8.0, float("inf"))],
    ),
}

DEFAULT_FIELDS = tuple(BIN_SPECS)

CAVEATS = [
    "Support, confidence and lift describe co-occurrence in this dataset. None of them establish cause.",
    "Continuous values are placed into fixed labelled bands before mining; a rule describes the band, not an exact value.",
    "Lift above 1 means the pair appeared together more often than chance would predict given each item's own frequency.",
    "Lowering the thresholds surfaces more rules, but rules that only hold on a handful of days are unreliable.",
]


def bin_definitions(fields: list[str]) -> dict[str, dict[str, str]]:
    """Human-readable description of every band used, for display in the UI."""
    definitions: dict[str, dict[str, str]] = {}
    for field in fields:
        if field not in BIN_SPECS:
            continue
        prefix, bands = BIN_SPECS[field]
        entries: dict[str, str] = {}
        for name, low, high in bands:
            if low == -float("inf"):
                text = f"below {high:g}"
            elif high == float("inf"):
                text = f"{low:g} and above"
            else:
                text = f"{low:g} to under {high:g}"
            entries[f"{prefix}: {name}"] = text
        definitions[FIELD_LABELS.get(field, field)] = entries
    return definitions


def _band(field: str, value: float) -> str | None:
    prefix, bands = BIN_SPECS[field]
    for name, low, high in bands:
        if low <= value < high:
            return f"{prefix}: {name}"
    return None


def build_transactions(frame: pd.DataFrame, fields: list[str] | None = None) -> tuple[list[frozenset[str]], list[str]]:
    """Discretise each row into a transaction (a set of labelled band items)."""
    cleaned, _ = clean_frame(frame)
    chosen = [
        field
        for field in (fields or DEFAULT_FIELDS)
        if field in BIN_SPECS and field in cleaned.columns
    ]
    usable = [field for field in chosen if cleaned[field].notna().any()]

    transactions: list[frozenset[str]] = []
    for _, row in cleaned.iterrows():
        items: set[str] = set()
        for field in usable:
            value = row.get(field)
            if pd.isna(value):
                continue
            item = _band(field, float(value))
            if item:
                items.add(item)
        if items:
            transactions.append(frozenset(items))
    return transactions, usable


def apriori(
    transactions: list[frozenset[str]], min_support: float, max_size: int
) -> dict[frozenset[str], int]:
    """Return every itemset with support >= min_support, as `itemset -> count`.

    Standard Apriori: generate candidates of size k from frequent (k-1)-itemsets,
    prune any candidate with an infrequent subset, then count.
    """
    total = len(transactions)
    if total == 0 or max_size < 1:
        return {}
    min_count = min_support * total

    counts: dict[frozenset[str], int] = {}
    singles: dict[frozenset[str], int] = {}
    for transaction in transactions:
        for item in transaction:
            key = frozenset((item,))
            singles[key] = singles.get(key, 0) + 1

    current = {k: v for k, v in singles.items() if v >= min_count}
    counts.update(current)

    size = 1
    while current and size < max_size:
        size += 1
        previous = sorted(current, key=lambda s: sorted(s))
        candidates: set[frozenset[str]] = set()
        for i in range(len(previous)):
            for j in range(i + 1, len(previous)):
                union = previous[i] | previous[j]
                if len(union) != size:
                    continue
                # Prune: every (size-1) subset must itself be frequent.
                if all(frozenset(sub) in current for sub in combinations(union, size - 1)):
                    candidates.add(union)

        if not candidates:
            break

        level_counts: dict[frozenset[str], int] = {}
        for transaction in transactions:
            for candidate in candidates:
                if candidate <= transaction:
                    level_counts[candidate] = level_counts.get(candidate, 0) + 1

        current = {k: v for k, v in level_counts.items() if v >= min_count}
        counts.update(current)

    return counts


def _rule_text(items: list[str]) -> str:
    return " + ".join(items)


def _interpretation(rule: AssociationRule, total: int) -> str:
    return (
        f"On the {rule.matching_transactions} of {total} day(s) with "
        f"{rule.antecedent_text.lower()}, {rule.consequent_text.lower()} also held "
        f"{rule.confidence * 100:.0f}% of the time. That is {rule.lift:.2f}x the rate expected "
        f"if the two were unrelated ({rule.consequent_support * 100:.0f}% baseline). "
        "Co-occurrence only — this does not show that one caused the other."
    )


def run_association_rules(
    frame: pd.DataFrame,
    min_support: float = 0.08,
    min_confidence: float = 0.5,
    min_lift: float = 1.0,
    max_antecedent_size: int = 2,
    fields: list[str] | None = None,
    source: str = "demo",
) -> RulesResponse:
    """Mine rules from discretised daily records. Never raises on thin data."""
    transactions, usable_fields = build_transactions(frame, fields)
    total = len(transactions)

    response = RulesResponse(
        available=False,
        message="",
        source=source,  # type: ignore[arg-type]
        transactions=total,
        min_support=min_support,
        min_confidence=min_confidence,
        min_lift=min_lift,
        bin_definitions=bin_definitions(usable_fields),
        frequent_itemsets=[],
        rules=[],
        caveats=CAVEATS,
    )

    if total < MIN_RULES_ROWS:
        response.message = (
            f"Association-rule mining needs at least {MIN_RULES_ROWS} usable days; "
            f"the current selection has {total}."
        )
        return response
    if len(usable_fields) < 2:
        response.message = (
            "Association-rule mining needs at least two lifestyle columns with values."
        )
        return response

    max_size = max_antecedent_size + 1
    counts = apriori(transactions, min_support, max_size)

    itemsets = [
        FrequentItemset(
            items=sorted(itemset),
            support=round(count / total, 4),
            count=count,
            size=len(itemset),
        )
        for itemset, count in counts.items()
    ]
    itemsets.sort(key=lambda entry: (entry.size, entry.support), reverse=True)
    response.frequent_itemsets = itemsets[:60]

    rules: list[AssociationRule] = []
    for itemset, count in counts.items():
        if len(itemset) < 2:
            continue
        support = count / total
        for size in range(1, len(itemset)):
            if size > max_antecedent_size:
                continue
            for antecedent_items in combinations(sorted(itemset), size):
                antecedent = frozenset(antecedent_items)
                consequent = itemset - antecedent
                if len(consequent) != 1:
                    # One-item consequents keep rules readable and interpretable.
                    continue
                antecedent_count = counts.get(antecedent)
                consequent_count = counts.get(consequent)
                if not antecedent_count or not consequent_count:
                    continue

                antecedent_support = antecedent_count / total
                consequent_support = consequent_count / total
                confidence = support / antecedent_support
                lift = confidence / consequent_support

                if confidence < min_confidence or lift < min_lift:
                    continue

                rule = AssociationRule(
                    antecedent=sorted(antecedent),
                    consequent=sorted(consequent),
                    antecedent_text=_rule_text(sorted(antecedent)),
                    consequent_text=_rule_text(sorted(consequent)),
                    support=round(support, 4),
                    confidence=round(confidence, 4),
                    lift=round(lift, 4),
                    antecedent_support=round(antecedent_support, 4),
                    consequent_support=round(consequent_support, 4),
                    transaction_count=total,
                    matching_transactions=antecedent_count,
                    interpretation="",
                )
                rule.interpretation = _interpretation(rule, total)
                rules.append(rule)

    rules.sort(key=lambda rule: (rule.lift, rule.confidence, rule.support), reverse=True)
    response.rules = rules[:80]
    response.available = True

    if not rules:
        response.message = (
            f"No rule met support >= {min_support:.0%}, confidence >= {min_confidence:.0%} "
            f"and lift >= {min_lift:.2f} across {total} days. Lower the thresholds to see weaker patterns."
        )
    else:
        response.message = (
            f"Found {len(rules)} rule(s) from {len(counts)} frequent itemset(s) over {total} days."
        )
    return response
