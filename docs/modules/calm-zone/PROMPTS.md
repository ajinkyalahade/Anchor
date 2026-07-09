# Calm Zone Prompts

RSD prompt source:

- `backend/app/ai/prompts/rsd.py`
- validator spec in `backend/app/ai/prompts/registry.py`

Required response fields:

- `validation`
- `normalization`
- optional `reframe`

Rules:

- Validate first.
- Normalize briefly.
- Reframe only as a possibility.
- Never advise medication.
- Never run prompt for crisis-flagged text.
