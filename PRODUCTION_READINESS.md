# Anchor — Production Readiness Audit

_Date: 2026-07-08 · Method: full code review + running lint/typecheck/test suites. Every issue below was verified against the current code, not assumed. Complements (does not duplicate) `BUGS.md` from 2026-05-22 — several of those are now fixed (e.g. BUG-004 greeting, BUG-006 distraction seeds); the rest should be re-verified._

**Severity key:** 🔴 Critical (blocks launch) · 🟠 High (fix before real users) · 🟡 Medium · ⚪ Low

---

## 1. Critical blockers (fix first, in this order)

| # | Issue | Category |
|---|-------|----------|
| C1 | **The project is not a git repository.** No version control, no history, no rollback — and all four GitHub Actions workflows have never run. | Infra |
| C2 | **Account-deletion IDOR** — any authenticated user (including throwaway anonymous accounts) can permanently delete *any* user by UUID. | Security |
| C3 | **Idempotency cache leaks responses across users.** | Security |
| C4 | **No production secret enforcement** — app boots happily with `change-me-in-production` JWT secret and an all-zeros AES key. | Security |
| C5 | **No rate limiting on auth endpoints** — unlimited login brute-force and unlimited unauthenticated account creation. | Security |
| C6 | **Frontend "production" container runs the Vite dev server**; there is no production serving story at all. | Infra |
| C7 | **CI is red everywhere**: ruff 56 errors, mypy 59 errors, tsc fails, eslint 7 errors, backend 16 test failures, frontend 4 test failures. | Testing |

Details for each are in the sections below.

---

## 2. Infrastructure / DevOps

### 🔴 INF-1 · No git repository
The folder has no `.git`. `.github/workflows/` (ci, backend, frontend, secrets) exist but have never executed. First step of productionization: `git init`, initial commit, push to GitHub. Before the first commit, make sure `.gitignore` also covers `.playwright-mcp/`, `frontend/debug-storybook.log`, and decide what to do with `creds.md` (see SEC-8).

### 🔴 INF-2 · Frontend Dockerfile ships the dev server
`frontend/Dockerfile:12` — `CMD ["npm", "run", "dev", ...]`. That is Vite's development server: no minification, HMR websockets, source maps, slow, not hardened. Needs a multi-stage build (`npm run build` → nginx/caddy static serving) **plus** a reverse proxy that forwards `/v1` to the backend, because the entire frontend API client uses a relative `/v1` base (`frontend/src/lib/api.ts:7`) that only works today through Vite's dev proxy (`vite.config.ts:44-49`). The `VITE_API_URL` env var in docker-compose only configures the dev proxy — it is not baked into any build.

### 🟠 INF-3 · Backend container runs as root and runs migrations on every start
`backend/Dockerfile` — no `USER` directive, and `CMD` chains `alembic upgrade head` before uvicorn. With >1 replica this races two concurrent migrations. Migrations should be a separate deploy step/job. Also: single uvicorn process, no `--workers`/process manager decision documented.

### 🟠 INF-4 · docker-compose is dev-only but looks deployable
- Secrets hardcoded: `POSTGRES_PASSWORD: anchor_dev`, `JWT_SECRET: change-me-in-production` (`docker-compose.yml:8,38-39`).
- Postgres (5432) and Redis (6379) published to the host — on a server these become internet-exposed, and Redis runs with no password.
- Backend depends on Ollama at `host.docker.internal:11434` — a laptop-only assumption; there is no answer for what serves AI in production (see AI-2).
- No resource limits, no restart policies, no worker service (see BE-6).

### 🟠 INF-5 · No deployment story
No production compose/K8s/hosting config, no TLS/domain handling, no CD pipeline, no release/versioning process (version hardcoded as `0.1.0` in both `main.py:28` and `health.py`). No database backup or restore procedure exists anywhere.

