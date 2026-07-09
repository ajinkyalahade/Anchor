# AI Layer Decisions

- Claude is used for nuanced coaching and empathy.
- Gemini is used for fast low-stakes validation.
- Static fallbacks are part of the feature contract, not an error afterthought.
- AI feedback stores hashes rather than raw content.
- Consent for sharing recent context defaults to off.

## Deferred

- Migrate from deprecated `google.generativeai` package to `google.genai`.
- Persist full provider audit logs with scrubbed payload metadata.
- Add idempotency around feedback writes.
