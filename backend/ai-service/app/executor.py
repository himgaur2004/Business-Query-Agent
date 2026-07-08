import time
import uuid

from sqlalchemy import text

from .db.session import get_engine


def run_query(sql: str) -> list[dict]:
    """
    Execute a validated SELECT query on the read replica (or primary if replica is not configured).
    Returns up to 500 rows as a list of dicts.
    Raises RuntimeError if execution fails.
    """
    engine = get_engine(readonly=True)
    with engine.connect() as conn:
        result = conn.execute(text(sql))
        columns = list(result.keys())
        rows = [dict(zip(columns, row)) for row in result.fetchmany(500)]
    return rows


def log_query(
    session_id: str,
    question: str,
    sql: str,
    intent: dict,
    row_count: int = 0,
    execution_ms: int = 0,
    status: str = "success",
) -> None:
    """
    Append a record to the query_log table for audit and history.
    Silently swallows errors so logging never breaks the main pipeline.
    """
    import json

    engine = get_engine(readonly=False)
    try:
        with engine.begin() as conn:
            conn.execute(
                text(
                    """
                    INSERT INTO query_log
                        (session_id, question, intent, generated_sql, row_count, execution_ms, status)
                    VALUES
                        (:session_id, :question, :intent::jsonb, :sql, :row_count, :execution_ms, :status)
                    """
                ),
                {
                    "session_id": session_id,
                    "question": question,
                    "intent": json.dumps(intent),
                    "sql": sql,
                    "row_count": row_count,
                    "execution_ms": execution_ms,
                    "status": status,
                },
            )
    except Exception as e:
        # Never let logging failures surface to the user
        import logging
        logging.getLogger(__name__).warning("Failed to log query: %s", e)
