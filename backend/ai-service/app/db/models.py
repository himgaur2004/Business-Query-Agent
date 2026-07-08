from sqlalchemy import Column, DateTime, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


class QueryLog(Base):
    """
    Audit log of every query executed through the agent.

    Matches the PostgreSQL schema in backend doc §6:
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
    """

    __tablename__ = "query_log"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(String(36), nullable=False, index=True)  # UUID as string
    question = Column(Text, nullable=False)
    intent = Column(JSONB, nullable=True)
    generated_sql = Column(Text, nullable=False)
    row_count = Column(Integer, default=0)
    execution_ms = Column(Integer, default=0)
    status = Column(String(20), default="success")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    def __repr__(self) -> str:
        return f"<QueryLog id={self.id} intent={self.intent} status={self.status}>"
