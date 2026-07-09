# Focus API

## `POST /v1/focus/decompose`

Request:

```json
{ "task_text": "Write the first draft" }
```

Response:

```json
{
  "steps": [
    { "label": "Open the doc", "est_minutes": 1, "first": true }
  ],
  "why_first_step_matters": "Starting is the hardest part."
}
```

## `POST /v1/focus/decompose/stream`

SSE endpoint for streaming decomposition text when Claude streaming is available.

## `POST /v1/focus/sessions`

Starts a focus session. Current implementation returns a generated session ID and status.

## `PATCH /v1/focus/sessions/{session_id}`

Updates or ends a session. Current persistence for full focus-session rows is still a follow-up.
