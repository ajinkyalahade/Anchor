# Rewards

Rewards provide XP, streak state, comeback bonuses, and unlocks while avoiding shame mechanics.

## Owned Code

- Backend: `backend/app/api/rewards.py`
- Domain: `backend/app/domain/rewards/service.py`
- Frontend helper: `frontend/src/lib/rewards.ts`
- Home surface: `frontend/src/pages/HomePage.tsx`
- Data: `rewards_ledger`, `reward_states`

## User Value

Rewards reinforce showing up. XP is weighted by module, while streaks recover instead of resetting.
