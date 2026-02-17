/**
 * POST /v1/auth/link/oidc/:provider/start
 * POST /v1/auth/link/oidc/:provider/exchange
 * DELETE /v1/auth/identities/:identityId
 */
const { getAdapter, getProviderConfig } = require("../../lib/auth/providers");
const { saveState, getAndConsumeState } = require("../../lib/auth/states");
const userIdentity = require("../../lib/auth/user-identity");
const tokens = require("../../lib/auth/tokens");
const { success, errorWithCode } = require("../../lib/auth/response");
const audit = require("../../lib/auth/audit");
const crypto = require("../../lib/auth/crypto");

async function linkOidcStart(req, res) {
  const userId = req.userId;
  if (!userId) return errorWithCode(res, "UNAUTHORIZED", "Authentication required", {}, 401);

  const provider = req.params.provider;
  const body = req.body || {};
  const { redirectUri, codeChallenge, codeChallengeMethod, state: clientState, nonce: clientNonce } = body;

  try {
    const config = await getProviderConfig(provider);
    if (!config) return errorWithCode(res, "NOT_FOUND", "Provider not found", {}, 404);

    const adapter = await getAdapter(provider);
    const pkceRequired = config.pkce_required !== 0;
    let codeVerifier = null;
    let codeChallengeFinal = codeChallenge;
    let codeChallengeMethodFinal = codeChallengeMethod || "S256";
    if (pkceRequired) {
      if (!codeChallenge) {
        codeVerifier = crypto.generateCodeVerifier();
        codeChallengeFinal = crypto.generateCodeChallenge(codeVerifier);
        codeChallengeMethodFinal = "S256";
      }
    }

    const state = clientState || crypto.generateState();
    const nonce = clientNonce || crypto.generateNonce();
    await saveState(provider, state, {
      nonce,
      codeVerifier,
      redirectUri,
      linkingUserId: userId,
    });

    const authUrl = await adapter.getAuthorizationUrl({
      redirectUri,
      codeChallenge: codeChallengeFinal,
      codeChallengeMethod: codeChallengeMethodFinal,
      state,
      nonce,
      linking: true,
    });

    return success(res, { authorizationUrl: authUrl, state, ...(codeVerifier ? { codeVerifier } : {}) });
  } catch (err) {
    console.error("linkOidcStart", err);
    return errorWithCode(res, "INTERNAL_ERROR", err.message);
  }
}

async function linkOidcExchange(req, res) {
  const userId = req.userId;
  if (!userId) return errorWithCode(res, "UNAUTHORIZED", "Authentication required", {}, 401);

  const provider = req.params.provider;
  const body = req.body || {};
  const { code, redirectUri, codeVerifier, state } = body;

  if (!code || !redirectUri) {
    return errorWithCode(res, "INVALID_REQUEST", "code and redirectUri required");
  }

  try {
    const stateRow = await getAndConsumeState(state);
    if (!stateRow || stateRow.provider !== provider || stateRow.linking_user_id !== userId) {
      return errorWithCode(res, "INVALID_REQUEST", "Invalid or expired state");
    }

    const adapter = await getAdapter(provider);
    if (!adapter) return errorWithCode(res, "NOT_FOUND", "Provider not found", {}, 404);

    const config = await getProviderConfig(provider);
    const verifier = codeVerifier || stateRow.code_verifier;
    if (config.pkce_required && !verifier) {
      return errorWithCode(res, "INVALID_REQUEST", "codeVerifier required");
    }

    const idpTokens = await adapter.exchangeCodeForTokens(code, verifier, redirectUri);
    const profile = await adapter.getUserProfile(idpTokens);
    const nonce = stateRow.nonce;
    let claims = profile;
    if (idpTokens.id_token) {
      claims = await adapter.verifyIdToken(idpTokens.id_token, nonce);
    }

    const existing = await userIdentity.findIdentityByProviderSubject(provider, profile.subject || claims.sub);
    if (existing && existing.user_id !== userId) {
      return errorWithCode(res, "CONFLICT", "This identity is already linked to another account", {}, 409);
    }
    if (existing && existing.user_id === userId) {
      return success(res, { linked: true, message: "Already linked" });
    }

    await userIdentity.createIdentity(userId, {
      provider,
      subject: profile.subject || claims.sub,
      email: profile.email,
    });

    await audit.log("identity_linked", {
      userId,
      ip: req.ip,
      userAgent: req.get("user-agent"),
      resource: provider,
    });

    return success(res, { linked: true });
  } catch (err) {
    console.error("linkOidcExchange", err);
    return errorWithCode(res, "INTERNAL_ERROR", err.message);
  }
}

async function deleteIdentity(req, res) {
  const userId = req.userId;
  if (!userId) return errorWithCode(res, "UNAUTHORIZED", "Authentication required", {}, 401);

  const identityId = req.params.identityId;
  const identity = await userIdentity.getIdentityById(identityId);
  if (!identity) return errorWithCode(res, "NOT_FOUND", "Identity not found", {}, 404);
  if (identity.user_id !== userId) {
    return errorWithCode(res, "FORBIDDEN", "Not your identity", {}, 403);
  }

  const result = await userIdentity.deleteIdentity(identityId);
  if (result.error === "LAST_IDENTITY") {
    return errorWithCode(res, "INVALID_REQUEST", "At least one login method must remain", {}, 400);
  }

  await audit.log("identity_unlinked", {
    userId,
    ip: req.ip,
    userAgent: req.get("user-agent"),
    resource: identityId,
    details: { provider: identity.provider },
  });

  return success(res, {});
}

module.exports = { linkOidcStart, linkOidcExchange, deleteIdentity };
