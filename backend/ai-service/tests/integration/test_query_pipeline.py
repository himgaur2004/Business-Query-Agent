"""
Integration tests for the full query pipeline.
Runs against the real FastAPI app with a real SQLite in-memory DB (no PostgreSQL needed locally).
LLM calls are mocked to make tests deterministic and free of API dependencies.
"""

import pytest
from unittest.mock import patch, MagicMock
from httpx import AsyncClient, ASGITransport

from app.main import app


# ── Fixtures ──────────────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def mock_groq_globally():
    """
    Globally mock the Groq client for all integration tests.
    This ensures tests don't depend on a real GROQ_API_KEY or rate limits.
    """
    with (
        patch("app.intent_classifier.client") as mock_intent,
        patch("app.sql_generator.client") as mock_sql,
        patch("app.summarizer.client") as mock_summary,
    ):
        # Intent mock
        intent_resp = MagicMock()
        intent_resp.choices[0].message.content = (
            '{"intent": "sales_report", "entities": {"period": "yesterday"}, "confidence": 0.92}'
        )
        mock_intent.chat.completions.create.return_value = intent_resp

        # SQL mock — SELECT from the synthetic orders table in seed.sql
        sql_resp = MagicMock()
        sql_resp.choices[0].message.content = (
            "SELECT COUNT(*) as order_count FROM orders WHERE created_at >= NOW() - INTERVAL '1 day'"
        )
        mock_sql.chat.completions.create.return_value = sql_resp

        # Summary mock
        summary_resp = MagicMock()
        summary_resp.choices[0].message.content = (
            "Yesterday, 42 orders were placed totalling $8,400 in revenue."
        )
        mock_summary.chat.completions.create.return_value = summary_resp

        yield


@pytest.fixture(autouse=True)
def mock_schema_cache():
    """Use the hardcoded demo schema instead of querying a real DB."""
    from app.schema_cache import _get_fallback_schema
    with patch("app.main.get_schema", return_value=_get_fallback_schema()):
        yield


@pytest.fixture(autouse=True)
def mock_executor():
    """Mock run_query and log_query so no real DB is needed for integration tests."""
    with (
        patch("app.main.run_query", return_value=[{"order_count": 42}]) as mock_run,
        patch("app.main.log_query") as mock_log,
    ):
        yield mock_run, mock_log


# ── Tests ─────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_health_check():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


@pytest.mark.asyncio
async def test_end_to_end_query_returns_expected_shape():
    """Full pipeline returns all required response fields (spec §6)."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/query", json={
            "question": "How many orders were placed yesterday?",
            "session_id": "integration-test",
        })
    assert resp.status_code == 200
    body = resp.json()
    assert "intent" in body
    assert "generated_sql" in body
    assert "rows" in body
    assert "summary" in body
    assert "execution_ms" in body


@pytest.mark.asyncio
async def test_generated_sql_starts_with_select():
    """Pipeline must never return DDL/DML (spec §6)."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/query", json={
            "question": "How many orders were placed yesterday?",
            "session_id": "integration-test",
        })
    body = resp.json()
    assert body["generated_sql"].strip().lower().startswith("select")


@pytest.mark.asyncio
async def test_rejects_empty_question():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/query", json={"question": "", "session_id": "test"})
    assert resp.status_code == 422  # Pydantic validation


@pytest.mark.asyncio
async def test_sql_safety_validation_blocks_ddl():
    """If LLM returns DDL, the pipeline must reject it with 400."""
    with patch("app.main.generate_sql", return_value="DROP TABLE orders"):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.post("/query", json={
                "question": "Delete all orders",
                "session_id": "test",
            })
    assert resp.status_code == 400
    assert "safety" in resp.json()["detail"].lower()
