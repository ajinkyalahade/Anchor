# Onboarding Runbook

## Local Checks

```bash
cd backend
.venv/bin/pytest tests/test_onboarding.py
```

```bash
cd frontend
npm run lint
npm run build
```

## Manual QA

1. Open `/onboarding`.
2. Complete tags, crash window, and anchor selection.
3. Confirm the app routes to the selected module.
4. Confirm `localStorage.anchor_user_id` is set when the backend is running.

## Common Failures

- Missing DB tables: run Alembic migration.
- Backend unavailable: frontend falls through to route navigation but no user ID is stored.