### 🟡 INF-6 · Duplicate CI workflows
`ci.yml` duplicates `backend.yml` + `frontend.yml` — every PR runs the backend and frontend jobs twice. Consolidate into one workflow. Also, backend CI has no Postgres service container, and the test suite requires one (see TEST-1), so backend CI can never pass as written.

### 🟡 INF-7 · Makefile only runs a subset of backend tests
`Makefile:17` hand-picks 8 test files; 18 other test files (idempotency, rate-limit, crisis red-team, e2e…) are skipped locally. `make test` passing gives false confidence.

---

## 3. Security & Auth

### 🔴 SEC-1 · IDOR: anyone can delete any account
`backend/app/api/account.py:90-129` — `POST /v1/account/deletion` takes `user_id` **from the request body** and deletes that user. The router requires *a* valid token (`main.py:76`), but never checks the token's user matches `payload.user_id` — and `/v1/auth/register-anonymous` hands a valid token to anyone. Immediate mode does `db.delete(user)` on the spot. Fix: derive the target from `CurrentUserId`, drop `user_id` from the payload.

### 🔴 SEC-2 · Idempotency responses shared across users
`backend/app/core/idempotency.py:108` — cache key is `path + Idempotency-Key` only. If two users send the same key to the same endpoint (keys are client-generated, so collisions/abuse are trivial), the second user receives the first user's stored response body — in a mental-health app this is a serious data leak. Scope the key by authenticated user id.

### 🔴 SEC-3 · Production runs with dev secrets unless someone remembers
- `config.py:38-39` — `jwt_secret` / `magic_link_secret` default to `change-me-in-production`; nothing validates `APP_ENV=production` implies real secrets.
- `encryption.py:20-23` — empty/invalid `FIELD_ENCRYPTION_KEY` silently falls back to a **32-byte zero key**, so "encrypted" RSD trigger texts are decryptable by anyone. Add a startup check: in production, refuse to boot with default JWT secret, missing encryption key, or `app_debug=true`.

### 🔴 SEC-4 · Auth endpoints have no rate limiting
`build_rate_limit_dependency` is only applied to three AI endpoints (`ai.py`, `calm.py`, `focus.py`). `/v1/auth/login` allows unlimited password guessing; `/v1/auth/register`, `/v1/auth/register-anonymous`, and `/v1/onboarding` allow unlimited unauthenticated row creation (DB-fill DoS). Note the limiter depends on `CurrentUserId`, so it structurally *can't* protect unauthenticated routes — needs an IP-based variant.

### 🟠 SEC-5 · Token model isn't production-grade
- JWT stored in `localStorage` (`api.ts:16-28`) → exfiltratable by any XSS. The backend *sets* an `httpOnly` cookie (`auth.py:200-209`) but **never reads it** — auth is bearer-header only (`deps.py:13`), so the secure cookie is dead code.
- 7-day access tokens (`core/auth.py:14`) with no refresh tokens and no server-side revocation: a stolen token works for a week and logout is purely client-side (there is no logout endpoint at all).
- No password reset / forgot-password flow, no email verification, no email sending capability anywhere in the codebase (magic-link tables/helpers exist but nothing can deliver a link).

### 🟠 SEC-6 · Weak credential rules
`auth.py:36` — password min length 6, no other checks. Email validation is a hand-rolled `"@" in value` check (`auth.py:38-44`); use `email-validator` / pydantic `EmailStr`.

### 🟠 SEC-7 · Missing security headers, permissive CORS
`security_headers.py` sets only 3 headers. No `Strict-Transport-Security`, no `Content-Security-Policy` (nothing serves one for the frontend either), no `Permissions-Policy`. CORS uses `allow_methods=["*"], allow_headers=["*"]` with `allow_credentials=True` (`main.py:37-43`).

### 🟠 SEC-8 · Credentials and secrets hygiene
- `creds.md` sits in the repo root with a plaintext test password — will be committed the moment git is initialized.
- `scripts/check-secrets.sh` only matches `sk-ant-`, `AIza`, and PEM keys — misses JWT secrets, DB URLs with passwords, OpenAI-style keys, etc. Consider `gitleaks` or `trufflehog` in CI instead.

