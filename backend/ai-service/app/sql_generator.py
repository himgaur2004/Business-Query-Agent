import os
import re

from groq import Groq

client = Groq(api_key=os.environ.get("GROQ_API_KEY", ""))

# DDL/DML keywords that must never appear in generated SQL
FORBIDDEN_KEYWORDS = {
    "insert", "update", "delete", "drop", "alter",
    "truncate", "grant", "revoke", "create", "replace",
    "merge", "call", "exec", "execute",
}


def validate_sql(sql: str) -> bool:
    """
    Safety validator: only allows SELECT statements with no DDL/DML keywords.

    Returns True if the SQL is safe to execute, False otherwise.
    """
    stripped = sql.strip().lower()

    if not stripped.startswith("select"):
        return False

    # Tokenise to avoid partial-word matches (e.g. "selection" vs "select")
    tokens = set(re.findall(r"\b\w+\b", stripped))
    return not bool(tokens & FORBIDDEN_KEYWORDS)


def generate_sql(question: str, intent: dict, schema: str) -> str:
    """
    Generate a parameterized read-only SELECT query using Groq llama-3.3-70b-versatile.
    The schema is embedded in the prompt for grounding.

    Returns:
        SQL string (no markdown fences).
    """
    prompt = f"""You are a PostgreSQL expert. Given the following database schema:

{schema}

Write a single read-only SELECT query that answers this business question:
"{question}"

Intent context: {intent}

Rules:
- Return ONLY the raw SQL query — no markdown, no explanation, no code fences.
- Use only SELECT statements. Never use INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, GRANT, or CREATE.
- Prefer parameterized patterns (e.g. NOW() - INTERVAL '1 month') over hardcoded dates.
- Limit results to 500 rows maximum.
- Use meaningful column aliases for readability."""

    resp = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        temperature=0,
        max_tokens=600,
    )

    sql = resp.choices[0].message.content.strip()

    # Strip markdown fences if the model returns them despite instructions
    sql = re.sub(r"^```(?:sql)?|```$", "", sql, flags=re.MULTILINE).strip()

    return sql
