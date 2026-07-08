"""
Unit tests for sql_generator.validate_sql and generate_sql.
Mocking the Groq client keeps tests fast and free of API rate-limit dependencies.
"""

import pytest
from unittest.mock import patch, MagicMock

from app.sql_generator import validate_sql, generate_sql


class TestValidateSql:
    """Tests for the SQL safety validator (spec §5)."""

    def test_allows_simple_select(self):
        assert validate_sql("SELECT * FROM orders") is True

    def test_allows_select_with_join(self):
        sql = "SELECT o.id, c.name FROM orders o JOIN customers c ON o.customer_id = c.id"
        assert validate_sql(sql) is True

    def test_allows_select_with_aggregate(self):
        sql = "SELECT product_id, SUM(quantity) as total FROM order_items GROUP BY product_id"
        assert validate_sql(sql) is True

    def test_blocks_drop(self):
        assert validate_sql("DROP TABLE orders") is False

    def test_blocks_delete(self):
        assert validate_sql("DELETE FROM orders WHERE id=1") is False

    def test_blocks_update(self):
        assert validate_sql("UPDATE orders SET status='x'") is False

    def test_blocks_insert(self):
        assert validate_sql("INSERT INTO orders VALUES (1, 2)") is False

    def test_blocks_truncate(self):
        assert validate_sql("TRUNCATE orders") is False

    def test_blocks_alter(self):
        assert validate_sql("ALTER TABLE orders ADD COLUMN foo INT") is False

    def test_blocks_create(self):
        assert validate_sql("CREATE TABLE foo (id INT)") is False

    def test_requires_select_at_start(self):
        assert validate_sql("orders SELECT *") is False

    def test_empty_string_rejected(self):
        assert validate_sql("") is False

    def test_case_insensitive_validation(self):
        assert validate_sql("DELETE FROM orders") is False
        assert validate_sql("delete from orders") is False
        assert validate_sql("DeLeTe FROM orders") is False

    def test_blocks_mixed_select_with_drop(self):
        # Edge case: SELECT followed by DROP in same query
        assert validate_sql("SELECT * FROM orders; DROP TABLE orders") is False


class TestGenerateSql:
    """Tests for the SQL generation function (mocked Groq)."""

    @patch("app.sql_generator.client")
    def test_generate_sql_returns_clean_string(self, mock_client):
        mock_resp = MagicMock()
        mock_resp.choices[0].message.content = "SELECT id, total FROM orders LIMIT 5"
        mock_client.chat.completions.create.return_value = mock_resp

        sql = generate_sql(
            "Show me recent orders",
            {"intent": "sales_report", "entities": {}},
            "TABLE orders (id INT, total NUMERIC)",
        )
        assert sql == "SELECT id, total FROM orders LIMIT 5"

    @patch("app.sql_generator.client")
    def test_generate_sql_strips_markdown_fences(self, mock_client):
        mock_resp = MagicMock()
        mock_resp.choices[0].message.content = "```sql\nSELECT * FROM orders\n```"
        mock_client.chat.completions.create.return_value = mock_resp

        sql = generate_sql("Show orders", {}, "TABLE orders (id INT)")
        assert "```" not in sql
        assert sql.startswith("SELECT")

    @patch("app.sql_generator.client")
    def test_generate_sql_uses_correct_model(self, mock_client):
        mock_resp = MagicMock()
        mock_resp.choices[0].message.content = "SELECT 1"
        mock_client.chat.completions.create.return_value = mock_resp

        generate_sql("Any question", {}, "Any schema")

        call_kwargs = mock_client.chat.completions.create.call_args
        assert call_kwargs.kwargs["model"] == "llama-3.3-70b-versatile"
