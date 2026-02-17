/**
 * User / Identity 조회·생성·연결
 */
const db = require("../db");

async function findUserById(userId) {
  return db.queryOne("SELECT * FROM users WHERE id = ? AND status = 'active'", [
    userId,
  ]);
}

async function findIdentityByProviderSubject(provider, subject) {
  return db.queryOne(
    "SELECT i.*, u.status as user_status FROM identities i JOIN users u ON u.id = i.user_id WHERE i.provider = ? AND i.subject = ? AND u.status = 'active'",
    [provider, subject]
  );
}

async function findIdentitiesByUserId(userId) {
  return db.query(
    "SELECT id, provider, subject, email, phone, created_at, last_login_at FROM identities WHERE user_id = ?",
    [userId]
  );
}

async function createUser() {
  const id = db.uuid();
  await db.query("INSERT INTO users (id, status) VALUES (?, 'active')", [id]);
  return id;
}

async function createIdentity(userId, data) {
  const id = db.uuid();
  const { provider, subject, email, phone } = data;
  await db.query(
    "INSERT INTO identities (id, user_id, provider, subject, email, phone) VALUES (?, ?, ?, ?, ?, ?)",
    [id, userId, provider, subject, email || null, phone || null]
  );
  return id;
}

async function updateIdentityLastLogin(identityId) {
  await db.query(
    "UPDATE identities SET last_login_at = NOW(3) WHERE id = ?",
    [identityId]
  );
}

async function deleteIdentity(identityId) {
  const row = await db.queryOne(
    "SELECT user_id FROM identities WHERE id = ?",
    [identityId]
  );
  if (!row) return { deleted: false, error: "NOT_FOUND" };
  const count = await db.queryOne(
    "SELECT COUNT(*) as c FROM identities WHERE user_id = ?",
    [row.user_id]
  );
  if (count.c <= 1) return { deleted: false, error: "LAST_IDENTITY" };
  await db.query("DELETE FROM identities WHERE id = ?", [identityId]);
  return { deleted: true };
}

async function getIdentityById(identityId) {
  return db.queryOne("SELECT * FROM identities WHERE id = ?", [identityId]);
}

module.exports = {
  findUserById,
  findIdentityByProviderSubject,
  findIdentitiesByUserId,
  createUser,
  createIdentity,
  updateIdentityLastLogin,
  deleteIdentity,
  getIdentityById,
};
