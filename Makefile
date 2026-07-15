.PHONY: dev dev-backend dev-frontend test test-backend test-frontend lint lint-backend lint-frontend

dev:
	@echo "Run backend and frontend in separate terminals:"
	@echo "  make dev-backend"
	@echo "  make dev-frontend"

dev-backend:
	cd backend && uv run uvicorn app.main:app --host 127.0.0.1 --port 8000

dev-frontend:
	cd frontend && npm run dev -- --host 127.0.0.1 --port 4173

test: test-backend test-frontend

# Mirrors CI: the full suite (needs Postgres + Redis running, e.g. `docker compose up -d db redis`).
test-backend:
	cd backend && uv run pytest -q

test-frontend:
	cd frontend && npm test

lint: lint-backend lint-frontend

lint-backend:
	cd backend && uv run ruff check . && uv run mypy app

lint-frontend:
	cd frontend && npm run lint && npx tsc -b --noEmit
