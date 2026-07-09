# Calm Zone API

## `POST /v1/calm/rsd`

Request:

```json
{
  "trigger_text": "They did not reply",
  "intensity": 7
}
```

Non-crisis response:

```json
{
  "is_crisis": false,
  "validation": "I hear you.",
  "normalization": "RSD can make this feel louder.",
  "reframe": "It may be that they were busy."
}
```

Crisis response:

```json
{
  "is_crisis": true,
  "crisis_message": "Static safety message",
  "resources": []
}
```

Crisis responses must not call an LLM.
