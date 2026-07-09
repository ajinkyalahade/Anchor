# Contributing to Anchor

## Development Workflow

1. Copy `.env.example` to `.env`
2. Start infrastructure with `docker compose up -d`
3. Run the backend from `backend/`
4. Run the frontend from `frontend/`
5. Make focused changes and verify them before opening a PR

Useful shortcuts:

```bash
make dev
make test
make lint
```

## Local Commands

Backend targeted tests:

```bash
cd backend
./.venv/bin/pytest tests/test_auth.py tests/test_onboarding.py tests/test_focus.py tests/test_games.py tests/test_calm.py tests/test_rewards.py tests/test_account.py tests/test_brain_games.py -q
```

Frontend checks:

```bash
cd frontend
npm test
npx tsc --noEmit -p tsconfig.app.json
npm run build
```

Secret scan:

```bash
./scripts/check-secrets.sh
```

## Pull Requests

- Keep PRs scoped to one feature area or one cleanup pass
- Include verification steps in the PR description
- If you change product behavior, explain the user-facing effect
- Do not mix unrelated refactors into feature or bugfix work

## Coding Standards

- Prefer small, readable units over broad rewrites
- Preserve existing product language that is supportive and non-shaming
- Label AI-powered surfaces clearly
- Add tests with the feature whenever practical
- Do not commit secrets, local build output, or personal environment data

## Test Expectations

- Frontend changes should keep `npm test`, `tsc --noEmit`, and `npm run build` green
- Backend changes should include targeted pytest coverage where possible
- If a repo-wide failing test or lint issue is pre-existing, note it clearly instead of hiding it

## Reporting Problems

- Use issues for bugs, regressions, and feature ideas
- Include repro steps, expected behavior, and actual behavior
- For security-sensitive issues, avoid posting secrets or exploit details publicly
