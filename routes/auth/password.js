/**
 * POST /v1/auth/password/signup
 * POST /v1/auth/password/login
 */
const db = require("../../lib/db");
const { hashPassword, verifyPassword } = require("../../lib/auth/password");
const userIdentity = require("../../lib/auth/user-identity");
const tokens = require("../../lib/auth/tokens");
const { success, errorWithCode } = require("../../lib/auth/response");
const audit = require("../../lib/auth/audit");

function normalizeEmail(email) {
  if (!email || typeof email !== "string") return null;
  return email.trim().toLowerCase();
}

async function passwordSignup(req, res) {
  const { email, password } = req.body || {};
  const emailNorm = normalizeEmail(email);
  if (!emailNorm || !password) {
    return errorWithCode(res, "INVALID_REQUEST", "email and password required");
  }
  if (password.length < 8) {
    return errorWithCode(res, "INVALID_REQUEST", "Password must be at least 8 characters");
  }

  try {
    const existing = await userIdentity.findIdentityByProviderSubject(
      "email",
      emailNorm
    );
    if (existing) {
      return errorWithCode(res, "CONFLICT", "Email already registered", {}, 409);
    }

    const userId = await userIdentity.createUser();
    await userIdentity.createIdentity(userId, {
      provider: "email",
      subject: emailNorm,
      email: emailNorm,
    });
    const passwordHash = await hashPassword(password);
    await db.query(
      "INSERT INTO user_passwords (user_id, password_hash) VALUES (?, ?)",
      [userId, passwordHash]
    );

    await audit.log("password_signup", {
      userId,
      ip: req.ip,
      userAgent: req.get("user-agent"),
      resource: "email",
    });

    return success(res, { user: { id: userId, email: emailNorm } }, 201);
  } catch (err) {
    console.error("passwordSignup", err);
    return errorWithCode(res, "INTERNAL_ERROR", err.message);
  }
}

async function passwordLogin(req, res) {
  const { email, password, deviceId } = req.body || {};
  const emailNorm = normalizeEmail(email);
  if (!emailNorm || !password) {
    return errorWithCode(res, "INVALID_CREDENTIALS", "Invalid email or password", {}, 401);
  }

  try {
    const identity = await userIdentity.findIdentityByProviderSubject(
      "email",
      emailNorm
    );
    if (!identity) {
      return errorWithCode(res, "INVALID_CREDENTIALS", "Invalid email or password", {}, 401);
    }

    const pwRow = await db.queryOne(
      "SELECT password_hash FROM user_passwords WHERE user_id = ?",
      [identity.user_id]
    );
    if (!pwRow) {
      return errorWithCode(res, "INVALID_CREDENTIALS", "Invalid email or password", {}, 401);
    }
    const valid = await verifyPassword(password, pwRow.password_hash);
    if (!valid) {
      return errorWithCode(res, "INVALID_CREDENTIALS", "Invalid email or password", {}, 401);
    }

    await userIdentity.updateIdentityLastLogin(identity.id);
    const sessionId = await tokens.createSession(identity.user_id, deviceId);
    const accessToken = tokens.signAccessToken({
      sub: identity.user_id,
      session_id: sessionId,
    });
    const refresh = await tokens.createRefreshToken(sessionId);

    await audit.log("password_login", {
      userId: identity.user_id,
      ip: req.ip,
      userAgent: req.get("user-agent"),
      resource: "email",
    });

    const identities = await userIdentity.findIdentitiesByUserId(identity.user_id);
    const primaryEmail = identities.find((i) => i.email)?.email || emailNorm;

    return success(res, {
      user: { id: identity.user_id, email: primaryEmail },
      tokens: {
        accessToken,
        expiresIn: tokens.ACCESS_EXPIRES_IN,
        refreshToken: refresh.opaque,
        refreshExpiresIn: tokens.REFRESH_EXPIRES_IN,
      },
      isNewUser: false,
    });
  } catch (err) {
    console.error("passwordLogin", err);
    return errorWithCode(res, "INTERNAL_ERROR", err.message);
  }
}

module.exports = { passwordSignup, passwordLogin };
