"""
SQLAlchemy engine/session factory.
Supports separate read-replica URL (DATABASE_READ_REPLICA_URL) for query execution.
Falls back gracefully to an in-memory SQLite engine when DATABASE_URL is not set
(enables unit tests and local dev without a real PostgreSQL instance).
"""
import os
from functools import lru_cache

from sqlalchemy import create_engine, Engine, event
from sqlalchemy.pool import StaticPool

_PRIMARY_URL = os.environ.get("DATABASE_URL", "")
_REPLICA_URL = os.environ.get("DATABASE_READ_REPLICA_URL", "")


def _make_engine(url: str, echo: bool = False) -> Engine:
    """Create a SQLAlchemy engine, falling back to SQLite for local dev."""
    if not url:
        # SQLite in-memory for dev/test
        return create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
            echo=echo,
        )
    # PostgreSQL
    return create_engine(url, pool_pre_ping=True, echo=echo)


@lru_cache(maxsize=2)
def get_engine(readonly: bool = False) -> Engine:
    """
    Return the appropriate SQLAlchemy engine.
    readonly=True → uses the read replica if configured.
    readonly=False → uses the primary.
    Results are cached so engines are re-used across calls.
    """
    url = _REPLICA_URL if (readonly and _REPLICA_URL) else _PRIMARY_URL
    return _make_engine(url)


def create_all_tables() -> None:
    """Create all tables (used during startup when auto-migration is enabled)."""
    from .models import Base
    engine = get_engine(readonly=False)
    Base.metadata.create_all(engine)
