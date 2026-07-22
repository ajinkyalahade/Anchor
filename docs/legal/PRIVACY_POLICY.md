# Privacy Policy — Anchor

> **STATUS: DRAFT — NOT LEGAL ADVICE.** This document was drafted from the
> app's actual data practices to give counsel a concrete, accurate starting
> point. It must be reviewed and finalized by a qualified privacy attorney
> before Anchor is offered to the public. Bracketed `[[…]]` fields are
> operator/legal placeholders. Anchor handles mental-health–adjacent data, so
> jurisdiction-specific obligations (GDPR, UK GDPR, CCPA/CPRA, and — depending
> on how the service is marketed — HIPAA) must be assessed by counsel.

**Effective date:** `[[DATE]]`
**Data controller:** `[[LEGAL ENTITY NAME, ADDRESS]]`
**Contact / DPO:** `[[privacy@your-domain]]`

---

## 1. Who we are

Anchor is a companion app for adults with ADHD, anxiety, and
executive-function challenges. It provides an AI coach, task decomposition,
focus and calm tools, mood check-ins, and support for rejection-sensitive
dysphoria (RSD).

Anchor is **not a medical device and not a substitute for professional care.**
It does not diagnose or treat any condition. See §11 (Crisis situations).

## 2. What we collect

We collect only what the features you use require:

**You provide directly**
- **Account:** email address, first and last name, password (stored only as an
  argon2id hash — never in plaintext). Anonymous accounts may be created
  without an email.
- **Onboarding:** self-reported focus/executive-function challenge tags and a
  typical "crash window" time of day.
- **Coaching conversations:** the messages you send the AI coach.
- **Mood check-ins:** a mood value and an optional free-text note.
- **RSD support:** optional free-text trigger descriptions.
- **Focus/calm/games/quests:** session inputs, durations, and outcomes.

**Generated as you use Anchor**
- Rewards/XP ledger and unlockable state.
- Derived "user-state" snapshots (numeric energy/focus signals, not free text).
- AI-message metadata and optional feedback you give on AI responses.
- Push-notification subscription details (only if you enable notifications).

**Technical**
- A session token (in an httpOnly cookie), request logs, and standard
  operational telemetry needed to run and secure the service.

We do **not** sell your data and do **not** use it for advertising.

## 3. Sensitive data and how it is protected

Some content you enter is sensitive. The following free-text fields are
**encrypted at rest** with authenticated AES-256-GCM field encryption, separate
from full-disk encryption:
- coaching message content,
- mood check-in notes,
- RSD trigger text,
- AI feedback notes.

RSD logs are stored **pseudonymously** — they are never linked to your user id.

## 4. How we use your data

- To provide the features you request (coaching, focus, calm, mood, rewards).
- To personalize suggestions to your self-reported challenges and patterns.
- To keep the service secure (authentication, rate limiting, abuse prevention,
  audit logging of sensitive-data access).
- To operate and debug the service (aggregate metrics, error tracking).

We process this data to perform our contract with you and, where applicable,
on the basis of your **consent** (see §5) and our legitimate interest in
running a secure service. `[[Counsel to confirm lawful bases per jurisdiction.]]`

## 5. AI processing and your consent

Anchor's AI features are powered by **Anthropic's hosted Claude API**, a
third-party sub-processor. When you use an AI feature, the text needed to
answer that request is sent to Anthropic for processing.

**Consent gating.** Sharing your stored personal context — saved memories,
derived user-state, and session summaries — with the AI is governed by a
`share_ai_context` setting that is **OFF by default**. Unless you opt in, that
stored context is not included in AI prompts.

`[[Counsel/operator: confirm and link Anthropic's data-processing terms and
retention commitments; confirm no training on your data.]]`

## 6. Who we share data with (sub-processors)

We share data only with service providers that help us run Anchor, under
contract and only as needed:
- **Anthropic** — AI model processing (see §5).
- **`[[Hosting provider, e.g. Render]]`** — application hosting, managed
  database, and key-value store.
- **`[[Email provider]]`** — transactional email (e.g. password reset).
- **`[[Error tracking, e.g. Sentry — if enabled]]`** — crash/error reporting.

A current sub-processor list is maintained at `[[URL]]`. We do not otherwise
disclose your data except where required by law or to protect safety.

## 7. International transfers

Depending on where these providers operate, your data may be processed outside
your country. Where required, transfers are covered by appropriate safeguards
(e.g. Standard Contractual Clauses). `[[Counsel to complete.]]`

## 8. Data retention

- Your content is retained until you delete it or delete your account.
- **Account deletion** removes your account and cascades deletion of your
  associated content. You may delete immediately, or schedule deletion with a
  30-day grace period; scheduled deletions are executed automatically.
- Deleted data ages out of encrypted database backups on the hosting
  provider's snapshot schedule (currently ~7 days), after which it is gone
  from backups as well.
- Pseudonymous RSD logs are not linked to your identity and are not recoverable
  to you on deletion.

## 9. Your rights

Subject to your jurisdiction, you may have the right to access, correct,
export, delete, or restrict processing of your data, to object to processing,
and to withdraw consent. Anchor provides in-app **account deletion** and
**data export**. To exercise other rights, contact `[[privacy@your-domain]]`.
You may also lodge a complaint with your local data-protection authority.
`[[Counsel to tailor to GDPR/UK GDPR/CCPA as applicable.]]`

## 10. Security

We hash passwords with argon2id, encrypt sensitive free-text fields at rest,
serve all traffic over TLS with HSTS in production, scope sessions to httpOnly
cookies, rate-limit authentication, and log access to sensitive data. No system
is perfectly secure; we work to protect your data but cannot guarantee absolute
security.

## 11. Crisis situations

Anchor includes automated detection of crisis-related language and will surface
regional crisis resources. **This is not a monitoring or emergency service and
may not detect every situation.** If you are in danger or crisis, contact local
emergency services or a crisis line immediately. `[[List the resources shown
in-app and confirm regional coverage.]]`

## 12. Children

Anchor is intended for **adults** and is not directed to children under
`[[16/13 — per jurisdiction]]`. We do not knowingly collect data from children.

## 13. Changes

We may update this policy; we will post the new effective date and, for
material changes, notify you in-app or by email.

## 14. Contact

`[[LEGAL ENTITY]]` · `[[privacy@your-domain]]` · `[[postal address]]`
