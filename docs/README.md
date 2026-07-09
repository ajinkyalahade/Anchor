# Anchor Documentation

This directory documents the shipped MVP modules and cross-cutting concerns.

## Module Docs

- `modules/onboarding` - first-run profile setup and anonymous user creation
- `modules/home` - daily landing surface and AI next-anchor suggestion
- `modules/focus` - Pomodoro, task decomposition, and distraction capture
- `modules/word-gym` - 60-second word association game
- `modules/calm-zone` - breathwork, grounding, RSD interrupt, crisis safety, spiral stop
- `modules/rewards` - XP, streak state, comeback bonus, unlocks
- `modules/ai-layer` - routing, prompts, user state, feedback, privacy controls

Each module contains:

- `README.md` - purpose, user value, and owned code
- `API.md` - backend and frontend contracts
- `ARCHITECTURE.md` - data/control flow with Mermaid
- `PROMPTS.md` - AI prompts, validators, and fallback rules
- `DECISIONS.md` - implementation decisions and tradeoffs
- `RUNBOOK.md` - local verification and operational checks

## Cross-Cutting Docs

- `cross-cutting/AI.md`
- `cross-cutting/SECURITY.md`
- `cross-cutting/ACCESSIBILITY.md`

## Current Verification Baseline

- Backend tests: `cd backend && .venv/bin/pytest`
- Frontend lint: `cd frontend && npm run lint`
- Frontend build: `cd frontend && npm run build`
- Backend style: `cd backend && .venv/bin/ruff check .`

Backend Ruff is not fully clean yet; tests are the current strongest backend gate.
