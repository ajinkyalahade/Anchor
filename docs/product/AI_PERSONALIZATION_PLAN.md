# Anchor AI Personalization & Memory Enhancement Plan
> ✅ **Implemented** — all 7 features built and tested end-to-end

## Context

Anchor's AI layer is currently stateless: each coaching, decomposition, or RSD session starts from scratch with only a computed `UserStateSnapshot` (energy level, focus quality, etc.) as context. This limits personalization — the AI can't remember that the user struggles with Mondays, tends to spiral at 3pm, or has been gradually improving at task initiation. The persistence layer (PostgreSQL + pgvector in Docker) is in place but underused for AI memory. The goal is to make Anchor's AI feel like a companion that genuinely knows the user over time.

---

## What We're Building

### 1. Conversation Memory (Multi-turn Coaching)
**Problem:** Coaching sessions are one-shot — the AI has no memory of what was said before.

**Plan:**
- Add `coaching_conversations` table: `id, user_id, session_id, role (user|assistant), content, task_type, created_at`
- Add `coaching_sessions` table: `id, user_id, started_at, ended_at, summary (text), sentiment_score, topics (JSONB)`
- On each coaching request, fetch last N messages from the current session and inject as `messages[]` into the Claude API call (multi-turn)
- After session ends (idle >30min), trigger a background RQ job to summarize the session (Claude, ~100 words) and store in `coaching_sessions.summary`
- Session summaries become part of future prompt context: inject the last 3 session summaries when starting a new coaching session

**Files to create/modify:**
- `backend/app/db/models.py` — add `CoachingSession`, `CoachingMessage` models
- `backend/migrations/` — new Alembic migration
- `backend/app/api/ai.py` — update `/v1/ai/coaching` to store + retrieve messages
- `backend/app/ai/prompts/coach.py` — update to accept `conversation_history` and `past_session_summaries`
- `backend/app/domain/workers/` — add `summarize_session` RQ job

---

### 2. Long-Term User Memory (Pattern Synthesis)
**Problem:** The `UserStateSnapshot` is recomputed from raw XP every request — it's a point-in-time metric, not a narrative understanding of the user.

