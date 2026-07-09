# Home Runbook

## Local Checks

```bash
cd frontend
npm run lint
npm run build
```

```bash
cd backend
.venv/bin/pytest tests/test_suggestion.py tests/test_user_state.py tests/test_rewards.py
```

## Manual QA

1. Open `/`.
2. Confirm greeting, XP badge, suggested action, and three tiles render.
3. Clear `localStorage.anchor_user_id` and reload; page should still render.
4. Set a valid user ID and confirm rewards/suggestion calls update the surface.
