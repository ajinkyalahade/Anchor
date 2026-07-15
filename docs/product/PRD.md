# Anchor — Product Requirements Document (PRD)

**An AI-powered companion app for adults with ADHD, anxiety, and executive-function challenges.**

Version: 0.1 (Draft)
Owner: Product
Last updated: 2026-05-03

---

## 1. Vision & Positioning

Anchor is a daily-use, action-packed mobile/web app for adults whose brains run hot — ADHD, anxiety, RSD, executive-function fatigue. Most ADHD apps today are either:

1. **Productivity wrappers** (calendars, to-do lists) — they assume a working executive function the user doesn't have, OR
2. **Single-mechanic games** (n-back, breathing) — narrow and quickly abandoned.

Anchor is different on three axes:

- **Multi-modal**: focus engine + brain games + word retrieval + calm/regulation + structure + body doubling — one anchor for the whole day, not a tab in five apps.
- **Evidence-first**: every feature traces to a documented neurological deficit (working memory, executive function, time blindness, emotional dysregulation, word retrieval, dopamine).
- **AI-personalized**: an AI layer (Gemini for cheap/fast classification + Anthropic Claude for nuanced reasoning/coaching) reads context (time of day, recent sessions, mood check-ins, performance patterns) and tunes difficulty, surfaces the right tool, writes the daily script, and acts as a non-judgmental coach.

**Positioning statement.** Anchor is the calm, smart anchor point a scattered brain returns to throughout the day — not another productivity tax.

---

## 2. Research Foundation

### 2.1 Market & severity
- 366M adults globally with ADHD; 70% co-occurring anxiety; 4–5× higher job-loss rate; ~30 min typical sustained attention window.
- Adult ADHD digital-therapeutic market is validated by FDA-authorized **EndeavorRx / EndeavorOTC** (Akili). Their pivotal trials show 23–36% responder rate at 1 month, 45% at 2 months on TOVA Attention Performance Index, with 73% of users self-reporting attention improvement. Daily dose: ~25 min, 5×/week. **Implication:** small, daily, game-shaped doses produce measurable change. We design for that cadence.

### 2.2 Six core neurological deficits (from research brief)
Every feature must trace back to ≥1 of these:

| # | Deficit | Lived experience |
|---|---|---|
| WM | Working memory | Lose train of thought mid-sentence; forget what they were doing while doing it |
| EF | Executive function | Task-initiation paralysis ("can't start"), planning collapse, poor self-monitoring |
| TB | Time blindness | 10 min and 2 hours feel identical; deadlines missed from temporal distortion, not laziness |
| ED | Emotional dysregulation + RSD | Rejection-sensitive dysphoria; emotions arrive faster, stronger, decay slower |
| WF | Word retrieval / verbal fluency | Words "in there" but blocked; constant tip-of-tongue. Pathway problem, not vocabulary |
| DO | Dopamine dysregulation | Novelty / urgency / passion / challenge are the four dopamine triggers — that's why hyperfocus happens |

### 2.3 What the evidence supports
- **High evidence:** CBT techniques, Pomodoro (and ADHD-tuned variants 15/20/25 min), body doubling, gamification (XP/streaks), mindfulness, aerobic micro-bursts, breathwork (4-7-8, box, physiological sigh), grounding (5-4-3-2-1).
- **Mixed / emerging:** working-memory training (dual n-back). Near-transfer is solid; far-transfer is debated. We frame it as **skill-building + dopamine delivery**, not "make you smarter."
- **Anxiety co-occurrence is bidirectional:** ADHD failures breed anxiety; anxiety hijacks the prefrontal cortex and worsens ADHD. Both must be addressed in the same app.

### 2.4 Friction is the killer
ADHD users abandon apps at every tap, settings menu, or empty-state. Design rules:
- Never start with a setup wall. Curated default templates + 60-second onboarding.
- Single-tap to the most-likely action. The home screen is a verb, not a menu.
- Natural-language input everywhere a user might type.
- No shame on missed days — comeback bonuses, not streak loss.

---

## 3. Target Users & Personas

### Primary (MVP)
- **The Scattered Professional (25–40)** — knowledge worker, diagnosed or self-identified ADHD, often anxiety. Has tried 5 apps, abandoned all. Wants a single home base.
- **The Late-Diagnosed Adult (30–50)** — recent diagnosis, building self-knowledge. Will read explanations. High intrinsic motivation but low momentum.

### Secondary (post-MVP)
- **The Self-Suspecting Student (18–24)** — undiagnosed, exam-pressured, dopamine-seeking. Onboards via games.
- **The Anxious Non-ADHD User** — comes for Calm Zone, stays for Structure Hub.

