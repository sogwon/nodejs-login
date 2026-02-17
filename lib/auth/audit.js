/**
 * 감사 로그 (토큰/OTP 원문 로깅 금지)
 */
const db = require("../db");

async function log(action, options = {}) {
  const { userId, resource, ip, userAgent, details } = options;
  await db.query(
    "INSERT INTO audit_logs (user_id, action, resource, ip, user_agent, details) VALUES (?, ?, ?, ?, ?, ?)",
    [
      userId || null,
      action,
      resource || null,
      ip || null,
      userAgent ? String(userAgent).slice(0, 512) : null,
      details ? JSON.stringify(details) : null,
    ]
  );
}

module.exports = { log };
