# Security And Privacy

Anchor handles mental-health-adjacent data, so privacy is a product requirement.

## Defaults

- No password-based auth in MVP.
- Anonymous users are allowed during onboarding.
- AI context sharing defaults to off.
- Crisis branch never calls an LLM.

## Sensitive Data Rules

Do not transmit unnecessary personally identifying data to model providers. Use the minimum
context needed for the feature.

Do not log:

- raw RSD trigger text
- auth tokens
- email magic-link secrets
- full prompt payloads containing user-entered personal details

## Crisis Safety

Free text that can reach an empathy response must pass through the crisis classifier first.
If crisis is detected, return the static resource card and skip all provider calls.

## Database

User-owned child rows should use `ondelete="CASCADE"` unless retention is explicitly required.
AI feedback can retain nullable `user_id` because analytics may outlive an account.

## Review Checklist

- New endpoint validates inputs with Pydantic.
- New POST endpoint has an idempotency story before production.
- New AI call has a static fallback.
- New sensitive field has a privacy note or encryption decision.
