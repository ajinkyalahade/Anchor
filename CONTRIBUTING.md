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

Backend (full suite, same as CI — needs Postgres + Redis via `docker compose up -d db redis`):

```bash
cd backend
uv run ruff check . && uv run mypy app && uv run pytest
```

Frontend checks:

```bash
cd frontend
npm run lint && npx tsc -b --noEmit && npm test && npm run build
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

- Every change ships with tests alongside the implementation
- Frontend changes keep `npm run lint`, `tsc -b`, `npm test`, and `npm run build` green
- Backend changes keep `ruff`, `mypy`, and the full `pytest` suite green (CI enforces a coverage floor)
- If a repo-wide failing test or lint issue is pre-existing, note it clearly instead of hiding it

## Reporting Problems

- Use issues for bugs, regressions, and feature ideas
- Include repro steps, expected behavior, and actual behavior
- For security-sensitive issues, avoid posting secrets or exploit details publicly
