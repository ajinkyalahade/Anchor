# Home

Home is the main daily return surface. It shows a greeting, XP/streak state, one suggested next
anchor, and three quick access tiles.

## Owned Code

- Frontend: `frontend/src/pages/HomePage.tsx`
- Suggestion API: `backend/app/api/ai.py`
- Suggestion logic: `backend/app/domain/suggestion/service.py`
- User state logic: `backend/app/domain/user_state/service.py`

## User Value

Home reduces choice by presenting one useful next action instead of a menu of settings.
