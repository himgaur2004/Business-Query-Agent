# Backend Documentation — Multi-Step Intent Classification & SQL Generation Service

## 1. Overview
The backend is split into two cooperating services, matching the resume bullet's
**"Node.js/Python FastAPI microservices backend for multi-step intent classification and SQL generation."**

- **Gateway service (Node.js / Express)** — auth, request validation, rate limiting, routing, and
  Server-Sent Events (SSE) streaming to the frontend.
- **AI service (Python / FastAPI)** — the actual LLM pipeline: intent classification → schema-aware
  SQL generation → execution → natural-language summarization.

They communicate over internal HTTP (or an Azure Service Bus queue, if you want it fully async).

## 2. Free AI API Choice
Instead of the paid OpenAI API, use **Groq** (free tier, generous rate limits, OpenAI-compatible SDK)
or **Google Gemini** (free tier via AI Studio). Both work as drop-in replacements because they expose
OpenAI-compatible or near-identical chat-completion interfaces.

| Provider | Free tier | Notes |
|---|---|---|
| **Groq** | Yes — free API key, fast inference (LPU hardware) | Llama 3.1/3.3, Mixtral models; OpenAI-compatible client |
| **Google Gemini** | Yes — free tier via AI Studio | `gemini-1.5-flash` / `gemini-2.0-flash` good for structured JSON output |
| **OpenRouter** | Free-credit models available | Useful if you want to A/B test multiple open models under one key |

This doc uses **Groq** in examples since its SDK is a near drop-in replacement for `openai`.

```bash
pip install groq
```

```python
from groq import Groq

client = Groq(api_key=os.environ["GROQ_API_KEY"])  # get a free key at console.groq.com

response = client.chat.completions.create(
    model="llama-3.3-70b-versatile",
    messages=[{"role": "user", "content": prompt}],
    temperature=0,
)
```

## 3. Project Structure
```
backend/
├── gateway/                     # Node.js/Express
│   ├── src/
│   │   ├── routes/query.js
│   │   ├── middleware/auth.js
│   │   ├── middleware/rateLimit.js
│   │   └── server.js
│   ├── package.json
│   └── Dockerfile
└── ai-service/                  # Python/FastAPI
    ├── app/
    │   ├── main.py
    │   ├── intent_classifier.py
    │   ├── sql_generator.py
    │   ├── executor.py
    │   ├── summarizer.py
    │   ├── db/
    │   │   ├── models.py         # SQLAlchemy models
    │   │   └── session.py
    │   └── schema_cache.py       # cached PostgreSQL schema for prompt grounding
    ├── requirements.txt
    └── Dockerfile
```

## 4. Multi-Step Pipeline
```
User question
   │
   ▼
[1] Intent Classifier  → { intent: "sales_report", entities: {period: "last_quarter"} }
   │
   ▼
[2] SQL Generator       → generates parameterized SQL grounded in the cached DB schema
   │
   ▼
[3] Validator           → blocks DDL/DML (only SELECT allowed), checks against schema
   │
   ▼
[4] Executor            → runs against PostgreSQL (read replica), logs query metadata
   │
   ▼
[5] Summarizer          → LLM turns result rows into a plain-English answer
   │
   ▼
Response → { intent, generated_sql, rows, summary }
```

### `intent_classifier.py`
```python
from groq import Groq
import json, os

client = Groq(api_key=os.environ["GROQ_API_KEY"])

INTENTS = ["sales_report", "inventory_check", "customer_lookup", "financial_summary", "unknown"]

def classify_intent(question: str) -> dict:
    prompt = f"""Classify the business question into one of: {INTENTS}.
Return ONLY JSON: {{"intent": "...", "entities": {{...}}}}
Question: {question}"""
    resp = client.chat.completions.create(
        model="llama-3.1-8b-instant",   # small/fast model for classification
        messages=[{"role": "user", "content": prompt}],
        temperature=0,
    )
    return json.loads(resp.choices[0].message.content)
```

### `sql_generator.py`
```python
def generate_sql(question: str, intent: dict, schema: str) -> str:
    prompt = f"""You are a PostgreSQL expert. Given this schema:
{schema}

Write a single read-only SELECT query (no DDL/DML) answering:
"{question}"
Intent context: {intent}
Return ONLY the SQL query, no explanation."""
    resp = client.chat.completions.create(
        model="llama-3.3-70b-versatile",  # larger model for accurate SQL generation
        messages=[{"role": "user", "content": prompt}],
        temperature=0,
    )
    return resp.choices[0].message.content.strip()
```

### Safety validation (critical for a query-generation agent)
```python
FORBIDDEN = {"insert", "update", "delete", "drop", "alter", "truncate", "grant", "create"}

def validate_sql(sql: str) -> bool:
    lowered = sql.lower()
    if not lowered.strip().startswith("select"):
        return False
    return not any(word in lowered for word in FORBIDDEN)
```

## 5. FastAPI Entry Point (`main.py`)
```python
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from .intent_classifier import classify_intent
from .sql_generator import generate_sql, validate_sql
from .executor import run_query, log_query
from .summarizer import summarize
from .schema_cache import get_schema

app = FastAPI()

class QueryRequest(BaseModel):
    question: str
    session_id: str

@app.post("/query")
async def query(req: QueryRequest):
    intent = classify_intent(req.question)
    schema = get_schema()
    sql = generate_sql(req.question, intent, schema)

    if not validate_sql(sql):
        raise HTTPException(400, "Generated query failed safety validation")

    rows = run_query(sql)
    summary = summarize(req.question, rows)
    log_query(req.session_id, req.question, sql, intent)

    return {"intent": intent, "generated_sql": sql, "rows": rows, "summary": summary}
```

## 6. PostgreSQL Schema — Query Logging
```sql
CREATE TABLE query_log (
    id SERIAL PRIMARY KEY,
    session_id UUID NOT NULL,
    question TEXT NOT NULL,
    intent JSONB,
    generated_sql TEXT NOT NULL,
    row_count INT,
    execution_ms INT,
    status VARCHAR(20) DEFAULT 'success',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_query_log_session ON query_log(session_id);
CREATE INDEX idx_query_log_created_at ON query_log(created_at DESC);
```
Indexes optimize the two most common access patterns: pulling a user's history (`session_id`) and
recent-activity monitoring dashboards (`created_at DESC`).

## 7. Environment Variables
```
GROQ_API_KEY=<free key from console.groq.com>
DATABASE_URL=postgresql://user:pass@host:5432/dbname
DATABASE_READ_REPLICA_URL=postgresql://user:pass@replica-host:5432/dbname
```

## 8. Local Run
```bash
# AI service
cd backend/ai-service
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Gateway
cd backend/gateway
npm install
npm run dev   # proxies to http://localhost:8000
```
