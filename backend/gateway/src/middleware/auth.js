const jwt = require("jsonwebtoken");
const jwksClient = require("jwks-rsa");

const TENANT_ID = process.env.AZURE_AD_TENANT_ID;
const CLIENT_ID = process.env.AZURE_AD_CLIENT_ID;
const DEV_MODE = !TENANT_ID || !CLIENT_ID;

// JWKS client for Azure AD token verification
let jwks = null;
if (!DEV_MODE) {
  jwks = jwksClient({
    jwksUri: `https://login.microsoftonline.com/${TENANT_ID}/discovery/v2.0/keys`,
    cache: true,
    rateLimit: true,
  });
}

function getKey(header, callback) {
  jwks.getSigningKey(header.kid, (err, key) => {
    callback(err, err ? null : key.getPublicKey());
  });
}

/**
 * Express middleware to verify Azure AD Bearer token.
 * In DEV_MODE (no Azure credentials configured) it is a no-op pass-through.
 */
function verifyToken(req, res, next) {
  if (DEV_MODE) {
    // Skip auth in dev mode
    req.user = { sub: "dev-user", name: "Dev User" };
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid Authorization header" });
  }

  const token = authHeader.slice(7);

  jwt.verify(
    token,
    getKey,
    {
      audience: CLIENT_ID,
      issuer: `https://login.microsoftonline.com/${TENANT_ID}/v2.0`,
      algorithms: ["RS256"],
    },
    (err, decoded) => {
      if (err) {
        return res.status(401).json({ error: "Invalid token", detail: err.message });
      }
      req.user = decoded;
      next();
    }
  );
}

module.exports = { verifyToken };
