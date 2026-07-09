# Anchor

![Frontend](https://github.com/your-org/anchor/actions/workflows/frontend.yml/badge.svg)

Anchor is an ADHD companion for the moments that usually slip away first: starting a task, staying with it long enough to build traction, calming an overload spiral, and recovering without shame when the day goes sideways. It combines lightweight structure, short nervous-system resets, simple cognitive games, and AI-assisted suggestions into a single app surface that is designed to feel supportive rather than punitive.

The project is built as a practical daily tool, not a productivity dashboard. The core product idea is that momentum is easier to protect when the next helpful action is obvious, the interface stays calm, and the app reflects how ADHD actually feels in real life: inconsistent, state-dependent, and very sensitive to friction.

## Features

### Focus
- AI task decomposition for turning a large task into smaller starting steps
- ADHD-friendly timer with a circular progress anchor
- Distraction parking so off-topic thoughts do not have to win

### Games
- Short cognitive games grouped by memory, attention, flexibility, and impulse control
- Word Gym with AI-assisted scoring
- Lightweight session feedback for building consistency instead of pressure

### Calm
- Guided breathing and grounding tools
- RSD support flow with crisis screening before AI responses
- Ambient sound and calm-state tools for quick resets

### Insights
- XP and streak tracking with gentle reward framing
- Personalized next-step suggestion on Home
- Unlocks, profile state, and weekly-pattern groundwork

### AI surfaces
- AI-supported features are visibly labeled in the UI
- Expensive AI endpoints are rate-limited and input-sanitized
- Suggestion responses are cached to reduce cost and latency

## Coming Soon
- Live body-double rooms behind a feature flag
- Deeper coaching memory and history
- Richer personalization feed based on state and usage patterns
- Expanded export/share and digest flows

## Project Structure

- `frontend/`: React + Vite application
- `backend/`: FastAPI application
- `shared/`: shared project assets
- `docs/`: supporting notes and documentation

## Local Setup

1. Copy the template env file:

```bash
cp .env.example .env
```

2. Start the full local stack:

```bash
docker compose up -d --build
```

3. Or, if you prefer running the app processes outside Docker, start the backend:

```bash
cd backend
./.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
```

4. Start the frontend:

```bash
cd frontend
npm run dev -- --host 127.0.0.1 --port 4173
```

5. Open:
- App: `http://127.0.0.1:4173`
- API: `http://127.0.0.1:8000`

You can also use the convenience targets:

```bash
make dev
make test
make lint
```

## Environment Variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes | Postgres connection string for the backend |
| `REDIS_URL` | Yes | Redis connection string for caching and rate limiting |
| `JWT_SECRET` | Yes | JWT signing secret |
| `MAGIC_LINK_SECRET` | Yes | Secret for one-time auth token hashing |
| `FIELD_ENCRYPTION_KEY` | Yes | Base64-encoded key for sensitive field encryption |
| `APP_ENV` | No | Environment name such as `development` or `production` |
| `APP_DEBUG` | No | Backend debug toggle |
| `CORS_ORIGINS` | No | Comma-separated allowed frontend origins |
| `ANTHROPIC_API_KEY` | No | Claude-backed AI features |
| `GOOGLE_AI_API_KEY` | No | Gemini-backed AI features |
| `OTLP_ENDPOINT` | No | OpenTelemetry collector endpoint |
| `OTLP_SERVICE_NAME` | No | Telemetry service name |
| `METRICS_ENABLED` | No | Metrics toggle |
| `VAPID_PRIVATE_KEY` | No | Web push private key |
| `VAPID_PUBLIC_KEY` | No | Web push public key |
| `VAPID_CONTACT_EMAIL` | No | Contact email for push configuration |
| `LIVEKIT_URL` | No | LiveKit server URL |
| `LIVEKIT_API_KEY` | No | LiveKit API key |
| `LIVEKIT_API_SECRET` | No | LiveKit API secret |
| `VITE_VAPID_PUBLIC_KEY` | No | Frontend push-notification public key |
| `VITE_ENABLE_LIVE_BODY_DOUBLE_ROOMS` | No | Enables live-room UI shell |

## Observability

Anchor emits structured JSON logs and OpenTelemetry traces. To add error monitoring with Sentry:

1. Install the SDK:
   ```bash
   # Backend
   uv add sentry-sdk[fastapi]
   # Frontend
   npm install @sentry/react
   ```

2. Set the env var:
   ```
   SENTRY_DSN=https://<key>@o<org>.ingest.sentry.io/<project>
   ```

3. Backend — initialize in `backend/app/main.py` before the app is created:
   ```python
   import sentry_sdk
   sentry_sdk.init(dsn=os.getenv("SENTRY_DSN"), traces_sample_rate=0.2)
   ```

4. Frontend — wrap the app in `frontend/src/main.tsx`:
   ```ts
   import * as Sentry from "@sentry/react";
   Sentry.init({ dsn: import.meta.env.VITE_SENTRY_DSN, tracesSampleRate: 0.2 });
   ```

Without a DSN set, neither SDK activates — safe to deploy without Sentry.

---

## Verification

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

## Contributing

See [CONTRIBUTING.md](/Users/alai/Documents/Projects/Anchor/CONTRIBUTING.md) for development workflow, test expectations, and PR guidelines.

## Code of Conduct

See [CODE_OF_CONDUCT.md](/Users/alai/Documents/Projects/Anchor/CODE_OF_CONDUCT.md).

## License

This project is released under the MIT License. See [LICENSE](/Users/alai/Documents/Projects/Anchor/LICENSE).
