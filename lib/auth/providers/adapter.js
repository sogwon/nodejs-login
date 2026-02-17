/**
 * Provider Adapter 인터페이스 (플러그인)
 * - getAuthorizationUrl(params) -> url
 * - exchangeCodeForTokens(code, verifier, redirectUri) -> { access_token, id_token, ... }
 * - verifyIdToken(id_token, nonce) -> claims
 * - getUserProfile(tokens) -> { subject, email, email_verified, name, ... }
 */
class ProviderAdapter {
  constructor(config) {
    this.config = config; // auth_providers row
  }

  get providerKey() {
    return this.config.provider_key;
  }

  /**
   * @param {Object} params - { redirectUri, codeChallenge, codeChallengeMethod, state, nonce, loginHint, linking }
   * @returns {string} authorizationUrl
   */
  async getAuthorizationUrl(params) {
    throw new Error("getAuthorizationUrl not implemented");
  }

  /**
   * @param {string} code
   * @param {string} codeVerifier
   * @param {string} redirectUri
   * @returns {Promise<{ access_token?, id_token?, refresh_token?, expires_in? }>}
   */
  async exchangeCodeForTokens(code, codeVerifier, redirectUri) {
    throw new Error("exchangeCodeForTokens not implemented");
  }

  /**
   * @param {string} idToken
   * @param {string} [nonce]
   * @returns {Promise<{ sub, email?, email_verified?, name? }>}
   */
  async verifyIdToken(idToken, nonce) {
    throw new Error("verifyIdToken not implemented");
  }

  /**
   * @param {Object} tokens - IdP에서 받은 토큰
   * @returns {Promise<{ subject, email?, email_verified?, name? }>}
   */
  async getUserProfile(tokens) {
    throw new Error("getUserProfile not implemented");
  }
}

module.exports = { ProviderAdapter };
