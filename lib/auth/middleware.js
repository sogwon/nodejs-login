/**
 * JWT 인증 미들웨어 (link, identities API용)
 */
const tokens = require("./tokens");
const { errorWithCode } = require("./response");

function getBearerToken(req) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) return null;
  return auth.slice(7);
}

function authMiddleware(req, res, next) {
  const token = getBearerToken(req);
  if (!token) {
    return errorWithCode(res, "UNAUTHORIZED", "Missing or invalid Authorization header", {}, 401);
  }
  try {
    const payload = tokens.verifyAccessToken(token);
    req.userId = payload.sub;
    req.sessionId = payload.session_id;
    next();
  } catch (err) {
    return errorWithCode(res, "UNAUTHORIZED", "Invalid or expired access token", {}, 401);
  }
}

module.exports = { authMiddleware, getBearerToken };
