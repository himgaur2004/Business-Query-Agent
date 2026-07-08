import os

from groq import Groq

client = Groq(api_key=os.environ.get("GROQ_API_KEY", ""))


def summarize(question: str, rows: list[dict]) -> str:
    """
    Turn query result rows into a concise plain-English answer.
    Uses llama-3.1-8b-instant (fast) since summarization is simpler than SQL generation.

    Returns:
        A 2–4 sentence plain-English summary.
    """
    if not rows:
        return "The query returned no results. This may mean the data doesn't exist for the specified criteria."

    # Truncate to 50 rows for the prompt to stay within token limits
    sample = rows[:50]

    # Flatten rows into a readable table representation
    if sample:
        columns = list(sample[0].keys())
        header = " | ".join(columns)
        divider = "-+-".join(["-" * len(c) for c in columns])
        data_rows = "\n".join(
            " | ".join(str(row.get(c, "")) for c in columns) for row in sample
        )
        table_repr = f"{header}\n{divider}\n{data_rows}"
    else:
        table_repr = "(no data)"

    total = len(rows)
    truncated_note = f" (showing first 50 of {total} rows)" if total > 50 else ""

    prompt = f"""You are a business analyst. The user asked: "{question}"

Here are the query results{truncated_note}:
{table_repr}

Provide a clear, concise 2-4 sentence answer in plain English. Focus on key insights and numbers.
Do not mention SQL or technical details. Be direct and business-friendly."""

    resp = client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
        max_tokens=300,
    )

    return resp.choices[0].message.content.strip()
