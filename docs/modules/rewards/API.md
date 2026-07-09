# Rewards API

## `GET /v1/rewards/summary`

Optional query: `user_id`.

Response:

```json
{
  "total_xp": 120,
  "current_streak": 3,
  "streak_state": "steady",
  "comeback_bonus_active": false,
  "message": null
}
```

## `POST /v1/rewards/grant`

Request:

```json
{
  "source": "focus",
  "base_xp": 10,
  "reason": "completed focus session",
  "user_id": "uuid"
}
```

Response includes granted XP, total XP, streak state, and comeback state.

## Unlocks

Unlock logic is deterministic in `app/domain/rewards/service.py`.
