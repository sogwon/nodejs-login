/**
 * 비밀번호 해시: bcrypt (Argon2id는 선택 시 추가)
 */
const bcrypt = require("bcrypt");

const SALT_ROUNDS = 12;

async function hashPassword(plain) {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

module.exports = { hashPassword, verifyPassword };
