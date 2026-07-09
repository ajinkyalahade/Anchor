# Onboarding

Onboarding creates a low-friction anonymous user and profile, then routes the user directly into
their chosen first anchor.

## Owned Code

- Frontend: `frontend/src/pages/OnboardingPage.tsx`
- Backend: `backend/app/api/onboarding.py`
- Data: `users`, `profiles`
- Tests: `backend/tests/test_onboarding.py`

## User Value

The flow captures only what is needed for personalization: deficit tags, crash window, and
preferred vibe. Account creation is deferred so the first useful action happens quickly.

## Status

MVP-complete. Auth and magic-link account linking remain open foundation work.
