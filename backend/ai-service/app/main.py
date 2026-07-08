import logging
import os
import time

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .intent_classifier import classify_intent
from .sql_generator import generate_sql, validate_sql
from .executor import run_query, log_query
from .summarizer import summarize
from .schema_cache import get_schema
from .db.session import create_all_tables

# ── Logging ────────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Optionally wire Azure Application Insights
APPINSIGHTS_CS = os.environ.get("APPINSIGHTS_CONNECTION_STRING")
if APPINSIGHTS_CS:
    try:
        from opencensus.ext.azure.log_exporter import AzureLogHandler
        logger.addHandler(AzureLogHandler(connection_string=APPINSIGHTS_CS))
        logger.info("Azure Application Insights logging enabled")
    except Exception as e:
        logger.warning("Failed to init AppInsights: %s", e)

# ── App ────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Business Query Agent — AI Service",
    description="Multi-step intent classification → SQL generation → execution → summarization",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Gateway handles origin restriction
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    """Auto-create tables on startup (idempotent)."""
    try:
        create_all_tables()
        logger.info("Database tables ready")
    except Exception as e:
        logger.warning("Table creation skipped: %s", e)


# ── Request / Response models ──────────────────────────────────────────────
class QueryRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=1000)
    session_id: str = Field(default="anonymous", max_length=36)


class QueryResponse(BaseModel):
    intent: dict
    generated_sql: str
    rows: list[dict]
    summary: str
    execution_ms: int


# ── Endpoints ──────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/query", response_model=QueryResponse)
def query(req: QueryRequest):
    """
    Multi-step pipeline:
    1. Classify intent
    2. Get cached schema
    3. Generate SQL
    4. Validate SQL (blocks DDL/DML)
    5. Execute query
    6. Summarize result
    7. Log to query_log
    """
    t0 = time.perf_counter()

    # Step 1: Intent classification
    try:
        intent = classify_intent(req.question)
        logger.info("Intent: %s (confidence=%.2f)", intent.get("intent"), intent.get("confidence", 0))
    except Exception as e:
        logger.error("Intent classification failed: %s", e)
        raise HTTPException(status_code=502, detail=f"Intent classification failed: {e}")

    # Step 2: Schema
    schema = get_schema()

    # Step 3: SQL generation
    try:
        sql = generate_sql(req.question, intent, schema)
        logger.info("Generated SQL: %.120s…", sql)
    except Exception as e:
        logger.error("SQL generation failed: %s", e)
        raise HTTPException(status_code=502, detail=f"SQL generation failed: {e}")

    # Step 4: Validate
    if not validate_sql(sql):
        logger.warning("SQL failed safety validation: %.120s", sql)
        raise HTTPException(
            status_code=400,
            detail="Generated query failed safety validation — only SELECT statements are allowed.",
        )

    # Step 5: Execute
    try:
        rows = run_query(sql)
        logger.info("Query returned %d rows", len(rows))
    except Exception as e:
        logger.error("Query execution failed: %s", e)
        execution_ms = int((time.perf_counter() - t0) * 1000)
        log_query(req.session_id, req.question, sql, intent, 0, execution_ms, "error")
        raise HTTPException(status_code=500, detail=f"Query execution failed: {e}")

    # Step 6: Summarize
    try:
        summary = summarize(req.question, rows)
    except Exception as e:
        logger.warning("Summarization failed, returning raw: %s", e)
        summary = f"Query returned {len(rows)} rows."

    execution_ms = int((time.perf_counter() - t0) * 1000)

    # Step 7: Log
    log_query(req.session_id, req.question, sql, intent, len(rows), execution_ms, "success")

    logger.info(
        "query_executed",
        extra={"custom_dimensions": {"intent": intent.get("intent"), "execution_ms": execution_ms}},
    )

    return QueryResponse(
        intent=intent,
        generated_sql=sql,
        rows=rows,
        summary=summary,
        execution_ms=execution_ms,
    )
