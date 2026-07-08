const express = require("express");
const axios = require("axios");
const { Pool } = require("pg");
const { verifyToken } = require("../middleware/auth");

const router = express.Router();

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";

// PostgreSQL pool (for history endpoint; gracefully no-ops if DATABASE_URL is unset)
let pool = null;
if (process.env.DATABASE_URL) {
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
}

/**
 * POST /api/query
 * Body: { question: string, session_id?: string }
 * Returns: { intent, generated_sql, rows, summary }
 */
router.post("/query", verifyToken, async (req, res, next) => {
  try {
    const { question, session_id } = req.body;

    if (!question || typeof question !== "string" || !question.trim()) {
      return res.status(400).json({ error: "question must be a non-empty string" });
    }

    if (question.trim().length > 1000) {
      return res.status(400).json({ error: "question must not exceed 1000 characters" });
    }

    const response = await axios.post(
      `${AI_SERVICE_URL}/query`,
      { question: question.trim(), session_id: session_id || "anonymous" },
      { timeout: 60_000 }
    );

    return res.json(response.data);
  } catch (err) {
    if (err.response) {
      // Forward AI service error
      return res
        .status(err.response.status)
        .json(err.response.data);
    }
    if (err.code === "ECONNREFUSED") {
      return res.status(503).json({ error: "AI service unavailable" });
    }
    next(err);
  }
});

/**
 * GET /api/history?session_id=<uuid>
 * Returns the last 50 queries for a session from the query_log table.
 */
router.get("/history", verifyToken, async (req, res, next) => {
  try {
    const { session_id } = req.query;

    if (!session_id) {
      return res.status(400).json({ error: "session_id is required" });
    }

    if (!pool) {
      // Return empty list if DB not configured (dev mode)
      return res.json([]);
    }

    const { rows } = await pool.query(
      `SELECT id, question, intent, generated_sql, row_count, execution_ms, status, created_at
       FROM query_log
       WHERE session_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [session_id]
    );

    return res.json(rows);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