### Non-goals
Children (EndeavorRx covers this and requires regulatory work we won't do for v1). Severe co-morbid bipolar / psychosis — out of scope; we route to professional help.

---

## 4. Product Principles

1. **Every feature traces to a deficit.** If it doesn't, cut it.
2. **Calm is the default aesthetic.** Stimulating mechanics live *inside* games; the chrome is quiet.
3. **The verb is on the home screen.** Decide-for-me beats configure-yourself.
4. **AI reduces choice, never adds it.** AI's job is to pick the next right thing.
5. **No shame mechanics.** Streaks recover. Missed days don't punish.
6. **Doses, not lessons.** 2–10 min interactions. Never a 30-min "module."
7. **Privacy is load-bearing.** Mental-health data is sensitive. Local-first where possible; explicit consent for everything sent to LLMs.

---

## 5. UI / UX Direction

### 5.1 Mood
Calmer than productivity apps, warmer than meditation apps. Think *Things 3 meets Headspace meets Duolingo's restraint, not its loudness.*

### 5.2 Color system

| Token | Light | Dark | Use |
|---|---|---|---|
| `bg.canvas` | `#F7F5F1` (warm bone) | `#0F1115` (deep slate) | Page background |
| `bg.surface` | `#FFFFFF` | `#171A21` | Cards, panels |
| `bg.surface-2` | `#EFEBE4` | `#1F232C` | Nested cards |
| `text.primary` | `#1A1D24` | `#E8E6E1` | Body |
| `text.muted` | `#5C6370` | `#8A8F9A` | Secondary |
| `accent.calm` | `#7FB3A3` (sage) | `#7FB3A3` | Calm Zone, breathwork |
| `accent.focus` | `#6B8AC2` (dust blue) | `#6B8AC2` | Focus Engine, structure |
| `accent.spark` | `#E0A458` (warm amber) | `#E0A458` | Reward, dopamine moments |
| `accent.warm` | `#C77B5C` (clay) | `#C77B5C` | Energy Quests, alerts |
| `accent.lilac` | `#9C8AC2` | `#9C8AC2` | Word Gym, learning |

**Avoid:** pure white, pure black, saturated red (RSD trigger), green-success-explosions (juvenile in adult context). Confetti is muted (one ribbon, not a fountain).

### 5.3 Typography
- Display: **Söhne** or **Inter Display** (calm geometric)
- Body: **Inter** 16px base, generous line-height (1.6)
- Numerals (timers): **JetBrains Mono** tabular for non-jittery countdowns

### 5.4 Motion
- 200ms standard ease, 400ms for state transitions, no bouncy springs.
- Time-blindness aid: **all timers are a shrinking visual bar**, not just digits.
- Reduce-motion respected globally.

### 5.5 Layout primitives
- Mobile-first; web is a wider mirror, not a different app.
- Home is a single vertical scroll: a greeting, **one suggested action ("Right now: 15-min focus")**, three quick-access tiles, today's gentle timeline.
- Bottom nav: Home / Focus / Games / Calm / Me. Five items, no more.

### 5.6 Accessibility
WCAG AA contrast minimum, AAA for body text. Dyslexia-friendly font option. Voice input on every text field (ADHD users vastly prefer dictation). Haptics opt-in. All animations respect `prefers-reduced-motion`.

---

## 6. User Journey & Onboarding

### 6.1 First open (target: < 90 seconds to first action)

**Screen 1 — Welcome (5s).** One sentence: *"Anchor helps your brain start, focus, and reset. Three taps to set up."* CTA: "Start." No sign-up wall.

**Screen 2 — What's loud right now (15s).** Pick up to 3 chips: `Can't start things` · `Lose focus` · `Anxious / overwhelmed` · `Forget words / blank` · `Time slips away` · `Emotions hit hard` · `Just curious`. Maps to deficit tags.

**Screen 3 — When you usually crash (10s).** Morning / midday / afternoon / evening / late night. Used by AI to schedule nudges.

**Screen 4 — Pick your anchor (15s).** Three pre-built profiles, hand-picked from the chips:
- "I need to **start things.**" → opens to Focus Engine + Task Decomposer
- "I need to **calm down.**" → opens to Calm Zone first
- "I want to **train my brain.**" → opens to Brain Games + Word Gym

**Screen 5 — Account (deferred).** Skip-able. *"You can use Anchor for 7 days without an account."* Email / Apple / Google. No password by default — magic-link.

**Screen 6 — First action (instant).** Drop into the chosen anchor. *Do something* before learning anything else. The first session uses Beginner difficulty regardless of prior assessment.

### 6.2 Day-2 hook
Push notification at the user's stated crash time: *"5-min reset?"* — opens directly to Calm Zone or a 2-min Energy Quest, AI-picked. No menu.

### 6.3 First-week scaffolding
- Day 1: try the chosen anchor.
- Day 2: AI suggests a contrasting tool ("you focused — try a 90-sec word game?").
- Day 3: first emotion check-in unlocks RSD interrupt.
- Day 5: first Insight unlocks ("you focus best 10–11am").
- Day 7: invite to set one tiny structural commitment in Structure Hub.

Onboarding is **earned**, not front-loaded. The user discovers depth at the rate they need it.

### 6.4 Long-term loop
Daily: open → AI surfaces 1 suggested anchor → do a 2–25 min dose → small reward → optional reflection (1 tap mood). Weekly: Insight Dashboard digest. Monthly: trend report + theme/feature unlock.

---

## 7. Feature Modules — Detailed Specs

Each module lists: **purpose · deficit served · core mechanics · UX flow · AI hooks · data model · acceptance criteria.**

### 7.1 Focus Engine

**Purpose.** Help the user start and sustain a single task.
**Deficits.** TB, EF, DO.

**Mechanics.**
- **ADHD Pomodoro presets**: 15/5, 20/5, 25/5, plus a "flow extend" prompt at the end (don't auto-cut hyperfocus).
- **Visual time bar**: shrinking horizontal/circular bar, colored `accent.focus`, prioritized over digits.
- **Task Decomposer**: paste/dictate a task → Claude returns 3–7 micro-steps with realistic minute estimates and a "ridiculously small" first step.
- **Body Doubling Sounds**: ambient layers (cafe / library / rain / keyboard / fireplace). Mix-able. Loop seamlessly.
- **Live Body Doubling Rooms (post-MVP)**: silent video rooms, 4 people max, optional "I'm working on X for Y min" public commitment. No chat.
- **Distraction park**: an inbox that captures intrusive thoughts mid-session ("buy birthday gift") and returns them after.

**Flow.**
1. Home → tap "Start focus" → AI pre-fills suggested task and duration based on time of day & history.
2. User confirms or changes (one-tap).
3. Task Decomposer runs in background; first micro-step appears on the timer screen.
4. Distraction-park button always visible.
5. Timer ends → 60-sec celebration + "Continue?" / "I'm done" / "Take a break."

**AI hooks.** Gemini Flash classifies the pasted task into category (deep / shallow / creative / admin) and picks the duration. Claude does the decomposition with a careful prompt that emphasizes a tiny first step.

**Data.** `focus_sessions(id, user_id, started_at, ended_at, duration_planned, duration_actual, task_text, decomposition_jsonb, completed_steps_int, distractions_jsonb, mood_before, mood_after)`.

**Acceptance.** User can start a focus session in ≤2 taps from cold-open. Decomposition arrives in <3s in 95th percentile. Time bar smoothly shrinks; never jumps.

### 7.2 Brain Games

**Purpose.** Train working memory, attention, impulse control, cognitive flexibility — packaged as 90-sec doses with dopamine payoff.
**Deficits.** WM, EF, DO.

**Game catalog.**

1. **Echo (n-back, single)** — letters/positions; user taps when current matches N-back. Adaptive: starts at 1-back, adjusts ±1 every 5 trials based on accuracy band (target 70–85%).
2. **Echo Dual** (post-MVP) — visual + audio simultaneous (the dual n-back from research literature). Power-user mode.
3. **Mirror (Simon)** — increasing pattern recall; 4-tile, then 6-tile; haptic feedback.
4. **Spotter** — "spot the difference" between two near-identical scenes; trains sustained attention.
5. **Lockstep (go / no-go)** — green = tap, red = don't. Targets impulse control. Reaction-time scored.
6. **Switch** — rule-switching task: sort by color, then suddenly by shape. Trains cognitive flexibility (the "set-shifting" deficit).
7. **Tracker** — multiple-object tracking; follow N moving dots among distractors.

**Common mechanics.**
- 90-sec rounds. Hard cap, no extending.
- Adaptive difficulty: every game owns an internal `level` (1–20) per user; algorithm raises level when accuracy >85% over last 3 rounds, drops when <60%.
- Streak-of-wins XP; no streak-of-days pressure inside Games.
- "Why this matters" footer on each game, plain-language: *"Echo trains working memory — the thing that drops the second half of a sentence."*

**AI hooks.**
- Gemini classifies session (focused / distracted / fatigued) from response-time variance and picks the next game.
- Claude writes weekly micro-explanations: *"You improved 18% on Switch this week. That's the mental gear-shift muscle — it shows up when you're juggling tabs."*

**Data.** `game_sessions(id, user_id, game_key, level, score, accuracy, rt_mean, rt_var, started_at, completed bool)`.

**Acceptance.** Each game launches in ≤1.5s. Adaptive level updates immediately at session end. No game >120s.

### 7.3 Word Gym

**Purpose.** Restore the *retrieval pathway*. ADHD users have the words — they can't reach them under pressure. We make the pathway faster, not the dictionary bigger.
**Deficits.** WF, WM.

**Exercises.**
1. **Tip-of-Tongue Trainer** — Claude generates a definition; user types/says the word in 8 seconds. Hint ladder: first letter → syllable count → rhyme. Adaptive frequency band (common→rare).
2. **Synonym Chains** — start word → write 5 synonyms in 30 sec → AI judges semantic distance, rewards range.
3. **Contextual Cloze** — paragraph with one blank; word must fit register (formal vs casual). Trains pragmatic retrieval.
4. **Anagram Rescue** — scrambled letters of the word user "almost said" earlier in the day (ties to the user's own log).
5. **Speak-It (post-MVP)** — voice input, word fluency under time pressure (semantic fluency: name 12 fruits in 60s, like the COWAT/animal naming clinical task).

**Mechanics.**
- All sessions ≤2 min.
- Difficulty bands (frequency rank from a corpus): Daily / Familiar / Stretch / Rare.
- "Words you almost lost" — log of words the user paused on; resurfaced 3 days later in different exercise.

**AI hooks.** Claude generates definitions, judges semantic-chain quality, picks the next word with rising difficulty. Gemini handles cheap/frequent calls (cloze fill).

**Data.** `vocab_attempts(id, user_id, exercise, word, success bool, latency_ms, hints_used, ts)`. `vocab_personal_corpus(user_id, word, status enum[learning, weak, retained], next_review_at)` — spaced repetition (SM-2 / FSRS).

**Acceptance.** Tip-of-tongue prompt < 1.5s to render. Word never repeats inside a session. Personal corpus actually surfaces past misses on schedule.

### 7.4 Calm Zone

**Purpose.** Interrupt the spiral. Ground. Regulate.
**Deficits.** ED, anxiety co-morbidity.

**Tools.**
1. **Breath Coach** — 4-7-8, box breathing (4-4-4-4), physiological sigh (double-inhale, long exhale), 5-2-5. Visual orb expansion + optional vibration, no voice unless asked.
2. **5-4-3-2-1 Grounding** — sensory walkthrough: 5 see / 4 feel / 3 hear / 2 smell / 1 taste. Voice input accepted.
3. **Body Scan** — 3 / 7 / 12-min options, recorded calm voice + transcript.
4. **RSD Interrupt** — a single dedicated red button: "Something just hurt." → emotion-naming wheel → intensity (1–10) → 60-sec compassionate Claude response framed as *normalizing the feeling, not solving it* → action choice (breathe / walk / message a friend / journal / nothing). All optional. Logged.
5. **Anxiety Spiral Stop** — guided 90-sec script that names the spiral, slows breath, and ends with one micro-action.

**Safety layer (critical).** Crisis detection on free-text input — if Claude/Gemini classify the input as suicidal ideation, self-harm, or acute crisis, the response is a hard-coded resource card (988 in US, plus localized lines, plus "Talk to a real person now" links). No LLM-generated content in that branch. Logged for clinical review.

**AI hooks.** Claude only — empathy quality matters here. Strict system prompt: validate before suggest; never diagnose; never minimize; redirect to human help on red flags.

**Data.** `regulation_sessions(id, user_id, tool, duration_s, mood_before, mood_after, ts)`. `rsd_logs(id, user_id, trigger_text encrypted, emotion, intensity, response_chosen, ai_message_id, ts)`.

**Acceptance.** Breath coach starts in ≤1 tap from any screen via long-press on the bottom nav. RSD button is permanently accessible. Crisis path tested with 30 red-team prompts; 100% catch rate before launch.

### 7.5 Energy Quests

**Purpose.** Dopamine micro-doses + body activation. Counter the slump.
**Deficits.** DO, ED.

**Quests (each 90s–3 min).**
- Desk exercises: 20 jumping jacks, wall push-ups, neck rolls.
- Cold-water face splash (timer + cue).
- Dance break: 90-sec random song from user's playlist (Spotify integration post-MVP) or built-in royalty-free track.
- "Step outside for 2 min" — geofenced check-in.
- Hydration nudge.
- Power pose + box breath.

**Mechanics.** Gamified streak ("3 quests today!"), XP. Heatmap of *which quests actually moved the user's mood* per the post-quest 1-tap check-in.

**AI hooks.** Claude weekly: *"Cold-water splashes lifted your focus 3/4 times. Dance breaks didn't move it. Want me to lean on the splashes?"*

**Data.** `quests(id, user_id, quest_key, completed_at, mood_before, mood_after, focus_after_minutes)`.

**Acceptance.** Each quest is one-tap to start. Mood delta logged.

### 7.6 Structure Hub

**Purpose.** External executive function. Visual planning that ADHD brains actually keep open.
**Deficits.** EF, TB, WM.

**Components.**
1. **Daily Time-Block Planner** — visual blocks with color-coded urgency × importance (the Eisenhower matrix folded into the timeline).
2. **Transition Alerts** — 5-min, 1-min warnings before next block. Gentle, not jarring; vibration + soft chime.
3. **Quick-Capture Inbox** — the "park it" button: dictate any thought, processed later. Voice or text. The same surface used inside Focus sessions.
4. **End-of-day Brain Dump** — 90-sec guided dump; Claude clusters it overnight into themes, returns "Here's what was on your mind" the next morning.
5. **Time-Reality Calibration** — TB-specific. User estimates "this will take ___ min." Actual is logged. Over weeks, a calibration coefficient appears: *"You estimate 45% of actual. We'll auto-adjust your blocks."*

**AI hooks.**
- Gemini: nightly clustering of brain-dump notes → themes.
- Claude: weekly: *"You always block writing for 30 min and it always takes 75. Want me to default writing to 75?"*

**Data.** `time_blocks(id, user_id, start_ts, end_ts, label, category, importance, urgency, completed bool)`. `time_estimates(user_id, category, est_min, actual_min, ts)`.

**Acceptance.** Planner renders today + tomorrow in <500ms. Quick-capture writes locally first, syncs second (offline-capable).

### 7.7 Reward Loop

**Purpose.** Dopamine without shame.
**Deficits.** DO, ED.

**Mechanics.**
- **XP** earned across all modules, weighted by module evidence-strength.
- **Streaks** — but **comeback bonus** instead of streak loss. Missed 3 days? Return = 2× XP for next session.
- **Customizable rewards** — user chooses what matters: visual themes, ambient sound packs, new game variants, character/anchor-mascot evolutions.
- **Effort over outcome** — celebrating *showing up* (e.g., "you opened Anchor on a hard day") not just performance.
- **No leaderboards** in v1. Comparison is toxic for this audience.

**AI hooks.** Claude tunes reward copy to user's vibe (gentle vs hype) detected from onboarding & feedback.

**Acceptance.** No notification ever uses shame language ("you're falling behind"). Comeback bonus tested: a returning user after 5-day gap sees *exactly one* warm welcome, not a pile.

### 7.8 Insight Dashboard

**Purpose.** Self-awareness without judgment. Patterns the user can act on.
**Deficits.** Meta — supports all.

**Cards.**
- Best focus times (heatmap, hour-of-day).
- Avg session length trend.
- Mood × performance correlations ("focused longest on days you did Calm Zone in the morning").
- Optional inputs: medication taken, sleep hours, caffeine count. Never required.
- Weekly digest, AI-narrated by Claude.

**Mechanics.** All charts read top-to-bottom in <10s. No raw numbers without a sentence next to them. Toggle: "Show me the data" vs "Tell me what it means."

**Acceptance.** Dashboard loads <1s. Weekly digest delivered 9am Sunday local time, push opt-in.

### 7.9 Body Double Mode (live, post-MVP)

**Purpose.** Co-working accountability without social pressure.

**Mechanics.** Silent video rooms (4 people), optional commitment caption, 25-min default. No chat. Mute by default. End-of-session: optional "wave" emoji exchange.

**Safety.** Identity is first-name only. Report button. Auto-recordings off, ever.

**Acceptance.** Room joins in <3s. Bandwidth-aware (audio-out optional).

### 7.10 The AI Coach (cross-cutting)

The persistent AI layer is **not a chatbot home screen**. It's a quiet contextual assistant that:
- Picks the suggested next anchor each session.
- Decomposes tasks (Focus).
- Generates word/cloze/synonym content (Word Gym).
- Writes weekly insights and warm one-liners.
- Responds to RSD entries with validating, non-prescriptive language.
- Detects crisis signals and short-circuits to human resources.

A **chat affordance** exists ("Talk to Anchor") but is intentionally one tap deeper, not the home screen.

**Why two model providers.** Gemini Flash for high-volume, cheap, latency-sensitive classification (game difficulty signals, task category, brain-dump clustering). Claude Sonnet/Opus for empathy, decomposition, weekly narration, crisis-adjacent text. Routing is a server decision the client never sees.

---

## 8. AI Personalization Engine — Architecture

### 8.1 Goals
1. Pick the right tool at the right moment.
2. Adapt difficulty per game per user.
3. Make weekly insights feel written for *this* person.
4. Respond to emotional content with care and safety.

### 8.2 User-state model
A continuously updated `user_state` snapshot, persisted, recomputed on key events:

```
user_state {
  energy_level: 0..1                    // from session activity, time of day, self-report
  recent_focus_quality: 0..1            // last 7 days, weighted
  emotional_load: 0..1                  // mood check-ins, RSD log frequency, anxiety tools used
  cognitive_freshness: 0..1             // game RT variance, accuracy drift
  preferred_modalities: ranked list     // which tools moved their mood
  crash_window_local: hh:mm             // from onboarding + observed app-open patterns
  current_streak_state: enum            // building / steady / recovering
  consent_flags: { llm_text, voice, sensitive_logs }
}
```

### 8.3 Routing layer
- **Gemini Flash:** sub-second classification, embedding generation, brain-dump clustering, low-stakes content.
- **Anthropic Claude (Sonnet for default, Opus for weekly digests / hard decomposition / RSD response):** empathy, reasoning, multi-turn coaching, safety-critical text.
- The router is provider-agnostic at the interface; we keep both warm and can swap models without touching feature code.

### 8.4 Prompt patterns
- **Decomposition prompt** — system: "You are a coach for ADHD adults. Output JSON. First step must be ridiculously small (≤2 min)."
- **RSD response prompt** — system follows MIND-SAFE-style layering: validate → normalize → optional reframe → never advise medication → escalate on red-flag triggers.
- **Weekly insight prompt** — input: 7 days of metrics → output: 3 sentences, warm, specific, includes one number.

### 8.5 Safety
- **Crisis classifier** runs *before* any LLM response on free text. Hard-coded resource card path bypasses LLM entirely.
- **Output validators**: regex/JSON-schema check on every LLM response. Failures → fallback static content, not silent error.
- **Red-team set**: 200 prompts curated pre-launch covering crisis, manipulation, jailbreaks, factual edges (medication advice).
- **No PHI to model providers** in v1: pseudonymize user IDs; strip identifying detail; opt-in to "share recent context with AI."

### 8.6 Feedback loop
After any AI-generated content, a 1-tap "did this help?" (👍 / 🤷 / 👎). Aggregated into per-user preference weights. Not used for model fine-tuning in v1 (privacy posture).

---

## 9. Technical Architecture

### 9.1 Stack

| Layer | Choice | Rationale |
|---|---|---|
| Mobile / Web | **React** (Web) + **React Native / Expo** (iOS, Android) sharing a feature core | Single team, fastest path |
| State | TanStack Query + Zustand | Boring, proven |
| Styling | Tailwind + a small token layer | Theming + dark mode |
| Backend | **Python**, FastAPI, async | Best ML/AI ecosystem, team velocity |
| DB | **PostgreSQL 16** + pgvector | Relational + embeddings in one |
| Cache / queues | Redis + RQ (or Celery) | Standard |
| AI providers | Anthropic Claude + Google Gemini | Per §8.3 |
| Auth | Clerk *or* self-hosted Auth.js + magic links | No password by default |
| Observability | OpenTelemetry → Honeycomb / Grafana | LLM call tracing critical |
| Realtime (Body Double) | LiveKit | WebRTC, ADHD-light bandwidth profile |
| File / audio | S3-compatible (Cloudflare R2) | Cheap, reliable |
| CI/CD | GitHub Actions, Vercel (web), EAS (mobile) | Standard |

### 9.2 Service shape (modular monolith)

```
backend/
  app/
    api/                # FastAPI routers, one per module
    core/               # config, auth, telemetry
    domain/
      focus/
      games/
      vocab/
      calm/
      structure/
      rewards/
      insights/
    ai/
      router.py         # Gemini vs Claude selection
      prompts/          # versioned, tested
      safety/           # crisis classifier, validators
      personalization/  # user_state computation
    db/
      models.py         # SQLAlchemy
      migrations/       # Alembic
    workers/            # RQ tasks (nightly clustering, weekly digest)
  tests/
```

The "domain" layer holds business logic. API layer is thin. AI layer is a single seam — replaceable.

### 9.3 Database schema (high-level)

```
users(id, email, created_at, plan, consent_flags jsonb, prefs jsonb)
profiles(user_id, deficit_tags text[], crash_window time, vibe_pref enum)
focus_sessions(...)
game_sessions(...)
vocab_attempts(...)
vocab_personal_corpus(...)
regulation_sessions(...)
rsd_logs(... encrypted)
quests(...)
time_blocks(...)
time_estimates(...)
mood_checkins(user_id, ts, valence, arousal, note)
rewards_ledger(user_id, ts, source, xp, reason)
ai_messages(id, user_id, role, model, prompt_id, content, latency_ms, helpful enum)
user_state_snapshots(user_id, ts, snapshot jsonb)
embeddings(owner, kind, vector, payload jsonb)  -- pgvector
audit_log(...)
```

Encrypted-at-rest for `rsd_logs.trigger_text` and `ai_messages.content` flagged sensitive.

### 9.4 API conventions
- REST + JSON; one resource per module.
- Idempotency-Key header on POST.
- Versioned: `/v1/...`.
- Errors RFC 7807.
- All AI endpoints stream where it improves perceived latency.

### 9.5 Privacy & security
- HIPAA-readiness posture (not certified v1): encrypted at rest, TLS in transit, audit logging, principle-of-least-privilege.
- Account deletion: hard-delete in 30 days, with on-demand immediate option.
- Export: user can download all their data (JSON + CSV).
- Opt-in for any LLM call that includes user-authored text. Default off until consented.

### 9.6 Documentation policy (the user asked for this explicitly)
Every module ships with:
1. **README.md** — what it is, why it exists, deficit it serves.
2. **API.md** — endpoints, schemas, examples (auto-generated from FastAPI OpenAPI + hand-written rationale).
3. **ARCHITECTURE.md** — diagrams (mermaid) showing data flow.
4. **PROMPTS.md** — every prompt, version, rationale, test cases.
5. **DECISIONS.md** — ADRs (Architecture Decision Records).
6. **RUNBOOK.md** — incident & on-call playbook.
7. Storybook for every UI primitive.
8. Inline docstrings only for non-obvious why; the code itself explains what.

A `docs/` directory at repo root mirrors the structure: one folder per module, plus `docs/cross-cutting/` for AI, security, accessibility.

---

## 10. Build Phases

### Phase 1 — MVP (Weeks 1–10): the Core Loop
Goal: a person can use Anchor *every day* and feel a difference in week 1.

- Onboarding (§6).
- **Focus Engine** (Pomodoro + Task Decomposer + body-double sounds + distraction park).
- **Word Gym** (Tip-of-Tongue + Synonym Chains + personal corpus).
- **Calm Zone** (Breath Coach + 5-4-3-2-1 + RSD Interrupt + crisis safety).
- **Reward Loop** (XP, streaks-with-comeback, themes).
- AI: Claude for decomposition + RSD; Gemini for game-state classification stubs.
- Web (React) + iOS (Expo). Android in parallel.

### Phase 2 — Expand (Weeks 10–20)
- **Brain Games** (all 7 catalog items, adaptive difficulty).
- **Structure Hub** (planner, transition alerts, quick-capture, brain dump, time-reality).
- **Body Double Mode** (ambient sounds-only first; live rooms behind flag).
- Spotify integration (Energy Quests).

### Phase 3 — Intelligence (Weeks 20–30)
- **Insight Dashboard** with weekly Claude-narrated digest.
- **Energy Quests** with mood-delta personalization.
- Full AI personalization engine (user_state snapshots, ranked modality preferences).
- Live Body Double rooms (LiveKit).
- Caregiver/partner read-only share (post-MVP, opt-in).

### Phase 4 — Beyond (post-30 weeks)
- Wearable integration (Apple Watch — HRV → emotional load signal).
- Therapist hand-off mode (export sessions to a clinician).
- Localization (Spanish first).
- Regulatory exploration (FDA Class II as a digital therapeutic — long-horizon).

---

## 11. Metrics

### Activation
- Time to first action: target ≤ 90 sec.
- Day-1 retention: 60% target.

### Engagement
- DAU / MAU: ≥ 35% (consumer-mental-health benchmark is ~20%).
- Sessions per active day: 2.4 target (multi-tool app should beat 1).
- 7-day retention: 40%; 30-day: 22%.

### Outcome
- Self-reported focus improvement (1–10 weekly check-in) — target +1.5 points by week 4.
- Mood delta after Calm Zone tools (pre/post): ≥ +1 average.
- Task-decomposition acceptance rate: ≥ 70%.
- Game adaptive-band hit rate: 70–85% accuracy maintained.

### Safety
- Crisis-classifier recall on red-team set: 100%.
- AI-output validator failure rate: < 0.1%.

### Trust
- AI "helpful" 👍 rate: ≥ 75%.
- Account deletions per 1000 MAU: ≤ 5.

---

## 12. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Far-transfer claims for brain games over-promise | Frame as "skill + dopamine," not "make you smarter." Cite our own user data, not literature claims |
| LLM produces harmful response in crisis | Pre-LLM crisis classifier + hard-coded safety path. Red team. Human review of flagged logs |
| Privacy backlash on mental-health data | Local-first where possible, opt-in for LLM, transparent data export, on-device encryption for sensitive logs |
| Feature bloat overwhelms ADHD users | The home screen suggests *one* action. Modules unlock progressively. AI's job is to hide, not show |
| Latency on AI responses kills the moment | Stream all responses. Cache decompositions for similar tasks. Gemini for sub-second paths |
| Streaks become anxiety triggers | Comeback bonus, no breakage, opt-out toggle |
| Body Double live rooms become harassment vector | Silent-only, no chat, first-name, report button, slow rollout |
| Two providers = two outage surfaces | Each AI feature has a static fallback. App degrades, never breaks |

---

## 13. Open Questions

1. **Subscription model** — free 7-day trial, then $9.99/mo? Lifetime tier? Education discount? (Recommend: free core + paid AI personalization & live body doubling.)
2. **Diagnosis gating** — do we ever ask if the user is diagnosed? (Recommend: never *gate* on it, but offer optional self-report for personalization.)
3. **Therapist mode v1 or v2?** Strong differentiator if v1, but slows MVP.
4. **Native iOS vs Expo** — Expo for v1, native if performance requires.
5. **HIPAA certification** target — required for clinical partnerships, expensive. Defer to Phase 4 unless a B2B deal forces it.

---

## 14. Definition of Done — MVP

The MVP ships when:
- A new user can complete onboarding in <90s and start a focus session within the same minute.
- Focus, Word Gym, Calm Zone, Reward Loop are functional on Web + iOS.
- AI decomposition + RSD response paths pass red-team and are gated on a crisis classifier.
- All seven docs (README, API, ARCHITECTURE, PROMPTS, DECISIONS, RUNBOOK, plus Storybook) exist for each shipped module.
- 25 internal beta users have used the app for ≥ 7 days; ≥60% report meaningful daily use.
- p95 AI latency under 2.5s; p95 page load under 1s on mid-tier device.
- Privacy + safety review signed off.

---

## Appendix A — Game Implementation Detail (selected)

### A.1 Echo (n-back) — pseudocode

```
state: { N, sequence, currentIndex, hits, misses, falseAlarms, level }
each trial (every 2.5s):
  generate next stimulus (letter or grid position)
  display 500ms, blank 2000ms
  user can tap MATCH any time during the trial
  resolve trial:
    target = sequence[currentIndex - N] === sequence[currentIndex]
    if user_tapped && target → hit
    if user_tapped && !target → false_alarm
    if !user_tapped && target → miss
    if !user_tapped && !target → correct_rejection
  end of round (20 trials):
    accuracy = (hits + correct_rejections) / 20
    if accuracy > 0.85 for 3 rounds → N += 1
    if accuracy < 0.60 → N = max(1, N-1)
    persist game_session
```

### A.2 Switch (rule-switching) — pseudocode

```
rules: by_color | by_shape
trial:
  show card (color × shape)
  show rule cue (50% chance to switch)
  user sorts to one of two bins
  measure RT, correctness
  switch_cost = RT(switch) - RT(repeat)
session metrics: switch_cost (lower = better cognitive flexibility)
```

### A.3 Tip-of-Tongue Trainer — flow

```
1. Pick word from user's band (Daily/Familiar/Stretch/Rare)
2. Claude generates definition (cached if seen before)
3. User has 8s. Show shrinking bar.
4. If wrong / timeout: hint ladder
   a. first letter
   b. syllable count
   c. rhyme
5. Log latency, hints used, success
6. Update spaced-repetition queue (FSRS)
```

---

## Appendix B — Sample Prompts (versioned)

### B.1 Task Decomposition (`prompt://decompose@v1`)
> System: You are a coach for adults with ADHD. Decompose the user's task into 3–7 micro-steps. The first step must take ≤2 minutes and require zero decisions. Output strictly the JSON schema. Never moralize. Never mention ADHD unless the user does.
> Schema: `{ steps: [{ label: string, est_minutes: int, first: bool }], why_first_step_matters: string }`

### B.2 RSD Response (`prompt://rsd@v1`)
> System: A user has shared something painful. Respond in ≤3 short sentences. Validate first. Do not reframe unless they ask. Never give medication advice. Never minimize ("at least…"). End with one open offer, not advice. If the input contains crisis indicators, you MUST refuse to respond and the runtime will replace your output with a safety card.

### B.3 Weekly Insight (`prompt://insight-weekly@v1`)
> System: You are reading 7 days of one user's app data (input below as JSON). Write 3 sentences. Include exactly one number. Warm, not chirpy. No emojis unless the user's `vibe_pref` is `playful`.

---

*This PRD is a living document. Every claim above is testable; every feature traces to a deficit in §2.2; every word in the UI traces to the principles in §4. When in doubt, cut.*
