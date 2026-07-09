# Word Gym Runbook

## Local Checks

```bash
cd backend
.venv/bin/pytest tests/test_ai_router.py tests/test_rewards.py
```

```bash
cd frontend
npm run lint
npm run build
```

## Manual QA

1. Open `/games`.
2. Start Word Gym.
3. Type a word and press Enter.
4. Confirm score/history update.
5. Let timer expire and confirm done state.
