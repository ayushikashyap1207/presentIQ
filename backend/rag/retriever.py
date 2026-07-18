"""
RAG Pull Agent Retriever for PresentIQ
Inspects session metrics, identifies weak areas, and retrieves the most
relevant coaching knowledge chunks before the LLM call.
"""

from __future__ import annotations

from typing import Any

from backend.rag.indexer import get_collection

# ──────────────────────────────────────────────────────────────────────────────
# Pull Rules
# Maps metric key → (knowledge_source_filename_stem, threshold)
# threshold = None  → always include
# threshold > 0     → bad if value > threshold  (filler_words)
# threshold > 0     → bad if value < threshold  (everything else)
# ──────────────────────────────────────────────────────────────────────────────
PULL_RULES: dict[str, tuple[str, float | None]] = {
    "filler_words":       ("filler_words_research", 8),    # bad if > 8
    "wpm":                ("wpm_norms",             None),  # always relevant
    "pitch_variance":     ("speech_coaching",        40),   # bad if < 40
    "posture_score":      ("posture_eye_contact",    60),   # bad if < 60
    "eye_contact":        ("posture_eye_contact",    60),   # bad if < 60
    "volume_consistency": ("speech_coaching",        60),   # bad if < 60
    "head_stability":     ("body_language",          60),   # bad if < 60
}

# Maps PULL_RULES keys → MetricsBase field names
_METRIC_FIELD_MAP: dict[str, str] = {
    "filler_words":       "filler_words_count",
    "wpm":                "average_wpm",
    "pitch_variance":     "pitch_variance",
    "posture_score":      "posture_score",
    "eye_contact":        "eye_contact_percentage",
    "volume_consistency": "volume_consistency",
    "head_stability":     "head_stability_score",
}


# ──────────────────────────────────────────────────────────────────────────────
# Step 1 — Identify Weak Areas
# ──────────────────────────────────────────────────────────────────────────────

def identify_weak_areas(metrics: dict[str, Any]) -> list[str]:
    """
    Return the list of PULL_RULES metric names that failed their threshold.

    Rules:
    - wpm          → always included (threshold is None)
    - filler_words → fails if value > threshold
    - all others   → fails if value < threshold
    """
    weak: list[str] = []

    for rule_key, (_, threshold) in PULL_RULES.items():
        field = _METRIC_FIELD_MAP[rule_key]
        value = metrics.get(field)

        # Always include wpm
        if threshold is None:
            weak.append(rule_key)
            continue

        if value is None:
            continue

        if rule_key == "filler_words":
            if float(value) > threshold:
                weak.append(rule_key)
        else:
            if float(value) < threshold:
                weak.append(rule_key)

    return weak


# ──────────────────────────────────────────────────────────────────────────────
# Step 2 — Build Natural Language Query
# ──────────────────────────────────────────────────────────────────────────────

def build_query(metrics: dict[str, Any], weak_areas: list[str]) -> str:
    """
    Build a natural language query string describing the speaker's weak areas.
    Parts are joined with ' | '.
    """
    parts: list[str] = []

    for area in weak_areas:
        field = _METRIC_FIELD_MAP[area]
        value = metrics.get(field)

        if area == "filler_words":
            parts.append(f"reduce filler words, {int(value or 0)} fillers detected")

        elif area == "wpm":
            wpm = float(value or 0)
            if wpm > 180:
                parts.append(f"speech rate, speaking too fast at {round(wpm)} WPM")
            elif wpm < 110:
                parts.append(f"speech rate, speaking too slow at {round(wpm)} WPM")
            else:
                parts.append(f"speech rate at {round(wpm)} WPM, optimise pace and variation")

        elif area == "pitch_variance":
            parts.append(f"increase vocal variety and pitch range, current variance {round(float(value or 0), 1)}")

        elif area == "posture_score":
            parts.append(f"improve posture during presentation, score {round(float(value or 0))}%")

        elif area == "eye_contact":
            parts.append(f"improve eye contact with the camera, score {round(float(value or 0))}%")

        elif area == "volume_consistency":
            parts.append(f"improve volume consistency while speaking, score {round(float(value or 0))}%")

        elif area == "head_stability":
            parts.append(f"reduce excess head movement, stability score {round(float(value or 0))}%")

    return " | ".join(parts) if parts else "general presentation coaching techniques"


# ──────────────────────────────────────────────────────────────────────────────
# Step 3 — Build ChromaDB Source Filter
# ──────────────────────────────────────────────────────────────────────────────

