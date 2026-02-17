/**
 * PKCE, nonce, state, 해시 유틸
 */
const crypto = require("crypto");

function randomBytesHex(len = 32) {
  return crypto.randomBytes(len).toString("hex");
}

function sha256(str) {
  return crypto.createHash("sha256").update(str, "utf8").digest("hex");
}

/** PKCE code_verifier (43~128자) */
function generateCodeVerifier() {
  return randomBytesHex(32);
}

/** PKCE code_challenge = BASE64URL(SHA256(verifier)) */
function generateCodeChallenge(verifier) {
  const hash = crypto.createHash("sha256").update(verifier, "utf8").digest();
  return base64UrlEncode(hash);
}

function base64UrlEncode(buf) {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** state / nonce */
function generateState() {
  return randomBytesHex(24);
}

function generateNonce() {
  return randomBytesHex(24);
}

/** refresh_token / OTP 해시 저장용 */
function hashToken(token) {
  return sha256(token);
}

module.exports = {
  randomBytesHex,
  sha256,
  generateCodeVerifier,
  generateCodeChallenge,
  generateState,
  generateNonce,
  base64UrlEncode,
  hashToken,
};