### 🟡 SEC-9 · Hand-rolled JWT encoder
`core/auth.py:85-96` implements JWT signing manually while `deps.py` uses PyJWT to decode. It works today, but two implementations of the same primitive invite drift; PyJWT is already a dependency — use it for both. Similarly, scrypt-based hashing is serviceable, but `argon2-cffi`/`bcrypt` are the boring, audited choice.

### 🟡 SEC-10 · Audit log can't attribute anything
`core/audit.py` logs method/path/status but **no user id**, so the "sensitive data access" audit trail cannot answer "who accessed what" — its whole purpose.

---

## 4. Backend

### 🟠 BE-1 · AI router swallows every failure silently
`ai/router.py:202-204` — any exception (provider outage, bad API key, JSON parse failure) returns a canned fallback with only a `logger.warning`. Users get generic responses indefinitely and nobody is alerted; a total Anthropic outage is invisible. At minimum: a metric/alert on fallback rate, and distinguish "provider down" from "bad output".

### 🟠 BE-2 · In-memory idempotency store grows forever
`main.py:32` creates `app.state.idempotency_store = {}` and `idempotency.py:85` writes every keyed POST response into it with **no eviction or TTL** (the Redis copy has a 24h TTL; the dict never expires). Long-lived processes leak memory proportional to traffic. Also per-process, so replays are inconsistent across workers when Redis is down.

### 🟠 BE-3 · Rate limiter permanently degrades on one Redis blip
`rate_limit.py:43-44` — a single Redis exception sets `self._redis = None` forever (no reconnect), silently switching to per-process memory where limits multiply by worker count. Reconnect with backoff, and log loudly on degradation.

### 🟠 BE-4 · Every request commits; SQL echo tied to debug default
`db/database.py:28-38` — `get_db` commits on *every* request including GETs (masks missing explicit transaction boundaries), and `echo=settings.app_debug` with `app_debug: bool = True` default means full SQL (including sensitive values) is logged unless someone flips the flag. No pool sizing configured (`pool_size`/`max_overflow` defaults) for production load.

### 🟠 BE-5 · Settings/engine created at import time
`database.py:8`, `ai/router.py:16` call `get_settings()` at module import, and `config.py:58` loads `env_file: "../.env"` **relative to the CWD** — running the app from any directory other than `backend/` silently loses the env file. Prefer env vars in deployment and lazy settings access.

### 🔴 BE-6 · Background work never runs: scheduled deletions are never executed
There is no worker service anywhere (docker-compose has none; `rq` is a dependency but nothing enqueues or runs it). Consequences:
- "Scheduled" account deletions (`account.py:99-117`) create a `pending` row that **nothing ever processes** — users who requested deletion are never deleted (GDPR/DSR violation).
- `nudge_worker.py` ("designed to be called every 30 min via RQ or cron") is never invoked, so proactive nudges are dead code.

### 🟡 BE-7 · Lint/type debt
`ruff check .` → 56 errors; `mypy app` (strict, as CI runs it) → 59 errors in 20 files. Both are CI gates, so this is launch-blocking via C7 even though individually minor.

### 🟡 BE-8 · Config drift and dead settings
- `GOOGLE_AI_API_KEY` exists in `.env`/`.env.example` but no setting consumes it (the Gemini path referenced in older docs is gone).
- `.env` sets `AI_DEFAULT_ENGINE=ollama` with `qwen3.5:2b`, while the code default is `anthropic` — see AI-2 for the production question this hides.
- `wearable.py:41` checks `if header_user_id is None` after a dependency that can never return None — dead code hinting at a refactor remnant.

### 🟡 BE-9 · API docs exposed
`main.py:29-30` serves Swagger/OpenAPI at `/v1/docs` unconditionally. Decide deliberately whether the production API surface should be public; gate behind `app_env` if not.

