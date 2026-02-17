/**
 * GET /v1/auth/providers - Provider 목록/메타데이터
 */
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const { listProviders } = require("../../lib/auth/providers");
const { success, errorWithCode } = require("../../lib/auth/response");

const AUTH_BASE_URL =
  process.env.AUTH_BASE_URL || process.env.BASE_URL || "https://auth.example.com";

async function getProviders(req, res) {
  try {
    const providers = await listProviders(true);
    const list = providers.map((p) => ({
      provider: p.provider_key,
      type: p.protocol === "oidc" ? "oidc" : "oauth2",
      displayName: p.display_name || p.provider_key,
      enabled: !!p.enabled,
      authUrl: `${AUTH_BASE_URL}/v1/auth/oidc/${p.provider_key}/start`,
      scopes: (p.scopes || "openid email profile").split(/\s+/).filter(Boolean),
    }));
    return success(res, { providers: list });
  } catch (err) {
    console.error("getProviders", err);
    return errorWithCode(res, "INTERNAL_ERROR", err.message);
  }
}

module.exports = { getProviders };