**Plan:**
- Add `user_memory` table: `id, user_id, memory_type (pattern|preference|milestone|struggle), content (text), embedding (vector(1536)), valid_from, valid_until, source (coach|rsd|focus|games|manual)`
- Weekly RQ job synthesizes all sessions, focus logs, game telemetry, and RSD logs into 5–10 memory entries using Claude
- Memory entries are tagged by type and embedded using `text-embedding-3-small` (or Claude's embedding endpoint)
- On AI calls, use pgvector cosine similarity search to retrieve the top-3 most relevant memories for the current task/context
- Injected into system prompts as a `[User Memory]` section

**Files to create/modify:**
- `backend/app/db/models.py` — add `UserMemory` model with `pgvector` column
- `backend/migrations/` — migration with `CREATE EXTENSION IF NOT EXISTS vector` + vector index
- `backend/app/ai/router.py` — add `AITask.SYNTHESIZE_MEMORY` + `AITask.EMBED`
- `backend/app/ai/prompts/` — add `memory_synthesis.py` prompt
- `backend/app/domain/workers/` — add `synthesize_user_memory` weekly job
- `backend/app/domain/user_state/service.py` — add `retrieve_relevant_memories(user_id, context_text)` using pgvector

---

### 3. Contextual Prompt Enrichment (Wire Memory into All AI Calls)
**Problem:** Only `UserStateSnapshot` is passed to AI prompts — memory, history, and behavioral patterns are not.

**Plan:**
- Create `PromptContext` dataclass: `user_state, relevant_memories, recent_session_summaries, current_time_context (morning|afternoon|crash_window), streak_state`
- Refactor `router.py` to accept and inject `PromptContext` into all prompts
- Update all prompt files (`coach.py`, `decompose.py`, `rsd.py`, `insight_weekly.py`, `quest_weekly.py`) to include a `[User Context]` block built from `PromptContext`
- Privacy gate: only inject memory entries that are `>=30 days old` OR explicitly user-approved (consent flag `memory_personalization = true`)

**Files to modify:**
- `backend/app/ai/router.py` — `PromptContext` dataclass + enrichment logic
- `backend/app/ai/prompts/*.py` — all prompts updated to accept richer context
- `backend/app/core/config.py` — `MEMORY_PERSONALIZATION_ENABLED` flag

---

### 4. Quick Mood Check-In (New Feature)
**Problem:** The AI infers emotional state from proxy metrics (XP earned) — there's no direct mood signal.

**Plan:**
- Add a lightweight mood check-in: 5-second widget on HomePage (emoji scale: 😵 😟 😐 😊 🚀)
- Optionally ask "What's weighing on you?" (free-text, optional)
- POST `/v1/ai/checkin` stores `mood_checkins` table: `id, user_id, score (1–5), note (encrypted text), created_at`
- Mood is incorporated into `UserStateSnapshot.emotional_load` (weighted average with HRV)
- Check-in note is summarized by Claude and stored as a `UserMemory` entry of type `pattern`
- Frontend: non-intrusive bottom-sheet that appears at app open if last check-in was >4h ago

**Files to create/modify:**
- `backend/app/db/models.py` — add `MoodCheckin` model
- `backend/app/api/ai.py` — add `POST /v1/ai/checkin`
- `backend/app/domain/user_state/service.py` — incorporate mood into state computation
- `frontend/src/components/MoodCheckin.tsx` — new component
- `frontend/src/pages/HomePage.tsx` — mount check-in widget
- `frontend/src/lib/api.ts` — add `submitCheckin()`

---

### 5. Personalized Daily Briefing (New Feature)
**Problem:** Users open the app without context on what's best for them right now.

**Plan:**
- New endpoint `GET /v1/ai/briefing` (cached 1h per user)
- Uses Claude to synthesize: current user state + relevant memories + time of day + streak + upcoming crash window
- Returns: `{greeting, energy_read (1 sentence), suggested_first_action, affirmation}`
- Shown as a card on `HomePage` on first open of the day
- Cached in Redis with key `briefing:{user_id}:{date}`

**Files to create/modify:**
- `backend/app/api/ai.py` — add `GET /v1/ai/briefing`
- `backend/app/ai/prompts/` — add `briefing.py` prompt
- `backend/app/ai/router.py` — add `AITask.DAILY_BRIEFING`
- `frontend/src/components/DailyBriefing.tsx` — new card component
- `frontend/src/pages/HomePage.tsx` — render briefing card
- `frontend/src/lib/api.ts` — add `fetchBriefing()`

---

### 6. Smart Proactive Nudges (New Feature)
**Problem:** Anchor is passive — users must open the app to get support. ADHD users often forget.

**Plan:**
- Background RQ job runs every 30min checking each active user's state
- Triggers push notification if: approaching their known crash window, streak about to break, or 3+ hours since last focus session
- Notification messages are personalized via Claude (short, warm, non-nagging) using user memory
- Users control nudge frequency via settings (`nudge_frequency: none | gentle | normal | proactive`)
- Notification preference stored in `users.prefs` JSONB (already exists)

**Files to create/modify:**
- `backend/app/domain/workers/` — add `nudge_worker.py` periodic job
- `backend/app/ai/prompts/` — add `nudge.py` prompt
- `backend/app/ai/router.py` — add `AITask.NUDGE`
- `backend/app/api/notifications.py` — already exists, add nudge opt-in endpoint
- `frontend/src/pages/SettingsPage.tsx` — add nudge frequency control

---

### 7. Dual AI Engine Support + User Engine Preference (New Feature)
**Problem:** Anthropic API calls cost money and require internet. Some users want privacy-first, fully local AI. Others want the best cloud quality. We need to support both and let users choose.

**Plan:**

#### Engine Abstraction
- Create a unified `AIEngine` protocol/interface that both engines implement:
  ```python
  class AIEngine(Protocol):
      async def complete(self, system: str, messages: list[dict], task: AITask) -> str: ...
  ```
- `AnthropicEngine` — wraps existing Anthropic SDK calls; default model `claude-haiku-4-5` for speed/cost, upgrades to `claude-sonnet-4-6` for tasks requiring deeper reasoning (coaching, RSD, insights)
- `OllamaEngine` — calls local Ollama HTTP API (`http://localhost:11434`); default model configurable (e.g., `llama3.2`, `mistral`, `phi3`); falls back to Anthropic if Ollama unreachable

#### Engine Selection Logic (in `router.py`)
- Read `user.prefs["ai_engine"]` on each request: `"anthropic"` | `"ollama"` | `"auto"`
- `"auto"` (default): try Ollama first if available, fall back to Anthropic
- Per-task model mapping for Ollama (configurable via env):
  - Fast tasks (word eval, game classify): `OLLAMA_FAST_MODEL` (default: `phi3`)
  - Reasoning tasks (coach, decompose, RSD, insights): `OLLAMA_REASONING_MODEL` (default: `llama3.2`)
- Anthropic model mapping (existing but make explicit):
  - Fast tasks: `claude-haiku-4-5-20251001`
  - Reasoning tasks: `claude-sonnet-4-6`

#### Ollama Health Check
- `GET /v1/ai/engines` — returns `{anthropic: {available: bool}, ollama: {available: bool, models: [str]}}`
- Frontend uses this to show which engines are available in settings
- Ollama availability checked via `GET http://localhost:11434/api/tags` with 2s timeout

#### User Settings
- Add `ai_engine` field to `users.prefs` JSONB: `"anthropic" | "ollama" | "auto"`
- Add `ollama_reasoning_model` and `ollama_fast_model` to `users.prefs` for power users
- `PATCH /v1/account/preferences` already exists — extend it to accept these fields

#### Frontend Settings UI
- New "AI Engine" section in `SettingsPage.tsx`:
  - Engine picker: Cloud (Anthropic) / Local (Ollama) / Auto
  - If Ollama selected: model picker dropdown (populated from `/v1/ai/engines`)
  - Status badge: green "Connected" / red "Offline" per engine
  - Info tooltip: explain privacy trade-offs and local setup instructions

**Files to create/modify:**
- `backend/app/ai/engines/` — new directory
  - `backend/app/ai/engines/base.py` — `AIEngine` protocol + `EngineResponse` dataclass
  - `backend/app/ai/engines/anthropic_engine.py` — Anthropic implementation (refactored from current `router.py`)
  - `backend/app/ai/engines/ollama_engine.py` — Ollama HTTP client implementation
- `backend/app/ai/router.py` — refactor to use engine abstraction; add engine selection logic
- `backend/app/api/ai.py` — add `GET /v1/ai/engines` health endpoint
- `backend/app/api/account.py` — extend preferences PATCH to accept engine prefs
- `backend/app/core/config.py` — add `OLLAMA_BASE_URL`, `OLLAMA_FAST_MODEL`, `OLLAMA_REASONING_MODEL`
- `frontend/src/pages/SettingsPage.tsx` — AI engine picker section
- `frontend/src/lib/api.ts` — add `fetchEngineStatus()`, `updateEnginePreference()`

**Verification:**
- Start Ollama locally with `ollama serve`, call `/v1/ai/engines` — verify `ollama.available: true`
- Set user pref to `"ollama"`, send a coaching request — verify response comes from Ollama (check logs)
- Stop Ollama, set pref to `"auto"` — verify fallback to Anthropic with a warning log
- Set pref to `"anthropic"` — verify haiku used for decompose, sonnet for coaching (check `ai_messages.model`)

---

## Database Migration Summary

```sql
-- coaching_sessions
CREATE TABLE coaching_sessions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  summary TEXT,
  sentiment_score FLOAT,
  topics JSONB
);

-- coaching_messages
CREATE TABLE coaching_messages (
  id UUID PRIMARY KEY,
  session_id UUID REFERENCES coaching_sessions(id),
  user_id UUID REFERENCES users(id),
  role VARCHAR(16),  -- 'user' | 'assistant'
  content TEXT,
  task_type VARCHAR(64),
  created_at TIMESTAMPTZ
);

-- user_memory
CREATE TABLE user_memory (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  memory_type VARCHAR(32),  -- 'pattern'|'preference'|'milestone'|'struggle'
  content TEXT,
  embedding vector(1536),
  source VARCHAR(32),
  valid_from TIMESTAMPTZ,
  valid_until TIMESTAMPTZ
);
CREATE INDEX ON user_memory USING ivfflat (embedding vector_cosine_ops);

-- mood_checkins
CREATE TABLE mood_checkins (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  score SMALLINT,
  note TEXT,  -- field-level encrypted
  created_at TIMESTAMPTZ
);
```

---

## Implementation Order (Phases)

### Phase A — Foundation (do first, everything else builds on this)
1. DB migration: `coaching_sessions`, `coaching_messages`, `user_memory`, `mood_checkins`
2. `PromptContext` dataclass in `router.py`
3. Multi-turn coaching (store + retrieve messages per session)

### Phase B — Memory Layer
4. `retrieve_relevant_memories()` with pgvector similarity search
5. Wire `PromptContext` into all existing prompts
6. Weekly memory synthesis job

### Phase C — New Features
7. Mood check-in (backend + frontend)
8. Daily briefing (backend + frontend)
9. Proactive nudges worker

---

## Verification Plan

1. **Multi-turn coaching:** Start a coaching session, send 3 messages, verify messages stored in DB. Start a new session next day, verify last 3 summaries appear in system prompt (check via `ai_messages` log).
2. **Memory retrieval:** After a memory synthesis job run, call `retrieve_relevant_memories(user_id, "task paralysis")` and verify cosine-similar memories are returned.
3. **Prompt enrichment:** Log the full rendered prompt for a coaching call and confirm `[User Context]` block is populated.
4. **Mood check-in:** Submit a check-in via `POST /v1/ai/checkin`, verify `mood_checkins` row created and `UserStateSnapshot.emotional_load` changes on next fetch.
5. **Daily briefing:** Call `GET /v1/ai/briefing`, verify response structure, call again within 1h and verify Redis cache hit (check latency).
6. **Nudge worker:** Manually set `crash_window` to current time in test user's profile, run `nudge_worker` job, verify push notification queued.
7. **Privacy gate:** Verify no memory entries are injected for users with `memory_personalization = false` in consent flags.

---

## Key Files Reference

| File | Role |
|------|------|
| `backend/app/db/models.py` | All DB models — add new tables here |
| `backend/migrations/` | Alembic migrations |
| `backend/app/ai/router.py` | AI task routing + `PromptContext` |
| `backend/app/ai/prompts/*.py` | Individual prompt templates |
| `backend/app/api/ai.py` | AI HTTP endpoints |
| `backend/app/domain/user_state/service.py` | State computation + memory retrieval |
| `backend/app/domain/workers/` | Background RQ jobs |
| `backend/app/core/cache.py` | Redis caching (reuse for briefing) |
| `frontend/src/pages/HomePage.tsx` | Home — mount check-in + briefing |
| `frontend/src/lib/api.ts` | API client — add new endpoints |
