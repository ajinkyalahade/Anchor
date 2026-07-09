# Home Prompts

Home does not directly call a model. It consumes deterministic suggestion output produced from
computed user state.

If future suggestions use an LLM, the response must still be one action only and must have a static
fallback.
