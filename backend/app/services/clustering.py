"""K-Means lifestyle clustering with PCA projection.

Clustering here is *exploratory profiling*, not classification: there are no
ground-truth labels and no prediction. Cluster ids are arbitrary and can change
between runs; the descriptive labels are derived from each cluster's own observed
profile, never from its id.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.decomposition import PCA
from sklearn.metrics import silhouette_score
from sklearn.preprocessing import StandardScaler

from app.core.constants import (
    FIELD_LABELS,
    FIELD_UNITS,
    MIN_CLUSTERING_ROWS,
)
from app.db.schemas import (
    ClusterFeatureProfile,
    ClusterProfile,
    ClusterResponse,
    ProjectionPoint,
)
from app.services.preprocessing import prepare_feature_matrix

RANDOM_STATE = 42
N_INIT = 10

# A feature is called out in a cluster label only when it sits this far from the
# overall mean, measured in standard deviations.
NOTABLE_Z = 0.45

LIMITATIONS = [
    "K-Means is unsupervised: clusters are exploratory routine profiles, not diagnoses or predictions.",
    "Cluster numbers are arbitrary. Re-running with different data or a different cluster count can relabel everything.",
    "The 2D chart is a PCA projection. Points that look close in two dimensions may be far apart across all features.",
    "Features are standardised before clustering, so a cluster is defined by relative habits, not absolute units.",
]


def _label_for(profile: dict[str, float], z_scores: dict[str, float]) -> tuple[str, str]:
    """Derive a descriptive label and sentence from an observed cluster profile."""

    def z(field: str) -> float:
        return z_scores.get(field, 0.0)

    sleep = z("sleep_hours")
    quality = z("sleep_quality")
    screen = z("screen_time_hours")
    social = z("social_media_hours")
    work = z("study_work_hours")
    exercise = z("exercise_minutes")
    stress = z("stress_score")
    mood = z("mood_score")
    productivity = z("productivity_score")

    # Ordered rules: the first matching archetype wins.
    if sleep >= NOTABLE_Z and exercise >= NOTABLE_Z and stress <= -NOTABLE_Z * 0.6:
        label = "Active and Rested"
    elif (screen >= NOTABLE_Z or social >= NOTABLE_Z) and sleep <= -NOTABLE_Z:
        label = "Digital Night Owl"
    elif work >= NOTABLE_Z and stress >= NOTABLE_Z:
        label = "High-Stress Achiever"
    elif stress >= NOTABLE_Z and productivity <= -NOTABLE_Z:
        label = "Strained and Stalled"
    elif abs(sleep) < NOTABLE_Z and abs(screen) < NOTABLE_Z and abs(stress) < NOTABLE_Z:
        label = "Balanced Routine"
    elif quality <= -NOTABLE_Z and abs(sleep) >= NOTABLE_Z * 0.5:
        label = "Inconsistent Schedule"
    elif mood >= NOTABLE_Z and productivity >= NOTABLE_Z:
        label = "Steady and Focused"
    elif exercise >= NOTABLE_Z:
        label = "Movement-Led Days"
    elif screen >= NOTABLE_Z:
        label = "Screen-Heavy Days"
    else:
        label = "Mixed Routine"

    notable = sorted(z_scores.items(), key=lambda item: abs(item[1]), reverse=True)
    phrases: list[str] = []
    for field, score in notable[:3]:
        if abs(score) < NOTABLE_Z:
            continue
        direction = "higher" if score > 0 else "lower"
        unit = FIELD_UNITS.get(field, "")
        # "/10" reads as part of the number; word units need a space before them.
        suffix = unit if unit.startswith("/") else f" {unit}".rstrip()
        value = profile.get(field)
        phrases.append(
            f"{FIELD_LABELS.get(field, field).lower()} {direction} than average "
            f"({value:.1f}{suffix})"
        )

    if phrases:
        description = "Days in this group show " + ", ".join(phrases) + "."
    else:
        description = "Days in this group sit close to the dataset average on every feature."
    return label, description


def _ensure_unique_labels(labels: list[str]) -> list[str]:
    """Suffix duplicates so two clusters never present the same name."""
    seen: dict[str, int] = {}
    result: list[str] = []
    for label in labels:
        seen[label] = seen.get(label, 0) + 1
        result.append(label if seen[label] == 1 else f"{label} ({seen[label]})")
    return result


def run_clustering(
    frame: pd.DataFrame,
    n_clusters: int = 4,
    features: list[str] | None = None,
    source: str = "demo",
) -> ClusterResponse:
    """Standardise, cluster, score and project. Never raises on thin data."""
    requested = n_clusters
    empty = ClusterResponse(
        available=False,
        message="",
        source=source,  # type: ignore[arg-type]
        n_clusters=0,
        requested_clusters=requested,
        rows_used=0,
        rows_dropped=0,
        features_used=[],
        silhouette_score=None,
        silhouette_available=False,
        inertia=None,
        profiles=[],
        projection=[],
        projection_explained_variance=[],
        limitations=LIMITATIONS,
    )

    matrix, selected, summary = prepare_feature_matrix(frame, features)
    if matrix.empty or not selected:
        empty.message = (
            "Clustering needs at least two numeric lifestyle columns with variation. "
            "The active dataset does not provide them yet."
        )
        return empty

    feature_frame = matrix[selected]
    rows = len(feature_frame)
    if rows < MIN_CLUSTERING_ROWS:
        empty.rows_used = rows
        empty.features_used = selected
        empty.message = (
            f"Clustering needs at least {MIN_CLUSTERING_ROWS} complete records; "
            f"the current selection has {rows}. Add more check-ins or widen the date range."
        )
        return empty

    if len(selected) < 2:
        empty.rows_used = rows
        empty.features_used = selected
        empty.message = (
            "Clustering needs at least two features with variation. "
            "Only one usable column was found."
        )
        return empty

    distinct = int(feature_frame.drop_duplicates().shape[0])
    effective_clusters = max(2, min(requested, distinct, rows))
    if effective_clusters != requested:
        note = (
            f"Requested {requested} clusters but the data supports {effective_clusters} "
            f"({distinct} distinct observations across {rows} rows)."
        )
        summary.notes.append(note)

    values = feature_frame.to_numpy(dtype=float)
    scaler = StandardScaler()
    scaled = scaler.fit_transform(values)

    model = KMeans(
        n_clusters=effective_clusters,
        random_state=RANDOM_STATE,
        n_init=N_INIT,
    )
    assignments = model.fit_predict(scaled)

    # Silhouette is only defined for 2..n-1 distinct labels with >= 2 samples each.
    unique_labels = np.unique(assignments)
    silhouette: float | None = None
    silhouette_available = False
    if 2 <= len(unique_labels) < rows and distinct > len(unique_labels):
        try:
            silhouette = float(silhouette_score(scaled, assignments))
            silhouette_available = True
        except ValueError:
            silhouette = None

    overall_mean = feature_frame.mean()
    overall_std = feature_frame.std(ddof=0).replace(0.0, np.nan)

    raw_labels: list[str] = []
    descriptions: list[str] = []
    per_cluster_features: list[list[ClusterFeatureProfile]] = []
    sizes: list[int] = []

    for cluster_id in range(effective_clusters):
        mask = assignments == cluster_id
        size = int(mask.sum())
        sizes.append(size)
        if size == 0:
            raw_labels.append("Empty Group")
            descriptions.append("No records were assigned to this group.")
            per_cluster_features.append([])
            continue

        cluster_rows = feature_frame[mask]
        means = cluster_rows.mean()
        medians = cluster_rows.median()
        z_scores = ((means - overall_mean) / overall_std).fillna(0.0)

        profiles: list[ClusterFeatureProfile] = []
        for featname in selected:
            z_value = float(z_scores[featname])
            if z_value >= NOTABLE_Z:
                direction = "above"
            elif z_value <= -NOTABLE_Z:
                direction = "below"
            else:
                direction = "typical"
            profiles.append(
                ClusterFeatureProfile(
                    field=featname,
                    label=FIELD_LABELS.get(featname, featname),
                    unit=FIELD_UNITS.get(featname),
                    mean=round(float(means[featname]), 2),
                    median=round(float(medians[featname]), 2),
                    overall_mean=round(float(overall_mean[featname]), 2),
                    z_score=round(z_value, 2),
                    direction=direction,  # type: ignore[arg-type]
                )
            )

        label, description = _label_for(
            {k: float(means[k]) for k in selected},
            {k: float(z_scores[k]) for k in selected},
        )
        raw_labels.append(label)
        descriptions.append(description)
        per_cluster_features.append(profiles)

    labels = _ensure_unique_labels(raw_labels)
    cluster_profiles = [
        ClusterProfile(
            cluster_id=cluster_id,
            label=labels[cluster_id],
            description=descriptions[cluster_id],
            size=sizes[cluster_id],
            share=round(sizes[cluster_id] / rows, 4),
            features=per_cluster_features[cluster_id],
        )
        for cluster_id in range(effective_clusters)
    ]

    # PCA projection for the 2D chart.
    projection: list[ProjectionPoint] = []
    explained: list[float] = []
    if scaled.shape[1] >= 2 and rows >= 3:
        components = PCA(n_components=2, random_state=RANDOM_STATE)
        coords = components.fit_transform(scaled)
        explained = [round(float(v), 4) for v in components.explained_variance_ratio_]
        dates = matrix["date"] if "date" in matrix.columns else None
        for position in range(rows):
            point_date = None
            if dates is not None:
                raw_date = dates.iloc[position]
                point_date = None if pd.isna(raw_date) else pd.Timestamp(raw_date).date()
            projection.append(
                ProjectionPoint(
                    x=round(float(coords[position, 0]), 4),
                    y=round(float(coords[position, 1]), 4),
                    cluster_id=int(assignments[position]),
                    date=point_date,
                )
            )

    message = f"Found {effective_clusters} routine groups across {rows} records."
    if summary.notes:
        message += " " + " ".join(summary.notes)

    return ClusterResponse(
        available=True,
        message=message,
        source=source,  # type: ignore[arg-type]
        n_clusters=effective_clusters,
        requested_clusters=requested,
        rows_used=rows,
        rows_dropped=summary.rows_dropped,
        features_used=selected,
        silhouette_score=None if silhouette is None else round(silhouette, 4),
        silhouette_available=silhouette_available,
        inertia=round(float(model.inertia_), 3),
        profiles=cluster_profiles,
        projection=projection,
        projection_explained_variance=explained,
        limitations=LIMITATIONS,
    )
