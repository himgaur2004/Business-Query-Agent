const rateLimit = require("express-rate-limit");

/**
 * Rate limiter: 100 requests per 15 minutes per IP.
 * Applied to all /api/* routes.
 */
const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many requests — please wait before sending more queries",
    retryAfter: "15 minutes",
  },
  keyGenerator: (req) => req.ip || req.headers["x-forwarded-for"] || "unknown",
});

module.exports = { rateLimiter };
