/**
 * JWT Access Token, Opaque Refresh Token
 * - Access: 5~15분, Refresh: 30~90일, Rotation + Reuse detection
 */
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const db = require("../db");
const { hashToken } = require("./crypto");

const ACCESS_EXPIRES_IN = parseInt(process.env.ACCESS_TOKEN_EXPIRES_IN || "900", 10); // 15분
const REFRESH_EXPIRES_IN = parseInt(process.env.REFRESH_TOKEN_EXPIRES_IN || "2592000", 10); // 30일
const JWT_SECRET = process.env.JWT_SECRET || process.env.JWT_PRIVATE_KEY || "change-me-in-production";
const JWT_ISSUER = process.env.JWT_ISSUER || "auth.example.com";

function generateOpaqueRefreshToken() {
  return crypto.randomBytes(32).toString("hex");
}

function signAccessToken(payload) {
  return jwt.sign(
    {
      sub: payload.sub,
      session_id: payload.session_id,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + ACCESS_EXPIRES_IN,
      iss: JWT_ISSUER,
      aud: payload.aud || "api",
    },
    JWT_SECRET,
    { algorithm: "HS256" }
  );
}

function verifyAccessToken(token) {
  return jwt.verify(token, JWT_SECRET, {
    algorithms: ["HS256"],
    issuer: JWT_ISSUER,
  });
}

async function createSession(userId, deviceId) {
  const sessionId = db.uuid();
  await db.query(
    "INSERT INTO sessions (id, user_id, device_id) VALUES (?, ?, ?)",
    [sessionId, userId, deviceId || null]
  );
  return sessionId;
}

async function createRefreshToken(sessionId, rotatedFromId = null) {
  const id = db.uuid();
  const opaque = generateOpaqueRefreshToken();
  const tokenHash = hashToken(opaque);
  const expiresAt = new Date(Date.now() + REFRESH_EXPIRES_IN * 1000);
  await db.query(
    "INSERT INTO refresh_tokens (id, session_id, token_hash, expires_at, rotated_from_id) VALUES (?, ?, ?, ?, ?)",
    [id, sessionId, tokenHash, expiresAt, rotatedFromId]
  );
  return { id, opaque, expiresAt };
}

async function findRefreshTokenByHash(tokenHash) {
  const row = await db.queryOne(
    "SELECT rt.id, rt.session_id, rt.expires_at, rt.revoked_at, rt.rotated_from_id, s.user_id FROM refresh_tokens rt JOIN sessions s ON s.id = rt.session_id WHERE rt.token_hash = ? AND rt.expires_at > NOW(3) AND rt.revoked_at IS NULL AND s.revoked_at IS NULL",
    [tokenHash]
  );
  return row;
}

async function findRefreshTokenRecordByHash(tokenHash) {
  const row = await db.queryOne(
    "SELECT rt.id, rt.session_id, rt.expires_at, rt.revoked_at, rt.rotated_from_id, s.user_id, s.revoked_at as session_revoked_at FROM refresh_tokens rt JOIN sessions s ON s.id = rt.session_id WHERE rt.token_hash = ?",
    [tokenHash]
  );
  return row;
}

/** Reuse detection: 이전 토큰이 이미 rotate 되었는지 확인 */
async function isRefreshTokenReused(refreshTokenId) {
  const row = await db.queryOne(
    "SELECT id FROM refresh_tokens WHERE rotated_from_id = ? AND revoked_at IS NULL",
    [refreshTokenId]
  );
  return !!row;
}

async function hasRefreshTokenRotatedChild(refreshTokenId) {
  const row = await db.queryOne(
    "SELECT id FROM refresh_tokens WHERE rotated_from_id = ? LIMIT 1",
    [refreshTokenId]
  );
  return !!row;
}

async function revokeRefreshToken(refreshTokenId) {
  await db.query(
    "UPDATE refresh_tokens SET revoked_at = NOW(3) WHERE id = ?",
    [refreshTokenId]
  );
}

async function revokeSession(sessionId) {
  await db.query(
    "UPDATE sessions SET revoked_at = NOW(3) WHERE id = ?",
    [sessionId]
  );
  await db.query(
    "UPDATE refresh_tokens SET revoked_at = NOW(3) WHERE session_id = ?",
    [sessionId]
  );
}

module.exports = {
  ACCESS_EXPIRES_IN,
  REFRESH_EXPIRES_IN,
  signAccessToken,
  verifyAccessToken,
  generateOpaqueRefreshToken,
  createSession,
  createRefreshToken,
  findRefreshTokenByHash,
  findRefreshTokenRecordByHash,
  isRefreshTokenReused,
  hasRefreshTokenRotatedChild,
  revokeRefreshToken,
  revokeSession,
};
