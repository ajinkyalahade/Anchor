"""Crisis safety layer for catching self-harm, harm to others, or severe distress."""

import re

# In a real production system, this would be a combination of rules,
# embeddings search, and a fast classifier like Gemini Flash or a fine-tuned BERT model.
# For MVP, we use aggressive regex patterns.

CRISIS_KEYWORDS = [
    # Suicidal ideation — direct
    r"\b(suicide|suicidal)\b",
    r"\b(kill myself|killing myself)\b",
    r"\b(want to die|wish I was dead|want to be dead|wish I were dead)\b",
    r"\b(end(?:ing)? my life|end(?:ing)? it all|end(?:ing)? it)\b",
    r"\b(better off dead|better off without me)\b",
    # Self-harm — present and past tense
    r"\b(hurt myself|hurting myself|hurt myself)\b",
    r"\b(cut myself|cutting myself|been cutting)\b",
    r"\b(harm myself|harming myself)\b",
    # Overdose / means
    r"\b(overdose|overdosing)\b",
    r"\b(too many pills|stockpiling pills)\b",
    r"\b(thinking about dying|thinking about death)\b",
]

CRISIS_REGEX = re.compile("|".join(CRISIS_KEYWORDS), re.IGNORECASE)

def check_crisis(text: str) -> bool:
    """Returns True if the text triggers the crisis safety classifier."""
    if not text:
        return False
    return bool(CRISIS_REGEX.search(text))

CRISIS_RESPONSE_PAYLOAD = {
    "is_crisis": True,
    "crisis_message": (
        "It sounds like you are going through a really difficult time right "
        "now. Please know you aren't alone."
    ),
    "resources": [
        {
            "name": "988 Suicide & Crisis Lifeline",
            "number": "988",
            "action": "Call or Text",
            "region": "US/Canada"
        },
        {
            "name": "Crisis Text Line",
            "number": "741741",
            "action": "Text HOME",
            "region": "US/Canada/UK/Ireland"
        }
    ],
}
