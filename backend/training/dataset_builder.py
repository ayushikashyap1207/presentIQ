"""
PresentIQ Training Dataset Builder
====================================
Exports positively-rated session data into OpenAI fine-tuning JSONL format.

Run as a module from the project root:
    python -m backend.training.dataset_builder

The script:
1. Connects to the existing SQLAlchemy database
2. Queries sessions joined with feedback (status = 'feedback_ready')
3. Filters for high-quality examples (rating >= 4, or all if no rating column yet)
4. Re-runs the RAG retriever for each session to build context identical to inference
5. Assembles messages[] in OpenAI fine-tuning format
6. Writes one JSON line per pair to backend/training/data/training_pairs.jsonl
7. Prints a summary and stats report

NOTE on rating column:
  The current Feedback model does not yet have a `rating` column.
  When it is added (migration required), update the RATING_THRESHOLD
  filter in _query_sessions() from the status-based proxy to:
      .filter(Feedback.rating >= RATING_THRESHOLD)
"""

from __future__ import annotations

import json
import pathlib
import sys
import textwrap
from collections import Counter
from datetime import datetime
from typing import Any

# ── Ensure the backend package root is on sys.path when run as __main__ ──────
_BACKEND_DIR = pathlib.Path(__file__).resolve().parents[1]
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))

from sqlalchemy.orm import Session as DBSession

from database.connection import SessionLocal
from database.models import Feedback, Metrics, Session as SessionModel
from backend.rag.retriever import pull_relevant_chunks

# ─────────────────────────────────────────────────────────────────────────────
# Configuration
# ─────────────────────────────────────────────────────────────────────────────
RATING_THRESHOLD: int = 4          # Include sessions with rating >= this value
OUTPUT_DIR  = pathlib.Path(__file__).parent / "data"
OUTPUT_FILE = OUTPUT_DIR / "training_pairs.jsonl"

SYSTEM_PROMPT = (
    "You are an expert presentation coach with access to evidence-based "
    "coaching research. Use the provided knowledge to give specific, "
    "grounded feedback. Reference techniques by name. Be direct and "
    "actionable. Return ONLY valid JSON."
)


# ─────────────────────────────────────────────────────────────────────────────
# Database helpers
# ─────────────────────────────────────────────────────────────────────────────

def _get_db() -> DBSession:
    """Return a synchronous SQLAlchemy session."""
    return SessionLocal()


def _query_sessions(db: DBSession) -> list[SessionModel]:
    """
    Return sessions that have both metrics and feedback and are in
    'feedback_ready' status (proxy for rating >= 4 until the rating
    column is added via migration).

    Once Feedback.rating is added, replace the status filter with:
        .filter(Feedback.rating >= RATING_THRESHOLD)
    """
    return (
        db.query(SessionModel)
        .join(Feedback, Feedback.session_id == SessionModel.id)
        .join(Metrics, Metrics.session_id == SessionModel.id)
        .filter(SessionModel.status == "feedback_ready")
        .filter(SessionModel.transcript_text.isnot(None))
        .all()
    )


# ─────────────────────────────────────────────────────────────────────────────
# Metrics → dict helper
# ─────────────────────────────────────────────────────────────────────────────