---

## 5. Frontend

### 🟠 FE-1 · Quality gates all failing
- `tsc -b`: fails (`CoachPage.tsx:13` unused `CoachSession`).
- `eslint`: 7 errors, 1 warning (`set-state-in-effect` in `GamesPage.tsx:138`, `no-explicit-any` in `OnboardingPage.tsx:170`, etc.).
- `vitest`: 4 of 17 tests fail in 3 files (e.g. `HomePage.test.tsx:99` expects `42 XP` that never renders — either regression or stale test).

### 🟠 FE-2 · Auth/session handling
- JWT in `localStorage` (see SEC-5).
- Any 401 triggers `window.location.href = '/login'` (`api.ts:69,86`) — a full page reload that destroys all in-progress state (mid-breathing-exercise, mid-focus-session). For this audience that's a jarring failure mode; handle expiry with an in-app redirect and preserve state.
- `first_name` for the greeting comes from `localStorage` (`HomePage.tsx:38`), not the profile API — wrong name on a second device, stale after profile edits.

### 🟠 FE-3 · No production API base URL mechanism
`api.ts:7` hardcodes `BASE_URL = '/v1'`; works only behind a proxy that maps `/v1` → backend. Fine as an architecture *if* INF-2's reverse proxy is built; today nothing provides it outside `vite dev`.

### 🟡 FE-4 · i18n is partial
i18next with `en`/`es` locales exists, but user-facing strings are hardcoded in components (`App.tsx:104` "Skip to main content", `App.tsx:112` offline banner, `RouteLoader`, error boundary copy…). Either commit to i18n coverage or drop the second locale until it's real — a half-Spanish UI is worse than none. (Crisis-flow language coverage is a safety issue — see AI-3.)

### 🟡 FE-5 · PWA/service worker review needed before launch
`sw.ts` precaches all JS/CSS/HTML and uses `NetworkFirst` for navigation (good), but there's no offline fallback route for failed API calls, and push handling assumes VAPID keys that are unset in every env file. Verify update flow (`SKIP_WAITING`) actually gets triggered by the UI, or stale bundles will linger.

### 🟡 FE-6 · Residual known bugs
Re-verify the still-open items in `BUGS.md` (BUG-005 timeline placeholder, BUG-007 inconsistent stats, BUG-009 manual insights entry, BUG-010 sidebar highlight, BUG-012 heatmap, BUG-013/014/015). Spot checks show some fixed (BUG-004, BUG-006) — the file needs a triage pass so it reflects reality.

### ⚪ FE-7 · Repo clutter shipped with the frontend
`debug-storybook.log`, `.playwright-mcp/` (dozens of screenshots/logs), `.DS_Store` — add to `.gitignore` before the first commit.

---

## 6. AI & Safety

### 🟠 AI-1 · Silent AI degradation (see BE-1)
Because `route()` returns hardcoded fallbacks on any error, the *coach*, *RSD support*, and *decompose* features can all silently degrade to canned text with zero alerting. For a product whose core value is the AI, fallback-rate must be a first-class monitored metric.

### 🟠 AI-2 · No production AI engine decision
Dev runs on local Ollama (`qwen3.5:2b` via `host.docker.internal`); the Anthropic key is empty in every env file. There is no answer for "what model serves production traffic, at what cost, with what latency" — and the docker-compose backend will fail `auto`/`ollama` health checks in any cloud environment. This is a product/infra decision that blocks launch.

### 🟠 AI-3 · Crisis classifier is English-only regex
`ai/safety/classifier.py` — regex keyword list, English only, while the app ships a Spanish locale. A Spanish-speaking user writing "quiero morirme" sails past the crisis layer straight to the LLM. The file's own comment says a real classifier is needed for production. Also, crisis resources are US/Canada/UK-only phone numbers regardless of the user's locale/region.

