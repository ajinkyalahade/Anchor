# AI Layer API

## `GET /v1/ai/user-state`

Returns computed user state. Optional `user_id`.

## `POST /v1/ai/feedback`

Records a 1-tap helpfulness rating.

## `PATCH /v1/ai/consent/{user_id}`

Updates `share_ai_context`.

## `GET /v1/ai/suggestion`

Returns one next-anchor suggestion. Optional `user_id`.

## Privacy Helper

`pseudonymise_user_id` returns a short hash for provider-adjacent use.
