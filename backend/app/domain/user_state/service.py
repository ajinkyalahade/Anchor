"""User state computation for AI personalisation (1F.3).

Derives a structured snapshot from data we already have (XP ledger, streak,
profile) so the AI can make context-aware suggestions without storing
raw behavioural streams.
"""

from typing import Any


def compute_user_state(
    xp_by_source: dict[str, int],
    total_xp: int,
    streak_state: str,
    comeback_bonus_active: bool,
    crash_window: str | None,
    hrv_score: float | None = None,
) -> dict[str, Any]:
    """Return a normalised user-state snapshot (all numeric fields 1–5)."""
    focus_xp = xp_by_source.get("focus", 0)
    calm_xp = xp_by_source.get("calm", 0)
    wordgym_xp = xp_by_source.get("wordgym", 0)

    energy_level = _clamp(1 + round(focus_xp / 50))
    recent_focus_quality = _clamp(round((focus_xp / max(total_xp, 1)) * 5))
    emotional_load = _clamp(1 + round(calm_xp / 40))
    if hrv_score is not None and hrv_score < 40.0:
        emotional_load = _clamp(emotional_load + 1)
        
    cognitive_freshness = _clamp(1 + round(wordgym_xp / 30))

    # Preferred modalities ordered by engagement
    modality_xp = [("focus", focus_xp), ("calm", calm_xp), ("games", wordgym_xp)]
    preferred_modalities = [
        m for m, xp in sorted(modality_xp, key=lambda x: x[1], reverse=True) if xp > 0
    ] or ["focus"]

    return {
        "energy_level": energy_level,
        "recent_focus_quality": recent_focus_quality,
        "emotional_load": emotional_load,
        "cognitive_freshness": cognitive_freshness,
        "preferred_modalities": preferred_modalities,
        "crash_window_local": crash_window,
        "current_streak_state": streak_state,
        "comeback_bonus_active": comeback_bonus_active,
        "recent_hrv": hrv_score,
    }


def _clamp(value: int, lo: int = 1, hi: int = 5) -> int:
    return max(lo, min(hi, value))
