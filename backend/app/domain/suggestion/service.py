"""AI-driven anchor suggestion and first-week scaffolding (1G.1)."""

from datetime import UTC, date, datetime
from typing import Any


def pick_next_anchor(state: dict[str, Any]) -> dict[str, Any]:
    """
    Choose the best next module for the user given their current state.

    Priority order:
      1. High emotional load → Calm first
      2. Comeback after gap → low-stakes win (Word Gym)
      3. Low energy → activating warm-up (Word Gym)
      4. Default → Focus Engine
    """
    emotional_load: int = state.get("emotional_load", 2)
    energy_level: int = state.get("energy_level", 3)
    comeback: bool = state.get("comeback_bonus_active", False)

    if emotional_load >= 4:
        return {
            "action": "calm",
            "label": "Breathe first, then focus",
            "route": "/calm",
            "duration": "5 min",
            "reason": "Your system needs a moment to settle.",
        }

    if comeback:
        return {
            "action": "games",
            "label": "Easy win to rebuild momentum",
            "route": "/games",
            "duration": "60 sec",
            "reason": "Welcome back — a quick Word Gym round gets you started.",
        }

    if energy_level <= 2:
        return {
            "action": "games",
            "label": "Quick brain warm-up",
            "route": "/games",
            "duration": "60 sec",
            "reason": "Word Gym activates your thinking without pressure.",
        }

    return {
        "action": "focus",
        "label": "Start a focus session",
        "route": "/focus",
        "duration": "15 min",
        "reason": "You're ready for deep work.",
    }


def first_week_label(first_session_date: date | None, today: date | None = None) -> str | None:
    """
    Return a day-specific label for days 0–6 after first session.
    Returns None once the first week is complete.
    """
    if first_session_date is None:
        return None
    if today is None:
        today = datetime.now(UTC).date()

    day = (today - first_session_date).days
    _labels = {
        0: "Day 1 — let's see what Anchor can do",
        1: "Day 2 — building on yesterday",
        2: "Day 3 — your rhythm is forming",
        3: "Day 4 — halfway through your first week",
        4: "Day 5 — you're consistent",
        5: "Day 6 — one more day",
        6: "Day 7 — first week complete",
    }
    return _labels.get(day)
