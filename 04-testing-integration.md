# Testing & Integration Documentation

## 1. Overview
Testing strategy across all layers of the Business Query Agent: frontend, Node.js gateway, Python
FastAPI AI service, and the end-to-end pipeline (intent classification → SQL generation → execution →
summarization). Supports the resume claim of a reliable, monitored, production-grade agent.

## 2. Testing Pyramid
```
        ▲
        │   E2E (few)         — Playwright: full user flow through UI
        │   Integration (some)— pytest + httpx: service-to-service, DB, LLM contract tests
        │   Unit (many)       — Jest (frontend/gateway), pytest (AI service)
        ▼
```

## 3. Frontend Unit Tests (Jest + React Testing Library)
```javascript
// QueryInput.test.jsx
import { render, screen, fireEvent } from "@testing-library/react";
import QueryInput from "../components/QueryInput";

test("submits question and shows loading state", () => {
  render(<QueryInput />);
  const input = screen.getByPlaceholderText(/ask a business question/i);
  fireEvent.change(input, { target: { value: "Top 5 products last quarter" } });
  fireEvent.click(screen.getByRole("button", { name: /ask/i }));
  expect(screen.getByText(/thinking/i)).toBeInTheDocument();
});
```
Run with: `npm test`

## 4. Gateway (Node.js) Unit + Contract Tests
```javascript
// query.test.js (Jest + supertest)
const request = require("supertest");
const app = require("../src/server");

describe("POST /api/query", () => {
  it("rejects empty question", async () => {
    const res = await request(app).post("/api/query").send({ question: "" });
    expect(res.status).toBe(400);
  });

  it("forwards valid question to AI service and returns its shape", async () => {
    const res = await request(app)
      .post("/api/query")
      .send({ question: "What were sales last month?", session_id: "test-session" });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("generated_sql");
    expect(res.body).toHaveProperty("summary");
  });
});
```

## 5. AI Service (Python) Unit Tests — `pytest`
```python
# tests/test_sql_generator.py
from app.sql_generator import validate_sql

def test_validate_sql_blocks_write_operations():
    assert validate_sql("SELECT * FROM orders") is True
    assert validate_sql("DROP TABLE orders") is False
    assert validate_sql("DELETE FROM orders WHERE id=1") is False
    assert validate_sql("UPDATE orders SET status='x'") is False

def test_validate_sql_requires_select_start():
    assert validate_sql("orders SELECT *") is False
```

```python
# tests/test_intent_classifier.py
from unittest.mock import patch
from app.intent_classifier import classify_intent

@patch("app.intent_classifier.client.chat.completions.create")
def test_classify_intent_parses_json(mock_create):
    mock_create.return_value.choices = [
        type("obj", (), {"message": type("m", (), {"content": '{"intent": "sales_report", "entities": {"period": "last_quarter"}}'})})
    ]
    result = classify_intent("What were sales last quarter?")
    assert result["intent"] == "sales_report"
```
Mocking the Groq client keeps unit tests fast, deterministic, and free of API rate-limit dependencies.

## 6. Integration Tests — Real DB, Mocked/Sandboxed LLM
```python
# tests/integration/test_query_pipeline.py
import pytest
from httpx import AsyncClient
from app.main import app

@pytest.mark.asyncio
async def test_end_to_end_query_against_test_db(test_db_session):
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.post("/query", json={
            "question": "How many orders were placed yesterday?",
            "session_id": "integration-test"
        })
    assert response.status_code == 200
    body = response.json()
    assert "rows" in body
    assert body["generated_sql"].lower().startswith("select")
```
These run against a real ephemeral PostgreSQL container (see CI/CD doc's `services.postgres` block) so
schema-grounding and query execution are validated against actual data, not mocks.

### LLM Contract Testing (important for a free-tier API)
Because Groq's free tier can occasionally rate-limit or return slightly different phrasing, integration
tests should assert on **structure**, not exact text:
```python
def test_generated_sql_is_syntactically_valid(pg_connection):
    sql = generate_sql("Top 5 products by revenue", intent={"intent": "sales_report"}, schema=TEST_SCHEMA)
    # EXPLAIN validates syntax + schema references without executing
    pg_connection.execute(f"EXPLAIN {sql}")
```

## 7. End-to-End Tests — Playwright
```javascript
// e2e/query-flow.spec.js
import { test, expect } from "@playwright/test";

test("user can ask a question and see results", async ({ page }) => {
  await page.goto("https://staging.your-app.azurestaticapps.net");
  await page.fill('input[placeholder*="Ask a business question"]', "Top 5 products last quarter");
  await page.click('button:has-text("Ask")');
  await expect(page.locator("text=/SELECT/i")).toBeVisible({ timeout: 15000 });
  await expect(page.locator("table")).toBeVisible();
});
```
Run in CI against a **staging** deployment (separate Function App slot + staging DB) so E2E tests never
touch production data.

## 8. Test Coverage & Quality Gates
| Layer | Tool | Target Coverage | CI Gate |
|---|---|---|---|
| Frontend | Jest + RTL | 70%+ | Block merge if below threshold |
| Gateway | Jest + supertest | 75%+ | Block merge |
| AI service | pytest + pytest-cov | 80%+ | Block merge |
| E2E | Playwright | Key user journeys only | Run on staging post-deploy, block promotion to prod on failure |

## 9. Test Data Management
- Use a seeded **test PostgreSQL schema** (`tests/fixtures/seed.sql`) with synthetic sales/inventory
  data, mirroring production schema shape without any real business data.
- Reset the test DB between test runs via a `pytest` fixture using `TRUNCATE ... RESTART IDENTITY`.

## 10. Monitoring Tests in Production (Synthetic Checks)
Beyond pre-deploy testing, add a lightweight **synthetic monitor** (Azure Monitor Availability Test or
a scheduled GitHub Action) that runs one canned question every 15 minutes against production and alerts
if the pipeline fails or exceeds latency thresholds — this closes the loop between "tested before
deploy" and "verified continuously after deploy," tying into the Azure Monitor alerting from the
CI/CD document.
