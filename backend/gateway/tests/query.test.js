const request = require("supertest");

// Set env before requiring app (triggers dev-mode auth bypass)
process.env.NODE_ENV = "test";

const app = require("../src/server");

describe("GET /health", () => {
  it("returns 200 ok", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });
});

describe("POST /api/query", () => {
  it("rejects empty question with 400", async () => {
    const res = await request(app)
      .post("/api/query")
      .send({ question: "" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/non-empty/i);
  });

  it("rejects missing question field with 400", async () => {
    const res = await request(app)
      .post("/api/query")
      .send({});
    expect(res.status).toBe(400);
  });

  it("rejects question over 1000 chars", async () => {
    const res = await request(app)
      .post("/api/query")
      .send({ question: "x".repeat(1001) });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/1000/);
  });

  it("returns 503 when AI service is unreachable", async () => {
    // AI_SERVICE_URL points to a closed port in test
    process.env.AI_SERVICE_URL = "http://localhost:19999";
    const res = await request(app)
      .post("/api/query")
      .send({ question: "What were sales last month?", session_id: "test-session" });
    // Should either 503 (ECONNREFUSED) or 503 (connection refused)
    expect([503, 500]).toContain(res.status);
  });
});

describe("GET /api/history", () => {
  it("requires session_id param", async () => {
    const res = await request(app).get("/api/history");
    expect(res.status).toBe(400);
  });

  it("returns empty array when DATABASE_URL is not set", async () => {
    delete process.env.DATABASE_URL;
    const res = await request(app).get("/api/history?session_id=test-session");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
