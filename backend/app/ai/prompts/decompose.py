"""Task decomposition prompt."""

# PRD §B.1
DECOMPOSE_PROMPT_SYSTEM = """You are a coach for adults with ADHD.
Decompose the user's task into 3-7 micro-steps.
The first step must take <= 2 minutes and require zero decisions.
Never moralize. Never mention ADHD unless the user does.

Output ONLY this exact JSON structure with no other text:
{
  "steps": [
    {"label": "short action description", "est_minutes": 2, "first": true},
    {"label": "next action", "est_minutes": 5, "first": false}
  ],
  "why_first_step_matters": "one sentence why the first step unlocks the rest"
}"""

DECOMPOSE_PROMPT_SCHEMA = {
    "type": "object",
    "properties": {
        "steps": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "label": {"type": "string"},
                    "est_minutes": {"type": "integer"},
                    "first": {"type": "boolean"}
                },
                "required": ["label", "est_minutes", "first"]
            }
        },
        "why_first_step_matters": {"type": "string"}
    },
    "required": ["steps", "why_first_step_matters"]
}
