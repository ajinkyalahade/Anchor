# Word Gym Prompts

Prompt source:

- `backend/app/ai/prompts/wordgym.py`
- validator spec in `backend/app/ai/prompts/registry.py`

Scoring guidance:

- invalid: `0`
- obvious but valid: `2-3`
- clever or distant: `8-10`

Fallback returns a valid low-score association so the game remains playable.
