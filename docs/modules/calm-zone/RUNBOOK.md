# Calm Zone Runbook

## Local Checks

```bash
cd backend
.venv/bin/pytest tests/test_crisis_redteam.py tests/test_ai_router.py
```

```bash
cd frontend
npm run lint
npm run build
```

## Manual QA

1. Open `/calm`.
2. Start and stop breath coach.
3. Complete grounding steps.
4. Open Spiral and confirm timer/progress/transcript.
5. Submit non-crisis RSD text and confirm response.
6. Submit crisis red-team text in a local-safe test and confirm static resource card.
