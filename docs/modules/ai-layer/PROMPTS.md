# AI Layer Prompts

Prompt files:

- `decompose.py`
- `rsd.py`
- `wordgym.py`
- `registry.py`

Required behavior:

- Every prompt has a versioned ID.
- Every prompt has a validator.
- Every AI feature has a static fallback.
- Crisis text bypasses RSD prompt execution.

Prompt output should be structured JSON whenever the frontend or API needs fields.
