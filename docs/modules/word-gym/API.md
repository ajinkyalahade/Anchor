# Word Gym API

## `GET /v1/games/wordgym/start`

Response:

```json
{
  "base_word": "ocean",
  "time_limit_seconds": 60
}
```

## `POST /v1/games/wordgym/evaluate`

Request:

```json
{
  "base_word": "ocean",
  "user_word": "tide"
}
```

Response:

```json
{
  "valid": true,
  "score": 5,
  "reason": "Connected association",
  "next_word": "tide"
}
```
