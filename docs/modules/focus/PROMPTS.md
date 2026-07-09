# Focus Prompts

Prompt source:

- `backend/app/ai/prompts/decompose.py`
- validator spec in `backend/app/ai/prompts/registry.py`

Rules:

- Return 3-7 micro-steps.
- First step must be at most two minutes.
- Output must be valid JSON.
- Fallback returns a static three-step decomposition.

Prompt ID: `decompose@v1`.
