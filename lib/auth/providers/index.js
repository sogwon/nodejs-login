/**
 * Provider Adapter 레지스트리
 * - DB auth_providers에서 로드, protocol에 따라 OIDC/OAuth2 어댑터 반환
 */
const db = require("../../db");
const { GenericOIDCAdapter } = require("./oidc-generic");

const adapterCache = new Map();

function getAdapterClass(protocol) {
  switch (protocol) {
    case "oidc":
    case "oauth2":
      return GenericOIDCAdapter;
    default:
      return GenericOIDCAdapter;
  }
}

async function getProviderConfig(providerKey) {
  const row = await db.queryOne(
    "SELECT * FROM auth_providers WHERE provider_key = ? AND enabled = 1",
    [providerKey]
  );
  return row;
}

async function getAdapter(providerKey) {
  if (adapterCache.has(providerKey)) {
    return adapterCache.get(providerKey);
  }
  const config = await getProviderConfig(providerKey);
  if (!config) return null;
  const AdapterClass = getAdapterClass(config.protocol);
  const adapter = new AdapterClass(config);
  adapterCache.set(providerKey, adapter);
  return adapter;
}

function clearAdapterCache(providerKey) {
  if (providerKey) adapterCache.delete(providerKey);
  else adapterCache.clear();
}

async function listProviders(buttonVisibleOnly = true) {
  let sql =
    "SELECT provider_key, protocol, display_name, enabled, button_visible, scopes FROM auth_providers WHERE enabled = 1";
  const params = [];
  if (buttonVisibleOnly) {
    sql += " AND button_visible = 1";
  }
  sql += " ORDER BY id";
  return db.query(sql, params);
}

module.exports = {
  getAdapter,
  getProviderConfig,
  listProviders,
  clearAdapterCache,
};
