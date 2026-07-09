# Focus Runbook

## Local Checks

```bash
cd frontend
npm run lint
npm run build
```

```bash
cd backend
.venv/bin/pytest tests/test_ai_router.py tests/test_rewards.py
```

## Manual QA

1. Open `/focus`.
2. Enter a task and start.
3. Confirm timer runs, pauses, and completes.
4. Confirm first decomposed step is visually emphasized.
5. Open distraction park and save a thought.

## Failure Modes

- AI unavailable: static fallback steps should render.
- Backend unavailable: frontend fallback still starts the timer.
