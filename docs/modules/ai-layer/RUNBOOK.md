# AI Layer Runbook

## Local Checks

```bash
cd backend
.venv/bin/pytest tests/test_ai_router.py tests/test_user_state.py tests/test_suggestion.py
```

## Provider-Down Checks

Unset provider API keys and rerun AI tests. Fallbacks should still pass.

## Manual QA

1. Decompose a task in Focus.
2. Submit a Word Gym association.
3. Submit non-crisis RSD text.
4. Confirm no UI blocks indefinitely when providers are unavailable.

## Safety Checks

Run crisis red-team tests before changing RSD prompts or classifier behavior.
