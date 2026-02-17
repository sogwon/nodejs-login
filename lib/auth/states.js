/**
 * PKCE state/nonce 임시 저장
 */
const db = require("../db");
const { hashToken } = require("./crypto");

const STATE_TTL_SEC = 600; // 10분

async function saveState(provider, state, options = {}) {
  const id = state;
  const expiresAt = new Date(Date.now() + STATE_TTL_SEC * 1000);
  await db.query(
    "INSERT INTO auth_states (id, provider, state, nonce, code_verifier, redirect_uri, linking_user_id, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [
      id,
      provider,
      state,
      options.nonce || null,
      options.codeVerifier || null,
      options.redirectUri || null,
      options.linkingUserId || null,
      expiresAt,
    ]
  );
}

async function getAndConsumeState(state) {
  const row = await db.queryOne(
    "SELECT * FROM auth_states WHERE id = ? AND expires_at > NOW(3)",
    [state]
  );
  if (!row) return null;
  await db.query("DELETE FROM auth_states WHERE id = ?", [state]);
  return row;
}

async function getState(state) {
  return db.queryOne(
    "SELECT * FROM auth_states WHERE id = ? AND expires_at > NOW(3)",
    [state]
  );
}

module.exports = { saveState, getAndConsumeState, getState };
