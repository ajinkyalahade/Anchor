# AI Engine — Production Decision (AI-2)

_Status: **OPEN — requires a product/infra decision before launch.**_

## The problem

Anchor's core value is the AI layer (coach, task decomposition, RSD support,
weekly insights). In development it runs against a **local Ollama** model
(`qwen3.5:2b` at `host.docker.internal:11434`), and the Anthropic API key is
empty in every checked-in env file. Neither is a production answer:

- **Ollama on `host.docker.internal`** is a developer-laptop assumption. In any
  cloud environment there is no Ollama host, so the `auto`/`ollama` engine
  health check fails and every call falls back to canned responses.
- **No model/cost/latency decision** has been made for production traffic.

Until this is resolved, a deployed Anchor silently serves fallback text for its
most important features. That is now at least *observable* (see below), but the
underlying decision still has to be made.

## What was made safe in the meantime (shipped)

- **Fallback observability (AI-1):** every AI dispatch is counted; the
  fallback rate is exposed at `GET /v1/metrics/ai` and mirrored to an
  OpenTelemetry counter (`ai.calls` / `ai.fallbacks`). A rising
  `overall_fallback_rate` is the alert signal that the engine is failing.
- **Startup safety (SEC-3):** production refuses to boot with default secrets.

## Options to decide between

| Option | Pros | Cons |
|--------|------|------|
| **Anthropic API (hosted Claude)** | Highest quality; no model ops; already wired (`AnthropicEngine`). Recommended default for launch. | Per-token cost; data leaves infra (needs a DPA + consent gating — see DATA-4). |
| **Self-hosted Ollama (GPU node)** | Data stays in infra; flat cost. | Ops burden (GPU nodes, autoscaling); small models underperform on coach/RSD quality. |
| **Hybrid** (`auto`: local first, Anthropic fallback) | Cost control + a quality ceiling. | Two systems to run and monitor. |

## Recommended path

1. Launch on **Anthropic** (`AI_DEFAULT_ENGINE=anthropic`) with a real
   `ANTHROPIC_API_KEY`, since the engine is already implemented and needs no
   model ops.
2. Wire **consent gating** (DATA-4) before sending user text to an external
   provider.
3. Add an **alert** on `overall_fallback_rate > 0.05` over 5 minutes from
   `GET /v1/metrics/ai`.
4. Revisit self-hosting only if cost or data-residency requirements demand it.

## Action items (not yet done)

- [ ] Choose the production engine (owner: product + infra).
- [ ] Provision the corresponding secret/infra (`ANTHROPIC_API_KEY` or GPU node).
- [ ] Set `AI_DEFAULT_ENGINE` accordingly in the production environment.
- [ ] Add the fallback-rate alert to the monitoring stack.
- [ ] Consent gating before external AI calls (DATA-4).
