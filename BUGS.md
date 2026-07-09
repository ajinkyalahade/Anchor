# Anchor — Bug Log
_Last updated: 2026-05-22 · Found via full Playwright user walkthrough_

---

## CRITICAL — Broken in production

### BUG-001 · `/ai/suggestion` and `/ai/user-state` return 500 on every call
**Symptom:** Every page load triggers repeated 500s on `GET /v1/ai/suggestion` and `GET /v1/ai/user-state`. Home card suggestion never loads from AI, falls back to hardcoded text.  
**Root cause:** `get_suggestion()` and `get_user_state()` in `ai.py` call `user.profile` as a lazy relationship outside an async greenlet. The `User` model is fetched with `db.get(User, user_id)` which does not eager-load `.profile`, causing `MissingGreenlet` in SQLAlchemy async.  
**Fix:** Replace `await db.get(User, user_id)` with a `select(User).options(selectinload(User.profile))` query in both `get_suggestion()` and `get_user_state()` — same pattern already used in `_build_prompt_context()`.  
**Affected files:** `backend/app/api/ai.py` lines ~272, ~74

---

### BUG-002 · XP never awarded — `/v1/rewards/grant` returns 500
**Symptom:** Completing a focus session shows "Focus complete." but XP stays at 0 in sidebar and Me page. Console shows `Reward grant failed ApiError: Internal Server Error`.  
**Root cause:** `/v1/rewards/grant` is returning a 500. Likely the same lazy-load issue or a missing route/handler.  
**Affected files:** `backend/app/api/rewards.py` (grant endpoint), `frontend/src/lib/rewards.ts`

---

### BUG-003 · `/v1/ai/feedback` returns 500
**Symptom:** AI feedback is silently dropped after every decompose and RSD response. Console shows repeated 500s on `POST /v1/ai/feedback`.  
**Root cause:** Server error on feedback endpoint — needs investigation in `ai.py` `record_ai_feedback()`.  
**Affected files:** `backend/app/api/ai.py` `record_ai_feedback()`

---

## HIGH — Noticeably broken UX

### BUG-004 · Home greeting says "Good afternoon, you." — name not shown
**Symptom:** Greeting never personalises to the user's first name. Shows "Good afternoon, **you**." even after login.  
**Root cause:** `HomePage.tsx` hardcodes "you" instead of fetching the user's `first_name` from the profile or auth context.  
**Affected files:** `frontend/src/pages/HomePage.tsx`

---

### BUG-005 · Home timeline shows hardcoded placeholder data
**Symptom:** "Today, Gently" timeline always shows the same fictional items: "Morning breath · 3 rounds box", "Focus · 25 min", "Echo · 1-back, 90 sec" etc. These are not real user activity records.  
**Root cause:** Timeline is seeded with static mock data in `HomePage.tsx`, never fetched from the DB.  
**Affected files:** `frontend/src/pages/HomePage.tsx`

---

### BUG-006 · Distraction park shows hardcoded items on every page load
**Symptom:** Focus page always pre-populates the distraction park with "Buy birthday gift for J" and "Email landlord about the radiator" — these are developer placeholder seeds, not the user's actual data.  
**Root cause:** `FocusPage.tsx` initialises `distractions` state with hardcoded items.  
**Affected files:** `frontend/src/pages/FocusPage.tsx`

---

### BUG-007 · Me page weekly insight shows inconsistent stats
**Symptom:** Weekly insight reads "Morning sessions averaged **0/100** this week, and your best completed block hit **68/100**." The 0/100 morning average contradicts the 68/100 best block score.  
**Root cause:** Stats are likely calculated from different data sources or timeframes. The morning average appears to be fetched live (returns 0 due to the suggestion 500) while the best block score comes from a different source.  
**Affected files:** `frontend/src/pages/ProfilePage.tsx`

---

### BUG-008 · Focus AI decompose returns only 2 steps instead of 3+
**Symptom:** "Break into micro-steps" returns only 2 steps for most tasks. The prompt spec expects 3 or more.  
**Root cause:** The Ollama `qwen3.5:2b` model truncates the JSON at `max_tokens=1024`. The decompose prompt's schema example may not be strong enough for the small model to always produce a third step.  
**Affected files:** `backend/app/ai/prompts/decompose.py`, `backend/app/ai/router.py`

---

## MEDIUM — Functionality gap or confusing UX

### BUG-009 · Weekly Insights page requires manual data entry — no auto-population from DB
**Symptom:** `/ai/insights` presents input fields for "Focus sessions", "Morning focus score", "Avg sleep" etc. that the user must fill in manually. The app already has all this data in the DB.  
**Root cause:** `WeeklyInsightsPage.tsx` uses hardcoded default values instead of pulling real session counts from the backend.  
**Fix:** Pre-populate the inputs by fetching `GET /v1/ai/user-state` on mount.  
**Affected files:** `frontend/src/pages/WeeklyInsightsPage.tsx`

---

### BUG-010 · Anchor AI sidebar parent does not highlight when on child routes
**Symptom:** When navigating to `/ai/briefing` or `/ai/insights`, the "Anchor AI" parent item in the sidebar does not show the active background — only the child dot highlights.  
**Root cause:** `isParentOrChildActive()` in `Sidebar.tsx` checks `activePath.startsWith('/' + n.id)` which would be `/anchor-ai`, but the actual routes use `/ai/`. The `to` field is `/ai` but the sidebar ID is `anchor-ai`.  
**Affected files:** `frontend/src/components/Sidebar.tsx`

---

### BUG-011 · Coach page fails to load with ErrorBoundary after first visit in session
**Symptom:** Navigating away from `/coach` and back sometimes triggers `TypeError: Failed to fetch dynamically imported module: CoachPage.tsx`, showing the error boundary instead of the chat.  
**Root cause:** Vite HMR or module cache issue with the lazy-loaded `CoachPage`. Likely caused by a 504 "Outdated Optimize Dep" error seen in console.  
**Affected files:** `frontend/src/App.tsx` (lazy import), Vite config

---

### BUG-012 · Energy Quests mood heatmap never fills — all dashes
**Symptom:** The mood delta heatmap on the Energy Quests page shows `—` for every quest on every day, even after using the app.  
**Root cause:** Quest completions require calling `POST /v1/games/quests/complete` with `mood_before` and `mood_after` values, but the "One tap" / "start" buttons on the quests page do not record a completion or prompt for mood.  
**Affected files:** `frontend/src/pages/EnergyQuestsPage.tsx`

---

## LOW — Polish / minor issues

### BUG-013 · Focus session length buttons are unresponsive during active session
**Symptom:** Once "Start session" is clicked, the 15/20/25 min buttons remain visible and appear clickable but have no effect.  
**Fix:** Disable or hide session length buttons when a session is active.

### BUG-014 · Daily Briefing shows "cached · refreshes hourly" label even on first load
**Symptom:** The briefing page immediately shows the "cached" label. The cache flag is true because the session from earlier in the conversation is being returned.  
**Note:** Technically correct behaviour, but on first-ever use in a day it may confuse users. The label could say "personalised today" instead of "cached".

### BUG-015 · Settings AI engine indicator dot is always on "Local (Ollama)"
**Symptom:** The green active dot on the AI engine selector in Settings always appears on "Local" regardless of what engine is actually configured. The state is not read from the user's saved preference.  
**Affected files:** `frontend/src/pages/SettingsPage.tsx`

---

## Summary

| Priority | Count |
|----------|-------|
| Critical | 3 |
| High | 5 |
| Medium | 4 |
| Low | 3 |
| **Total** | **15** |
