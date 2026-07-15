# Anchor Documentation

Index of everything under `docs/`.

## Operations & status

- [`PRODUCTION_READINESS.md`](PRODUCTION_READINESS.md) — the production-readiness audit and its living checklist (steps 1–19 done; drives ongoing hardening work)
- [`DEPLOYMENT.md`](DEPLOYMENT.md) — Render deployment runbook: first deploy, verification, backup/restore drill, retention policy, key rotation
- [`AI_ENGINE_DECISION.md`](AI_ENGINE_DECISION.md) — why production AI runs on the hosted Anthropic API
- [`BUGS.md`](BUGS.md) — bug log from manual testing (stale — pending the FE-6 re-triage)

## Product

- [`product/PRD.md`](product/PRD.md) — the product requirements document
- [`product/AI_PERSONALIZATION_PLAN.md`](product/AI_PERSONALIZATION_PLAN.md) — the AI personalization roadmap

## Module docs

- `modules/onboarding` — first-run profile setup and anonymous user creation
- `modules/home` — daily landing surface and AI next-anchor suggestion
- `modules/focus` — Pomodoro, task decomposition, and distraction capture
- `modules/word-gym` — 60-second word association game
- `modules/calm-zone` — breathwork, grounding, RSD interrupt, crisis safety, spiral stop
- `modules/rewards` — XP, streak state, comeback bonus, unlocks
- `modules/ai-layer` — routing, prompts, user state, feedback, privacy controls

Each module contains:

- `README.md` — purpose, user value, and owned code
- `API.md` — backend and frontend contracts
- `ARCHITECTURE.md` — data/control flow with Mermaid
- `PROMPTS.md` — AI prompts, validators, and fallback rules
- `DECISIONS.md` — implementation decisions and tradeoffs
- `RUNBOOK.md` — local verification and operational checks

## Cross-cutting

- `cross-cutting/AI.md`
- `cross-cutting/SECURITY.md`
- `cross-cutting/ACCESSIBILITY.md`
- `cross-cutting/regulatory.md`

## UI

- `ui/STORYBOOK.md` — component workshop notes
- `ui/prototype/` — the original static HTML/JSX design prototype the app was built from (historical reference, not app code)

## Verification

Everything below must be green before merging (same gates as CI):

- Backend: `cd backend && uv run ruff check . && uv run mypy app && uv run pytest`
  (tests need Postgres + Redis: `docker compose up -d db redis`)
- Frontend: `cd frontend && npm run lint && npx tsc -b --noEmit && npm test && npm run build`

Or from the repo root: `make lint && make test`.
