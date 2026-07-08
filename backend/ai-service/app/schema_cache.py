"""
Schema cache — fetches and caches the PostgreSQL information_schema on startup.
Refreshes every 30 minutes to pick up schema changes without a restart.
"""
import logging
import threading
import time

logger = logging.getLogger(__name__)

_cache: dict = {"schema": None, "expires_at": 0}
_lock = threading.Lock()

REFRESH_INTERVAL = 30 * 60  # 30 minutes


def _fetch_schema_from_db() -> str:
    """Query information_schema.columns and format as a human-readable schema string."""
    from .db.session import get_engine
    from sqlalchemy import text

    engine = get_engine(readonly=True)
    with engine.connect() as conn:
        result = conn.execute(
            text(
                """
                SELECT table_name, column_name, data_type, is_nullable
                FROM information_schema.columns
                WHERE table_schema = 'public'
                ORDER BY table_name, ordinal_position
                """
            )
        )
        rows = result.fetchall()

    # Group by table
    tables: dict[str, list[str]] = {}
    for table_name, column_name, data_type, is_nullable in rows:
        tables.setdefault(table_name, []).append(
            f"  {column_name} {data_type.upper()}{'  -- nullable' if is_nullable == 'YES' else ''}"
        )

    parts = []
    for table, cols in tables.items():
        parts.append(f"TABLE {table} (\n" + ",\n".join(cols) + "\n)")

    return "\n\n".join(parts) if parts else "-- No public tables found"


def _get_fallback_schema() -> str:
    """Return a hardcoded demo schema for when the DB is not available."""
    return """TABLE orders (
  id SERIAL,
  customer_id INT,
  status VARCHAR,
  total_amount NUMERIC,
  created_at TIMESTAMPTZ
)

TABLE products (
  id SERIAL,
  name VARCHAR,
  category VARCHAR,
  price NUMERIC,
  stock_qty INT
)

TABLE customers (
  id SERIAL,
  name VARCHAR,
  email VARCHAR,
  region VARCHAR,
  created_at TIMESTAMPTZ
)

TABLE order_items (
  id SERIAL,
  order_id INT,
  product_id INT,
  quantity INT,
  unit_price NUMERIC
)"""


def get_schema() -> str:
    """
    Returns a cached schema string. Refreshes from the DB if the cache has expired.
    Falls back to a hardcoded demo schema if the DB is unavailable.
    """
    with _lock:
        now = time.time()
        if _cache["schema"] is None or now > _cache["expires_at"]:
            try:
                schema = _fetch_schema_from_db()
                _cache["schema"] = schema
                _cache["expires_at"] = now + REFRESH_INTERVAL
                logger.info("Schema cache refreshed (%d tables)", schema.count("TABLE "))
            except Exception as e:
                logger.warning("Schema fetch failed, using fallback: %s", e)
                if _cache["schema"] is None:
                    _cache["schema"] = _get_fallback_schema()
                    _cache["expires_at"] = now + 60  # retry sooner
        return _cache["schema"]
