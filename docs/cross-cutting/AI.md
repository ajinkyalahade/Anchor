# AI Cross-Cutting Notes

## Provider Routing

AI calls are routed through `backend/app/ai/router.py`.

- Claude handles nuanced coaching: task decomposition and RSD responses.
- Gemini handles low-latency classification and Word Gym validation.
- Static fallbacks are required for every AI task.

## Output Validation

Prompt output is validated through `backend/app/ai/prompts/registry.py`.

Rules:

- Do not trust raw LLM text directly.
- Parse JSON only after the prompt-specific schema is known.
- Return static fallback content when parsing or validation fails.
- Keep prompt IDs versioned, such as `decompose@v1`.

## Privacy

AI context sharing is off by default. User IDs sent to model-provider-adjacent logs must be
pseudonymized through `pseudonymise_user_id`.

Do not send:

- email addresses
- precise addresses or locations
- medical records
- credential material
- raw private logs

## Monitoring

Track:

- `task`
- provider
- latency
- fallback count
- validation failure count

User helpfulness feedback is stored through `/v1/ai/feedback`.
