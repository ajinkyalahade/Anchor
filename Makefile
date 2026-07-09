.PHONY: dev dev-backend dev-frontend test test-backend test-frontend lint lint-backend lint-frontend

dev:
	@echo "Run backend and frontend in separate terminals:"
	@echo "  make dev-backend"
	@echo "  make dev-frontend"

dev-backend:
	cd backend && ./.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000

dev-frontend:
	cd frontend && npm run dev -- --host 127.0.0.1 --port 4173

test: test-backend test-frontend

test-backend:
	cd backend && ./.venv/bin/pytest tests/test_auth.py tests/test_onboarding.py tests/test_focus.py tests/test_games.py tests/test_calm.py tests/test_rewards.py tests/test_account.py tests/test_brain_games.py -q

test-frontend:
	cd frontend && npm test

lint: lint-backend lint-frontend

lint-backend:
	cd backend && ./.venv/bin/ruff check app tests

lint-frontend:
	cd frontend && npx tsc --noEmit -p tsconfig.app.json