def build_source_filter(weak_areas: list[str]) -> dict[str, Any] | None:
    """
    Build a ChromaDB where-filter restricting retrieval to sources relevant
    to the identified weak areas.

    Returns:
        {"source": "name"}                    if exactly 1 unique source
        {"source": {"$in": [...]}}            if multiple unique sources
        None                                  if no weak areas / no sources
    """
    sources: list[str] = []
    seen: set[str] = set()

    for area in weak_areas:
        source_stem, _ = PULL_RULES[area]
        filename = f"{source_stem}.md"
        if filename not in seen:
            seen.add(filename)
            sources.append(filename)

    if not sources:
        return None
    if len(sources) == 1:
        return {"source": sources[0]}
    return {"source": {"$in": sources}}


# ──────────────────────────────────────────────────────────────────────────────
# Step 4 — Maximal Marginal Relevance (MMR)
# ──────────────────────────────────────────────────────────────────────────────

def _jaccard(set_a: set[str], set_b: set[str]) -> float:
    """Jaccard similarity between two token sets."""
    if not set_a or not set_b:
        return 0.0
    intersection = len(set_a & set_b)
    union = len(set_a | set_b)
    return intersection / union if union else 0.0


def mmr(
    query: str,
    docs: list[str],
    k: int,
    lambda_mult: float = 0.6,
) -> list[str]:
    """
    Maximal Marginal Relevance re-ranking using token-level Jaccard similarity.

    Balances relevance to the query against redundancy among already-selected docs.

    Args:
        query:       The natural language query string.
        docs:        Candidate document chunks (ordered by initial relevance).
        k:           Number of chunks to return.
        lambda_mult: Trade-off weight. Higher → more relevance-focused.
                     Lower → more diversity-focused. Default 0.6.

    Returns:
        Up to k selected document strings.
    """
    if not docs:
        return []

    k = min(k, len(docs))
    query_tokens = set(query.lower().split())
    doc_token_sets = [set(doc.lower().split()) for doc in docs]

    selected_indices: list[int] = [0]           # Start with top-ranked doc
    remaining_indices: list[int] = list(range(1, len(docs)))

    while len(selected_indices) < k and remaining_indices:
        best_idx: int | None = None
        best_score: float = float("-inf")

        for idx in remaining_indices:
            relevance = _jaccard(query_tokens, doc_token_sets[idx])
            redundancy = max(
                _jaccard(doc_token_sets[idx], doc_token_sets[sel])
                for sel in selected_indices
            )
            score = lambda_mult * relevance - (1 - lambda_mult) * redundancy

            if score > best_score:
                best_score = score
                best_idx = idx

        if best_idx is not None:
            selected_indices.append(best_idx)
            remaining_indices.remove(best_idx)

    return [docs[i] for i in selected_indices]


# ──────────────────────────────────────────────────────────────────────────────
# Step 5 — Main Pull Function
# ──────────────────────────────────────────────────────────────────────────────

def pull_relevant_chunks(
    metrics: dict[str, Any],
    n_results: int = 6,
) -> list[str]:
    """
    Pull agent entry point. Given a metrics dict, returns the most relevant
    and diverse coaching knowledge chunks for the LLM context window.

    Pipeline:
        1. identify_weak_areas()   → find which metrics failed thresholds
        2. build_query()           → natural language retrieval query
        3. build_source_filter()   → restrict ChromaDB to relevant files
        4. Collection.query()      → over-fetch n_results * 2 candidates
        5. mmr()                   → re-rank for relevance + diversity
        6. Return final k chunks

    Args:
        metrics:   Dict of metric field names → values (matches MetricsBase fields).
        n_results: Number of chunks to return after MMR re-ranking.

    Returns:
        List of up to n_results chunk strings, ready to inject into LLM prompt.
    """
    # Step 1 — Identify weak areas
    weak_areas = identify_weak_areas(metrics)

    # Step 2 — Build retrieval query
    query = build_query(metrics, weak_areas)

    # Step 3 — Build source filter
    where_filter = build_source_filter(weak_areas)

    # Step 4 — Query ChromaDB (over-fetch for MMR diversity)
    collection = get_collection()
    fetch_count = n_results * 2

    query_kwargs: dict[str, Any] = {
        "query_texts": [query],
        "n_results": min(fetch_count, max(collection.count(), 1)),
        "include": ["documents"],
    }
    if where_filter is not None:
        query_kwargs["where"] = where_filter

    results = collection.query(**query_kwargs)

    candidate_docs: list[str] = []
    if results and results.get("documents"):
        candidate_docs = results["documents"][0]  # first (and only) query

    if not candidate_docs:
        return []

    # Step 5 — MMR re-ranking
    final_chunks = mmr(query, candidate_docs, k=n_results)

    return final_chunks