def _metrics_to_dict(m: Metrics) -> dict[str, Any]:
    """Convert a Metrics ORM row to the flat dict expected by the retriever."""
    return {
        "eye_contact_percentage": m.eye_contact_percentage,
        "posture_score":          m.posture_score,
        "head_stability_score":   m.head_stability_score,
        "fidget_score":           m.fidget_score,
        "pitch_variance":         m.pitch_variance,
        "pitch_label":            m.pitch_label,
        "volume_consistency":     m.volume_consistency,
        "average_wpm":            m.average_wpm,
        "filler_words_count":     m.filler_words_count,
        "pauses_count":           m.pauses_count,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Feedback → JSON string helper
# ─────────────────────────────────────────────────────────────────────────────

def _feedback_to_json(fb: Feedback) -> str:
    """Serialise a Feedback ORM row to a compact JSON string (assistant turn)."""
    payload = {
        "strengths":       fb.strengths       or [],
        "improvements":    fb.areas_to_improve or [],
        "priority_action": fb.summary          or "",
        "retrieved_sources": fb.suggestions   or [],
    }
    return json.dumps(payload, ensure_ascii=False)


# ─────────────────────────────────────────────────────────────────────────────
# Core export logic
# ─────────────────────────────────────────────────────────────────────────────

def build_training_pairs() -> dict[str, Any]:
    """
    Main export function.  Returns a stats dict:
        total_scanned, pairs_exported, skipped, source_counter, weak_counter
    """
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    db = _get_db()
    try:
        sessions = _query_sessions(db)
    finally:
        db.close()

    total_scanned  = len(sessions)
    pairs_exported = 0
    skipped        = 0
    source_counter: Counter = Counter()
    weak_counter:   Counter = Counter()

    with OUTPUT_FILE.open("w", encoding="utf-8") as fout:
        for session in sessions:
            try:
                metrics_row = session.metrics
                feedback_row = session.feedback

                # Guard: skip if either relation is missing
                if metrics_row is None or feedback_row is None:
                    skipped += 1
                    continue

                metrics_dict = _metrics_to_dict(metrics_row)
                transcript   = (session.transcript_text or "").strip()

                # ── Re-run RAG retriever (same pipeline as inference) ──────
                chunks = pull_relevant_chunks(metrics_dict, n_results=6)
                context = "\n\n---\n\n".join(chunks)

                # Track which sources were retrieved
                for chunk in chunks:
                    # Chunk strings don't carry metadata here; track via
                    # weak area → source mapping from retriever module
                    pass

                from backend.rag.retriever import (
                    identify_weak_areas,
                    build_source_filter,
                    PULL_RULES,
                    _METRIC_FIELD_MAP,
                )
                weak_areas = identify_weak_areas(metrics_dict)
                for area in weak_areas:
                    weak_counter[area] += 1
                    source_stem, _ = PULL_RULES[area]
                    source_counter[f"{source_stem}.md"] += 1

                # ── Build fine-tuning messages array ──────────────────────
                user_content = textwrap.dedent(f"""\
                    COACHING KNOWLEDGE (use this to ground your feedback):
                    {context}

                    SESSION METRICS:
                    {json.dumps(metrics_dict, indent=2)}

                    TRANSCRIPT (first 1000 chars):
                    {transcript[:1000]}

                    Return JSON with exactly these keys:
                    - strengths: list of 2-3 things done well, citing specific metrics
                    - improvements: list of 2-3 areas with named techniques from the knowledge above
                    - priority_action: single most impactful change, with a specific drill
                    - retrieved_sources: list of source names used from coaching knowledge
                """)

                assistant_content = _feedback_to_json(feedback_row)

                record = {
                    "messages": [
                        {"role": "system",    "content": SYSTEM_PROMPT},
                        {"role": "user",      "content": user_content},
                        {"role": "assistant", "content": assistant_content},
                    ],
                    # Metadata (ignored by fine-tuning, useful for auditing)
                    "_meta": {
                        "session_id":  session.id,
                        "exported_at": datetime.utcnow().isoformat(),
                    },
                }

                fout.write(json.dumps(record, ensure_ascii=False) + "\n")
                pairs_exported += 1

            except Exception as exc:  # noqa: BLE001
                print(f"  [WARN] Skipping session {session.id}: {exc}")
                skipped += 1

    return {
        "total_scanned":  total_scanned,
        "pairs_exported": pairs_exported,
        "skipped":        skipped,
        "source_counter": source_counter,
        "weak_counter":   weak_counter,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Stats reporter
# ─────────────────────────────────────────────────────────────────────────────

def export_stats(stats: dict[str, Any] | None = None) -> None:
    """
    Print a human-readable stats report.

    If `stats` is None, reads training_pairs.jsonl from disk and recomputes.
    """
    if stats is None:
        # Recompute from file
        if not OUTPUT_FILE.exists():
            print("[Stats] No training_pairs.jsonl found. Run build_training_pairs() first.")
            return

        total_pairs    = 0
        source_counter: Counter = Counter()
        weak_counter:   Counter = Counter()

        with OUTPUT_FILE.open(encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    record = json.loads(line)
                    total_pairs += 1
                    meta = record.get("_meta", {})
                except json.JSONDecodeError:
                    continue

        stats = {
            "pairs_exported": total_pairs,
            "source_counter": source_counter,
            "weak_counter":   weak_counter,
        }

    sep = "─" * 60
    print(f"\n{sep}")
    print("  PresentIQ Training Dataset — Export Stats")
    print(sep)
    print(f"  Total sessions scanned : {stats.get('total_scanned', 'n/a')}")
    print(f"  Pairs exported         : {stats['pairs_exported']}")
    print(f"  Skipped (errors/missing): {stats.get('skipped', 'n/a')}")
    print(f"  Rating threshold        : >= {RATING_THRESHOLD} (status proxy)")
    print(f"  Output file             : {OUTPUT_FILE}")

    print(f"\n  Most common weak metrics:")
    if stats["weak_counter"]:
        for metric, count in stats["weak_counter"].most_common(5):
            bar = "█" * min(count, 30)
            print(f"    {metric:<22} {bar} ({count})")
    else:
        print("    (no data)")

    print(f"\n  Knowledge source retrieval distribution:")
    if stats["source_counter"]:
        total_retrievals = sum(stats["source_counter"].values())
        for source, count in stats["source_counter"].most_common():
            pct = count / total_retrievals * 100 if total_retrievals else 0
            bar = "█" * min(int(pct / 2), 30)
            print(f"    {source:<35} {bar} {pct:.1f}%")
    else:
        print("    (no data)")

    print(sep + "\n")


# ─────────────────────────────────────────────────────────────────────────────
# CLI entry point
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print(f"[DatasetBuilder] Starting export — {datetime.utcnow().isoformat()} UTC")
    print(f"[DatasetBuilder] Database  : {_BACKEND_DIR / 'presentiq.db'}")
    print(f"[DatasetBuilder] Output    : {OUTPUT_FILE}")
    print(f"[DatasetBuilder] Threshold : feedback_ready sessions (rating >= {RATING_THRESHOLD} proxy)\n")

    stats = build_training_pairs()

    print(f"\n[DatasetBuilder] Done.")
    print(f"  Scanned  : {stats['total_scanned']} sessions")
    print(f"  Exported : {stats['pairs_exported']} training pairs")
    print(f"  Skipped  : {stats['skipped']} sessions")

    export_stats(stats)
