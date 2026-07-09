# Home API

Home reads:

- `GET /v1/rewards/summary?user_id={uuid}`
- `GET /v1/ai/suggestion?user_id={uuid}`

Both endpoints support anonymous fallback when `user_id` is omitted.

## Reward Summary Shape

```json
{
  "total_xp": 0,
  "current_streak": 0,
  "streak_state": "building",
  "comeback_bonus_active": false,
  "message": null
}
```

## Suggestion Shape

```json
{
  "action": "focus",
  "label": "15-minute focus session",
  "route": "/focus",
  "duration": "15 min",
  "reason": "Best next anchor for current state",
  "week_label": null
}
```
