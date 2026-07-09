"""Reward loop business rules."""

import math
from dataclasses import dataclass
from datetime import UTC, date, datetime
from typing import Any, Literal

RewardSource = Literal["focus", "wordgym", "calm", "games", "quests"]
StreakState = Literal["building", "steady", "recovering"]
UnlockType = Literal["theme", "sound"]


@dataclass(frozen=True)
class UnlockItem:
    id: str
    type: UnlockType
    label: str
    xp_required: int
    description: str


UNLOCK_CATALOG: tuple[UnlockItem, ...] = (
    UnlockItem(
        "theme_focus_blue",
        "theme",
        "Focus Blue",
        50,
        "Deeper blue tones for focused sessions",
    ),
    UnlockItem("theme_forest_calm", "theme", "Forest Calm", 150, "Soft greens to ease your mind"),
    UnlockItem("theme_dusk_warm", "theme", "Dusk Warm", 300, "Warm ambers for late-night sessions"),
    UnlockItem("sound_rain", "sound", "Rain Sounds", 100, "Soft rain to fade the noise"),
    UnlockItem(
        "sound_forest",
        "sound",
        "Forest Ambience",
        250,
        "Morning birdsong and rustling leaves",
    ),
)


def compute_newly_unlocked(total_xp: int, previous_xp: int) -> list[UnlockItem]:
    """Return items whose XP threshold was crossed by this gain."""
    return [
        item for item in UNLOCK_CATALOG
        if previous_xp < item.xp_required <= total_xp
    ]


def get_catalog_with_status(total_xp: int) -> list[dict[str, Any]]:
    """Return catalog annotated with locked/unlocked status."""
    return [
        {
            "id": item.id,
            "type": item.type,
            "label": item.label,
            "xp_required": item.xp_required,
            "description": item.description,
            "unlocked": total_xp >= item.xp_required,
        }
        for item in UNLOCK_CATALOG
    ]

SOURCE_WEIGHTS: dict[RewardSource, float] = {
    "focus": 1.2,
    "wordgym": 1.0,
    "calm": 1.1,
    "games": 1.0,
    "quests": 1.0,
}


@dataclass(frozen=True)
class RewardSummary:
    total_xp: int
    current_streak: int
    streak_state: StreakState
    comeback_bonus_active: bool


@dataclass(frozen=True)
class StreakSnapshot:
    current_streak: int
    streak_state: StreakState
    comeback_bonus_active: bool


def calculate_weighted_xp(source: RewardSource, base_xp: int, comeback_bonus: bool = False) -> int:
    """Apply evidence-weighting and optional comeback multiplier to a reward."""
    if base_xp <= 0:
        raise ValueError("base_xp must be positive")

    xp = math.ceil(base_xp * SOURCE_WEIGHTS[source])
    return xp * 2 if comeback_bonus else xp


def summarize_rewards(total_xp: int, activity_timestamps: list[datetime]) -> RewardSummary:
    """Summarize XP and current activity streak from ledger timestamps."""
    if not activity_timestamps:
        return RewardSummary(
            total_xp=total_xp,
            current_streak=0,
            streak_state="building",
            comeback_bonus_active=False,
        )

    activity_dates = sorted(
        {timestamp.astimezone(UTC).date() for timestamp in activity_timestamps},
        reverse=True,
    )
    today = datetime.now(UTC).date()
    latest_activity = activity_dates[0]
    days_since_latest = (today - latest_activity).days
    comeback_bonus_active = days_since_latest > 1

    streak = _count_current_streak(activity_dates, today)

    if comeback_bonus_active:
        streak_state: StreakState = "recovering"
    elif streak >= 3:
        streak_state = "steady"
    else:
        streak_state = "building"

    return RewardSummary(
        total_xp=total_xp,
        current_streak=streak,
        streak_state=streak_state,
        comeback_bonus_active=comeback_bonus_active,
    )


def refresh_streak_for_today(
    current_streak: int,
    last_activity_date: date | None,
    today: date,
) -> StreakSnapshot:
    """Refresh streak state without penalizing missed days."""
    if last_activity_date is None:
        return StreakSnapshot(
            current_streak=0,
            streak_state="building",
            comeback_bonus_active=False,
        )

    days_since_activity = (today - last_activity_date).days
    comeback_bonus_active = days_since_activity > 1

    if comeback_bonus_active:
        streak_state: StreakState = "recovering"
    elif current_streak >= 3:
        streak_state = "steady"
    else:
        streak_state = "building"

    return StreakSnapshot(
        current_streak=current_streak,
        streak_state=streak_state,
        comeback_bonus_active=comeback_bonus_active,
    )


def advance_streak_after_activity(
    current_streak: int,
    last_activity_date: date | None,
    today: date,
) -> StreakSnapshot:
    """Advance streak after the user shows up."""
    if last_activity_date == today:
        next_streak = max(current_streak, 1)
    else:
        next_streak = current_streak + 1 if current_streak > 0 else 1

    return StreakSnapshot(
        current_streak=next_streak,
        streak_state="steady" if next_streak >= 3 else "building",
        comeback_bonus_active=False,
    )


def _count_current_streak(activity_dates: list[date], today: date) -> int:
    start_day = today

    if today not in activity_dates:
        yesterday = date.fromordinal(today.toordinal() - 1)
        if yesterday not in activity_dates:
            return 0
        start_day = yesterday

    streak = 0
    expected = start_day
    activity_set = set(activity_dates)

    while expected in activity_set:
        streak += 1
        expected = date.fromordinal(expected.toordinal() - 1)

    return streak
