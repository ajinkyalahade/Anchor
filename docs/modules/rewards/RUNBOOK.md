# Rewards Runbook

## Local Checks

```bash
cd backend
.venv/bin/pytest tests/test_rewards.py
```

```bash
cd frontend
npm run lint
npm run build
```

## Manual QA

1. Complete onboarding so `anchor_user_id` exists.
2. Complete Focus, Word Gym, or Spiral Stop.
3. Confirm reward grant request succeeds.
4. Return Home and confirm XP/streak copy updates.
5. Simulate old `last_activity_date` in DB and confirm comeback copy.