### 🟡 AI-4 · Prompt-injection surface
`input_safety.py` only strips control characters. User text, stored memories, and session summaries are concatenated directly into system prompts (`router.py:36-57, 272`). A user can plant instructions in their own "memories" that later steer the coach. Low direct blast radius (single-user context), but worth adversarial testing before launch, especially around the crisis/safety behaviors.

### 🟡 AI-5 · Brittle JSON parsing of model output
`router.py:257-263` `_parse_json` string-splits on code fences and `json.loads`. Failures route to fallbacks (masking issues per AI-1). Consider Anthropic tool-use/structured outputs for reliability.

---

## 7. Data, Privacy & Compliance

### 🔴 DATA-1 · Deletion pipeline doesn't work end-to-end (see BE-6)
Scheduled deletions are recorded but never executed. Also verify cascade behavior of immediate `db.delete(user)` across all 15+ related tables (rewards, snapshots, AI messages, RSD logs…) — orphaned mental-health data after "deletion" is a compliance incident.

### 🟠 DATA-2 · Sensitive data mostly unencrypted at field level
`encrypt_text` is used for exactly two fields: RSD trigger text (`calm.py:53`) and AI feedback notes (`ai.py:609`). Coach conversation content, mood check-ins, profile deficit tags, and user-state snapshots are plaintext. Decide the encryption boundary deliberately (maybe disk-level encryption is your answer — but then the zero-key AES theater should go).

### 🟠 DATA-3 · No backups, no retention policy
No backup/restore procedure, no data-retention policy, no privacy policy / ToS documents, no data export beyond the client-side `lib/export.ts`. For a health-adjacent app storing crisis-related text, this needs to exist before real users.

### 🟡 DATA-4 · `consent_flags` exists but nothing enforces it
`models.py:39` has a `consent_flags` JSONB on User; no code path reads it before processing data through external AI providers.

---

## 8. Testing & CI

