/**
 * POST /v1/auth/token/refresh
 * POST /v1/auth/logout
 */
const tokens = require("../../lib/auth/tokens");
const { hashToken } = require("../../lib/auth/crypto");
const userIdentity = require("../../lib/auth/user-identity");
const { success, errorWithCode } = require("../../lib/auth/response");
const audit = require("../../lib/auth/audit");

async function tokenRefresh(req, res) {
  const { refreshToken, deviceId } = req.body || {};
  if (!refreshToken) {
    return errorWithCode(res, "INVALID_REQUEST", "refreshToken required");
  }

  try {
    const tokenHash = hashToken(refreshToken);
    const row = await tokens.findRefreshTokenByHash(tokenHash);
    if (!row) {
      const known = await tokens.findRefreshTokenRecordByHash(tokenHash);
      if (known) {
        const rotated = await tokens.hasRefreshTokenRotatedChild(known.id);
        if (rotated) {
          await tokens.revokeSession(known.session_id);
          await audit.log("refresh_reuse_detected", {
            userId: known.user_id,
            ip: req.ip,
            userAgent: req.get("user-agent"),
            resource: "session",
            details: { refreshTokenId: known.id },
          });
          return errorWithCode(
            res,
            "REFRESH_TOKEN_REUSED",
            "Refresh token reuse detected. Session revoked."
          );
        }
      }
      return errorWithCode(res, "UNAUTHORIZED", "Invalid or expired refresh token", {}, 401);
    }

    const reused = await tokens.isRefreshTokenReused(row.id);
    if (reused) {
      await tokens.revokeSession(row.session_id);
      await audit.log("refresh_reuse_detected", {
        userId: row.user_id,
        ip: req.ip,
        userAgent: req.get("user-agent"),
        resource: "session",
      });
      return errorWithCode(res, "UNAUTHORIZED", "Refresh token reuse detected. Session revoked.", {}, 401);
    }

    await tokens.revokeRefreshToken(row.id);
    const newRefresh = await tokens.createRefreshToken(row.session_id, row.id);
    const accessToken = tokens.signAccessToken({
      sub: row.user_id,
      session_id: row.session_id,
    });

    const identities = await userIdentity.findIdentitiesByUserId(row.user_id);
    const primaryEmail = identities.find((i) => i.email)?.email;
    const primaryPhone = identities.find((i) => i.phone)?.phone;

    return success(res, {
      user: { id: row.user_id, email: primaryEmail, phone: primaryPhone },
      tokens: {
        accessToken,
        expiresIn: tokens.ACCESS_EXPIRES_IN,
        refreshToken: newRefresh.opaque,
        refreshExpiresIn: tokens.REFRESH_EXPIRES_IN,
      },
    });
  } catch (err) {
    console.error("tokenRefresh", err);
    return errorWithCode(res, "INTERNAL_ERROR", err.message);
  }
}

async function logout(req, res) {
  const { refreshToken } = req.body || {};
  if (!refreshToken) {
    return success(res, {});
  }

  try {
    const tokenHash = hashToken(refreshToken);
    const row = await tokens.findRefreshTokenByHash(tokenHash);
    if (row) {
      await tokens.revokeRefreshToken(row.id);
      await audit.log("logout", {
        userId: row.user_id,
        ip: req.ip,
        userAgent: req.get("user-agent"),
        resource: "session",
      });
    }
    return success(res, {});
  } catch (err) {
    console.error("logout", err);
    return errorWithCode(res, "INTERNAL_ERROR", err.message);
  }
}

module.exports = { tokenRefresh, logout };
