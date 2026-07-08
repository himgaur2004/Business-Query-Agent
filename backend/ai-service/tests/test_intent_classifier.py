"""
Unit tests for intent_classifier.classify_intent.
Mocking the Groq client keeps tests deterministic and free of API calls.
"""

import pytest
from unittest.mock import patch, MagicMock

from app.intent_classifier import classify_intent, INTENTS


def _make_mock_response(content: str) -> MagicMock:
    """Helper to build a mock Groq response object."""
    mock_resp = MagicMock()
    mock_resp.choices[0].message.content = content
    return mock_resp


class TestClassifyIntent:
    """Tests for the intent classifier (spec §5)."""

    @patch("app.intent_classifier.client")
    def test_parses_json_sales_report(self, mock_client):
        mock_client.chat.completions.create.return_value = _make_mock_response(
            '{"intent": "sales_report", "entities": {"period": "last_quarter"}, "confidence": 0.95}'
        )
        result = classify_intent("What were sales last quarter?")
        assert result["intent"] == "sales_report"
        assert result["entities"]["period"] == "last_quarter"
        assert result["confidence"] == pytest.approx(0.95)

    @patch("app.intent_classifier.client")
    def test_parses_json_inventory_check(self, mock_client):
        mock_client.chat.completions.create.return_value = _make_mock_response(
            '{"intent": "inventory_check", "entities": {}, "confidence": 0.88}'
        )
        result = classify_intent("Which products are low in stock?")
        assert result["intent"] == "inventory_check"

    @patch("app.intent_classifier.client")
    def test_strips_markdown_fences(self, mock_client):
        mock_client.chat.completions.create.return_value = _make_mock_response(
            '```json\n{"intent": "customer_lookup", "entities": {}, "confidence": 0.9}\n```'
        )
        result = classify_intent("Find customer by email")
        assert result["intent"] == "customer_lookup"

    @patch("app.intent_classifier.client")
    def test_falls_back_on_invalid_json(self, mock_client):
        mock_client.chat.completions.create.return_value = _make_mock_response(
            "I cannot classify this question."
        )
        result = classify_intent("Something weird")
        assert result["intent"] == "unknown"
        assert "entities" in result
        assert "confidence" in result

    @patch("app.intent_classifier.client")
    def test_falls_back_on_unknown_intent(self, mock_client):
        mock_client.chat.completions.create.return_value = _make_mock_response(
            '{"intent": "completely_made_up", "entities": {}, "confidence": 0.5}'
        )
        result = classify_intent("Random question")
        assert result["intent"] == "unknown"

    @patch("app.intent_classifier.client")
    def test_uses_fast_model_for_classification(self, mock_client):
        mock_client.chat.completions.create.return_value = _make_mock_response(
            '{"intent": "financial_summary", "entities": {}, "confidence": 0.8}'
        )
        classify_intent("Show me P&L for last quarter")
        call_kwargs = mock_client.chat.completions.create.call_args
        assert call_kwargs.kwargs["model"] == "llama-3.1-8b-instant"

    @patch("app.intent_classifier.client")
    def test_all_valid_intents_recognized(self, mock_client):
        for intent_name in INTENTS:
            mock_client.chat.completions.create.return_value = _make_mock_response(
                f'{{"intent": "{intent_name}", "entities": {{}}, "confidence": 0.9}}'
            )
            result = classify_intent("Test question")
            assert result["intent"] == intent_name
