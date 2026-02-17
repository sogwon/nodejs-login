/**
 * POST /v1/auth/otp/send
 * POST /v1/auth/otp/verify
 */
const db = require("../../lib/db");
const crypto = require("../../lib/auth/crypto");
const userIdentity = require("../../lib/auth/user-identity");
const tokens = require("../../lib/auth/tokens");
const { success, errorWithCode } = require("../../lib/auth/response");
const audit = require("../../lib/auth/audit");

const OTP_TTL_SEC = 300; // 5분
const OTP_MAX_ATTEMPTS = 5;
const OTP_LOCK_MINUTES = 15;
const OTP_CODE_LENGTH = 6;

function generateOtpCode() {
  const n = Math.floor(Math.random() * Math.pow(10, OTP_CODE_LENGTH));
  return n.toString().padStart(OTP_CODE_LENGTH, "0");
}

function normalizePhone(phone) {
  if (!phone || typeof phone !== "string") return null;
  return phone.trim().replace(/\s/g, "");
}

async function otpSend(req, res) {
  const { channel, phone, purpose } = req.body || {};
  const phoneNorm = normalizePhone(phone);
  if (!phoneNorm) {
    return errorWithCode(res, "INVALID_REQUEST", "phone required");
  }
  if (!channel || !["sms", "whatsapp"].includes(channel)) {
    return errorWithCode(res, "INVALID_REQUEST", "channel must be sms or whatsapp");
  }

  try {
    const id = db.uuid();
    const code = generateOtpCode();
    const codeHash = crypto.sha256(code);
    const expiresAt = new Date(Date.now() + OTP_TTL_SEC * 1000);
    await db.query(
      "INSERT INTO otp_requests (id, phone, code_hash, expires_at, purpose) VALUES (?, ?, ?, ?, ?)",
      [id, phoneNorm, codeHash, expiresAt, purpose || "login"]
    );

    // 실제 SMS/WhatsApp 발송은 외부 서비스 연동 (여기서는 로그만, 개발 시 코드 노출 금지)
    if (process.env.NODE_ENV === "development" && process.env.OTP_DEBUG === "1") {
      console.warn("[OTP_DEBUG] code for " + phoneNorm + " (do not log in production):", code);
    }
    // TODO: SMS gateway 호출 예: await sendSms(phoneNorm, `Your code: ${code}`);

    await audit.log("otp_send", {
      ip: req.ip,
      userAgent: req.get("user-agent"),
      resource: "otp",
      details: { channel, purpose: purpose || "login" },
    });

    return success(res, { expiresIn: OTP_TTL_SEC });
  } catch (err) {
    console.error("otpSend", err);
    return errorWithCode(res, "INTERNAL_ERROR", err.message);
  }
}

async function otpVerify(req, res) {
  const { phone, code, deviceId } = req.body || {};
  const phoneNorm = normalizePhone(phone);
  if (!phoneNorm || !code) {
    return errorWithCode(res, "INVALID_REQUEST", "phone and code required");
  }

  try {
    const row = await db.queryOne(
      "SELECT id, code_hash, expires_at, attempts, locked_until FROM otp_requests WHERE phone = ? ORDER BY created_at DESC LIMIT 1",
      [phoneNorm]
    );
    if (!row) {
      return errorWithCode(res, "INVALID_REQUEST", "No OTP request found. Request a new code.");
    }
    if (new Date(row.expires_at) < new Date()) {
      return errorWithCode(res, "INVALID_REQUEST", "OTP expired. Request a new code.");
    }
    if (row.locked_until && new Date(row.locked_until) > new Date()) {
      return errorWithCode(res, "INVALID_REQUEST", "Too many attempts. Try again later.");
    }

    const codeHash = crypto.sha256(String(code).trim());
    if (codeHash !== row.code_hash) {
      const attempts = (row.attempts || 0) + 1;
      if (attempts >= OTP_MAX_ATTEMPTS) {
        const lockedUntil = new Date(Date.now() + OTP_LOCK_MINUTES * 60 * 1000);
        await db.query(
          "UPDATE otp_requests SET attempts = ?, locked_until = ? WHERE id = ?",
          [attempts, lockedUntil, row.id]
        );
        return errorWithCode(res, "INVALID_REQUEST", "Too many failed attempts. Try again later.");
      }
      await db.query("UPDATE otp_requests SET attempts = ? WHERE id = ?", [
        attempts,
        row.id,
      ]);
      return errorWithCode(res, "INVALID_CREDENTIALS", "Invalid code", {}, 401);
    }

    await db.query(
      "UPDATE otp_requests SET attempts = 999 WHERE id = ?",
      [row.id]
    );

    const identity = await userIdentity.findIdentityByProviderSubject(
      "phone",
      phoneNorm
    );
    let userId;
    let isNewUser = false;
    if (identity) {
      userId = identity.user_id;
      await userIdentity.updateIdentityLastLogin(identity.id);
    } else {
      userId = await userIdentity.createUser();
      await userIdentity.createIdentity(userId, {
        provider: "phone",
        subject: phoneNorm,
        phone: phoneNorm,
      });
      isNewUser = true;
    }

    const sessionId = await tokens.createSession(userId, deviceId);
    const accessToken = tokens.signAccessToken({
      sub: userId,
      session_id: sessionId,
    });
    const refresh = await tokens.createRefreshToken(sessionId);

    await audit.log("otp_verify", {
      userId,
      ip: req.ip,
      userAgent: req.get("user-agent"),
      resource: "otp",
      details: { isNewUser },
    });

    return success(res, {
      user: { id: userId, phone: phoneNorm },
      tokens: {
        accessToken,
        expiresIn: tokens.ACCESS_EXPIRES_IN,
        refreshToken: refresh.opaque,
        refreshExpiresIn: tokens.REFRESH_EXPIRES_IN,
      },
      isNewUser,
    });
  } catch (err) {
    console.error("otpVerify", err);
    return errorWithCode(res, "INTERNAL_ERROR", err.message);
  }
}

module.exports = { otpSend, otpVerify };
