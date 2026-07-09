# AI Layer

The AI layer routes provider-specific tasks behind one interface, validates prompt outputs, records
helpfulness feedback, computes user state, and powers Home suggestions.

## Owned Code

- Router: `backend/app/ai/router.py`
- Prompts: `backend/app/ai/prompts`
- AI endpoints: `backend/app/api/ai.py`
- User state: `backend/app/domain/user_state/service.py`
- Suggestions: `backend/app/domain/suggestion/service.py`
- Tests: `backend/tests/test_ai_router.py`, `test_user_state.py`, `test_suggestion.py`

## User Value

AI reduces choice by selecting the next useful anchor and turns raw text into structured help.