### 🔴 TEST-1 · Backend suite requires a live local Postgres and still fails
`uv run pytest`: **16 failed / 158 passed**. Two failure classes:
1. Tests hitting a real DB at `localhost:5432` (connection refused when compose isn't up) — tests aren't hermetic, and CI has no Postgres service, so CI can never pass.
2. Genuine assertion drift, e.g. `test_focus.py:31` expects fallback step `"Open the document"` but the code now returns `"Open the file or app"` — tests weren't updated with the code.

### 🟠 TEST-2 · Frontend suite failing
4/17 tests failing (HomePage XP rendering among them) — either real regressions or stale tests; each needs triage.

### 🟡 TEST-3 · Coverage gaps
No coverage measurement anywhere. No E2E tests in CI (Playwright was used manually per `BUGS.md`, never automated). Security-critical paths (idempotency cross-user scoping, deletion authorization) have no tests — which is exactly why SEC-1/SEC-2 survived.

---

## 9. Observability & Operations

### 🟠 OBS-1 · No error tracking or alerting
OpenTelemetry scaffolding exists (good) but is a no-op without `OTLP_ENDPOINT`, and there's no Sentry-equivalent, no alerting rules, no dashboard, no on-call story. Combined with BE-1/AI-1's silent fallbacks, a production outage would be discovered by users, not operators.

### 🟡 OBS-2 · Logging isn't production-shaped
No logging configuration at all (no level, format, or JSON structure — relies on uvicorn defaults). `request_logging` + `audit` + SQL echo overlap. Define one structured logging setup with request-id propagation (audit middleware generates an `X-Request-Id` but the request logger doesn't share it).

### 🟡 OBS-3 · Health endpoint is decent — wire it up
`/v1/health` checks DB and Redis properly. Use it for real liveness/readiness probes in whatever deploy target is chosen; note Redis "degraded" still returns HTTP 200 with `status: degraded` — make sure orchestration reads the body or split live/ready endpoints.

---

## 10. Docs & repo hygiene

- ⚪ `pyproject.toml:4` — `description = "Add your description here"`.
- ⚪ `docs/README.md` is a stub; no API docs, no architecture doc, no runbook, no `CHANGELOG`.
- ⚪ `BUGS.md` is 7 weeks stale (see FE-6).
- ⚪ Root `.DS_Store`, `.playwright-mcp/` artifacts, `frontend/debug-storybook.log` — gitignore before first commit.
- ⚪ `check-secrets.sh` allowlists a `PRODUCTION_PLAN.md` that doesn't exist.

---

## Suggested order of attack

- [x] 1. **`git init` + first commit** (after fixing `.gitignore` and removing `creds.md`) — nothing else is safe to change without version control. _(C1)_ ✅ 2026-07-08: repo initialized on `main`; `.gitignore` extended (creds.md, .playwright-mcp/, storybook-static/, .tmp-*/, caches); removed empty nested `backend/.git` and stray empty `app/domain/rewards/service.py`; 312 files committed, verified no secrets/artifacts tracked.
- [x] 2. **Fix the two auth/data vulnerabilities**: deletion IDOR (SEC-1) and idempotency user-scoping (SEC-2). ✅ 2026-07-08: deletion now always targets the token's user (`user_id` removed from payload + frontend); idempotency keys scoped by hashed bearer credentials. Regression tests added; both suites green (commit 74c4266).
- [x] 3. **Startup config validation**: refuse to boot in production with default secrets / zero encryption key / debug on (SEC-3). ✅ 2026-07-08: `Settings` model validator aborts boot on insecure production config; encryption module refuses zero-key fallback in production. 12 new tests; verified boot failure/success both ways.
- [x] 4. **Make CI green**: fix ruff/mypy/tsc/eslint debt, make backend tests hermetic, fix stale assertions, dedupe workflows (C7, TEST-1/2, INF-6). ✅ 2026-07-09: backend 0 ruff / 0 mypy / 188 tests pass (session-scoped loop + real-user helper; stale tests updated); frontend 0 eslint / clean tsc / 17 tests / build OK. Single `ci.yml` with Postgres+Redis services and an alembic step; removed duplicate workflows. Also fixed the SEC-1-sibling IDOR in `/rewards/grant` and `/rewards/unlocks/activate`. Commit e52d732 pushed.
- [x] 5. **Production serving**: frontend build + reverse proxy, non-root backend image, migrations as a deploy step, worker process for deletions/nudges (INF-2/3, BE-6). ✅ 2026-07-09: multi-stage nginx frontend proxying `/v1`; non-root backend image with migrations removed from CMD; one-shot `migrate` service + long-running `worker` (nudges + due account deletions). Verified end-to-end via docker compose (migrate exit 0, non-root, proxy 200, worker running). Commit pushed.
- [~] 6. **Auth hardening**: rate-limit auth routes, refresh/revocation or shorter tokens, logout endpoint, password reset + email delivery (SEC-4/5). ✅ 2026-07-09 (core done): IP rate limiting on login/register/register-anonymous (verified live: 5×201 then 429); `/auth/logout` clears the session cookie (verified); frontend sign-out fixed; password min length 6→8. **Still open** (needs a product/infra decision): refresh-token rotation + JWT denylist revocation, and password-reset flow with an email-provider integration. Commit pushed.
- [~] 7. **Decide the production AI engine + add fallback-rate alerting** (AI-1/2), then the crisis-classifier language gap (AI-3). ✅ 2026-07-09: AI-3 crisis classifier now covers Spanish (verified live: `quiero morirme` → is_crisis; +international resource); AI-1 fallback metrics at `GET /v1/metrics/ai` + OTel counters (verified recording). **AI-2 still open by design** — the production engine choice is a product/infra decision, documented with a recommendation in `docs/AI_ENGINE_DECISION.md`. Commit pushed.
- [ ] 8. Observability baseline: error tracking, structured logs, OTLP wired to something (OBS-1/2).
