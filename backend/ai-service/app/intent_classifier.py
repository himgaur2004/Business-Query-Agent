import json
import os
import re

from groq import Groq

client = Groq(api_key=os.environ.get("GROQ_API_KEY", ""))

INTENTS = ["sales_report", "inventory_check", "customer_lookup", "financial_summary", "unknown"]


def classify_intent(question: str) -> dict:
    """
    Classify a natural-language business question into one of the known intents.
    Uses llama-3.1-8b-instant (small/fast model) for low-latency classification.

    Returns:
        { "intent": str, "entities": dict, "confidence": float }
    """
    prompt = f"""You are a business intelligence assistant. Classify the user's question into
exactly one of these intents: {INTENTS}.

Return ONLY valid JSON in this exact format — no markdown, no explanation:
{{"intent": "<intent>", "entities": {{}}, "confidence": 0.0}}

Where:
- intent is one of {INTENTS}
- entities is a dict of extracted business entities (e.g. {{"period": "last_quarter", "product": "Widget A"}})
- confidence is a float 0.0–1.0 reflecting how certain you are

Question: {question}"""

    resp = client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[{"role": "user", "content": prompt}],
        temperature=0,
        max_tokens=200,
    )

    raw = resp.choices[0].message.content.strip()

    # Strip optional markdown code fences
    raw = re.sub(r"^```(?:json)?|```$", "", raw, flags=re.MULTILINE).strip()

    try:
        result = json.loads(raw)
    except json.JSONDecodeError:
        # Graceful fallback
        result = {"intent": "unknown", "entities": {}, "confidence": 0.0}

    # Ensure all expected keys exist
    result.setdefault("intent", "unknown")
    result.setdefault("entities", {})
    result.setdefault("confidence", 0.5)

    if result["intent"] not in INTENTS:
        result["intent"] = "unknown"

    return result
