/**
 * OIDC start / exchange
 * POST /v1/auth/oidc/:provider/start
 * POST /v1/auth/oidc/:provider/exchange
 */
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const { getAdapter, getProviderConfig } = require("../../lib/auth/providers");
const { saveState, getAndConsumeState } = require("../../lib/auth/states");
const { success, errorWithCode } = require("../../lib/auth/response");
const {
  generateCodeVerifier,
  generateCodeChallenge,
  generateState,
  generateNonce,
} = require("../../lib/auth/crypto");
const tokens = require("../../lib/auth/tokens");
const userIdentity = require("../../lib/auth/user-identity");
const audit = require("../../lib/auth/audit");

const AUTH_BASE_URL =
  process.env.AUTH_BASE_URL || process.env.BASE_URL || "https://auth.example.com";

async function oidcStart(req, res) {
  const provider = req.params.provider;
  const body = req.body || {};
  const {
    clientType,
    redirectUri,
    codeChallenge,
    codeChallengeMethod,
    state: clientState,
    nonce: clientNonce,
    loginHint,
    linking,
  } = body;

  try {
    const config = await getProviderConfig(provider);
    if (!config) return errorWithCode(res, "NOT_FOUND", "Provider not found", {}, 404);

    const adapter = await getAdapter(provider);
    const pkceRequired = config.pkce_required !== 0;
    let codeVerifier = null;
    let codeChallengeFinal = codeChallenge;
    let codeChallengeMethodFinal = codeChallengeMethod || "S256";
    if (pkceRequired) {
      if (!codeChallenge && clientType !== "web") {
        codeVerifier = generateCodeVerifier();
        codeChallengeFinal = generateCodeChallenge(codeVerifier);
        codeChallengeMethodFinal = "S256";
      } else if (!codeChallenge) {
        return errorWithCode(res, "INVALID_REQUEST", "codeChallenge required");
      }
    }

    const state = clientState || generateState();
    const nonce = clientNonce || generateNonce();
    await saveState(provider, state, {
      nonce,
      codeVerifier,
      redirectUri,
      linkingUserId: linking ? req.userId : null,
    });

    const authUrl = await adapter.getAuthorizationUrl({
      redirectUri,
      codeChallenge: codeChallengeFinal,
      codeChallengeMethod: codeChallengeMethodFinal,
      state,
      nonce,
      loginHint,
      linking: !!linking,
    });

    return success(res, {
      authorizationUrl: authUrl,
      state,
      ...(codeVerifier ? { codeVerifier } : {}),
    });
  } catch (err) {
    console.error("oidcStart", err);
    return errorWithCode(res, "INTERNAL_ERROR", err.message);
  }
}

async function oidcExchange(req, res) {
  const provider = req.params.provider;
  const body = req.body || {};
  const { code, redirectUri, codeVerifier, state, device } = body;

  if (!code || !redirectUri) {
    return errorWithCode(res, "INVALID_REQUEST", "code and redirectUri required");
  }

  try {
    const stateRow = await getAndConsumeState(state);
    if (!stateRow || stateRow.provider !== provider) {
      return errorWithCode(res, "INVALID_REQUEST", "Invalid or expired state");
    }

    const adapter = await getAdapter(provider);
    if (!adapter) return errorWithCode(res, "NOT_FOUND", "Provider not found", {}, 404);

    const config = await getProviderConfig(provider);
    const verifier = codeVerifier || stateRow.code_verifier;
    if (config.pkce_required && !verifier) {
      return errorWithCode(res, "INVALID_REQUEST", "codeVerifier required");
    }

    const idpTokens = await adapter.exchangeCodeForTokens(
      code,
      verifier,
      redirectUri
    );
    let profile = await adapter.getUserProfile(idpTokens);
    const nonce = stateRow.nonce;
    if (idpTokens.id_token) {
      const claims = await adapter.verifyIdToken(idpTokens.id_token, nonce);
      profile = { ...profile, subject: claims.sub };
    }

    const identityRow = await userIdentity.findIdentityByProviderSubject(
      provider,
      profile.subject
    );
    let userId;
    let isNewUser = false;
    const deviceId = device?.deviceId || null;

    if (stateRow.linking_user_id) {
      userId = stateRow.linking_user_id;
      const existing = await userIdentity.findIdentityByProviderSubject(
        provider,
        profile.subject
      );
      if (existing && existing.user_id !== userId) {
        return errorWithCode(
          res,
          "CONFLICT",
          "This identity is already linked to another account",
          {},
          409
        );
      }
      if (!existing) {
        await userIdentity.createIdentity(userId, {
          provider,
          subject: profile.subject,
          email: profile.email,
        });
      }
    } else if (identityRow) {
      userId = identityRow.user_id;
      await userIdentity.updateIdentityLastLogin(identityRow.id);
    } else {
      userId = await userIdentity.createUser();
      await userIdentity.createIdentity(userId, {
        provider,
        subject: profile.subject,
        email: profile.email,
      });
      isNewUser = true;
    }

    const sessionId = await tokens.createSession(userId, deviceId);
    const accessToken = tokens.signAccessToken({
      sub: userId,
      session_id: sessionId,
    });
    const refresh = await tokens.createRefreshToken(sessionId);

    await audit.log("oidc_exchange", {
      userId,
      ip: req.ip,
      userAgent: req.get("user-agent"),
      resource: provider,
      details: { isNewUser },
    });

    const user = await userIdentity.findUserById(userId);
    const identities = await userIdentity.findIdentitiesByUserId(userId);
    const primaryEmail =
      identities.find((i) => i.email)?.email || profile.email;

    return success(res, {
      user: {
        id: userId,
        email: primaryEmail,
      },
      tokens: {
        accessToken,
        expiresIn: tokens.ACCESS_EXPIRES_IN,
        refreshToken: refresh.opaque,
        refreshExpiresIn: tokens.REFRESH_EXPIRES_IN,
      },
      isNewUser,
    });
  } catch (err) {
    console.error("oidcExchange", err);
    return errorWithCode(res, "INTERNAL_ERROR", err.message);
  }
}

module.exports = { oidcStart, oidcExchange };
