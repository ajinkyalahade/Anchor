# Onboarding API

## `POST /v1/onboarding`

Creates an anonymous `User` and linked `Profile`.

Request:

```json
{
  "deficit_tags": ["TB", "EF"],
  "crash_window": "Afternoon",
  "vibe_pref": "focused"
}
```

Response:

```json
{
  "user_id": "uuid",
  "profile_id": "uuid",
  "status": "success"
}
```

Frontend stores `user_id` in `localStorage` as `anchor_user_id` for subsequent rewards and AI
personalization calls.

## Validation

- `deficit_tags` defaults to an empty list.
- `crash_window` is nullable.
- `vibe_pref` defaults to `gentle`.
