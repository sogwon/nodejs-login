/**
 * Generic OIDC Provider (discovery 기반)
 * - 새 IdP가 OIDC 표준만 따르면 설정만으로 지원
 */
const https = require("https");
const http = require("http");
const { ProviderAdapter } = require("./adapter");
const jwt = require("jsonwebtoken");
const jwksClient = require("jwks-rsa");

const HTTP_OPTIONS = { timeout: 10000 };

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    lib
      .get(url, HTTP_OPTIONS, (res) => {
        let data = "";
        res.on("data", (ch) => (data += ch));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error("Invalid JSON from " + url));
          }
        });
      })
      .on("error", reject);
  });
}

function buildQuery(params) {
  return Object.entries(params)
    .filter(([, v]) => v != null && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
}

class GenericOIDCAdapter extends ProviderAdapter {
  constructor(config) {
    super(config);
    this._discovery = null;
    this._jwksClient = null;
  }

  async _getDiscovery() {
    if (this._discovery) return this._discovery;
    const url =
      this.config.discovery_url ||
      (this.config.issuer
        ? `${this.config.issuer.replace(/\/$/, "")}/.well-known/openid-configuration`
        : null);
    if (!url) throw new Error("OIDC discovery_url or issuer required");
    this._discovery = await fetchJson(url);
    return this._discovery;
  }

  async getAuthorizationUrl(params) {
    const discovery = await this._getDiscovery();
    const authEndpoint = discovery.authorization_endpoint;
    const scopes = (this.config.scopes || "openid email profile").split(/\s+/).filter(Boolean);
    const q = {
      response_type: "code",
      client_id: this.config.client_id,
      redirect_uri: params.redirectUri,
      scope: scopes.join(" "),
      state: params.state,
    };
    if (params.codeChallenge) {
      q.code_challenge = params.codeChallenge;
      q.code_challenge_method = params.codeChallengeMethod || "S256";
    }
    if (params.nonce) q.nonce = params.nonce;
    if (params.loginHint) q.login_hint = params.loginHint;
    if (params.prompt) q.prompt = params.prompt;
    const query = buildQuery(q);
    return `${authEndpoint}${authEndpoint.includes("?") ? "&" : "?"}${query}`;
  }

  async exchangeCodeForTokens(code, codeVerifier, redirectUri) {
    const discovery = await this._getDiscovery();
    const tokenEndpoint = discovery.token_endpoint;
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: this.config.client_id,
    });
    if (codeVerifier) body.set("code_verifier", codeVerifier);

    const auth =
      this.config.token_auth_method === "client_secret_basic" &&
      this.config.client_secret
        ? `Basic ${Buffer.from(
            `${this.config.client_id}:${this.config.client_secret}`
          ).toString("base64")}`
        : null;
    const headers = {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    };
    if (auth) headers.Authorization = auth;
    if (
      !auth &&
      this.config.token_auth_method === "client_secret_post" &&
      this.config.client_secret
    ) {
      body.set("client_secret", this.config.client_secret);
    }

    const res = await new Promise((resolve, reject) => {
      const url = new URL(tokenEndpoint);
      const lib = url.protocol === "https:" ? https : http;
      const data = body.toString();
      const opts = {
        hostname: url.hostname,
        port: url.port || (url.protocol === "https:" ? 443 : 80),
        path: url.pathname + url.search,
        method: "POST",
        headers: { ...headers, "Content-Length": Buffer.byteLength(data) },
        ...HTTP_OPTIONS,
      };
      const req = lib.request(opts, (res) => {
        let buf = "";
        res.on("data", (ch) => (buf += ch));
        res.on("end", () => {
          try {
            resolve({ statusCode: res.statusCode, body: JSON.parse(buf) });
          } catch {
            resolve({ statusCode: res.statusCode, body: buf });
          }
        });
      });
      req.on("error", reject);
      req.write(data);
      req.end();
    });

    if (res.statusCode < 200 || res.statusCode >= 300) {
      const err = new Error(
        res.body?.error_description || res.body?.error || "Token exchange failed"
      );
      err.statusCode = res.statusCode;
      throw err;
    }
    return res.body;
  }

  _getJwksClient() {
    if (this._jwksClient) return this._jwksClient;
    const issuer = this.config.issuer || (this._discovery && this._discovery.issuer);
    if (!issuer) throw new Error("issuer required for JWKS");
    const jwksUri =
      this._discovery?.jwks_uri ||
      `${issuer.replace(/\/$/, "")}/.well-known/jwks.json`;
    this._jwksClient = jwksClient({
      jwksUri,
      cache: true,
      cacheMaxAge: 600000,
      rateLimit: true,
    });
    return this._jwksClient;
  }

  getSigningKey(header, callback) {
    this._getJwksClient().getSigningKey(header.kid, (err, key) => {
      if (err) return callback(err);
      const signingKey = key?.publicKey || key?.rsaPublicKey;
      callback(null, signingKey);
    });
  }

  async verifyIdToken(idToken, nonce) {
    const discovery = await this._getDiscovery();
    const issuer =
      discovery.issuer || this.config.issuer;
    const decoded = jwt.decode(idToken, { complete: true });
    if (!decoded?.header?.kid) {
      return new Promise((resolve, reject) => {
        jwt.verify(
          idToken,
          (header, cb) => this.getSigningKey(header, cb),
          {
            algorithms: ["RS256", "ES256"],
            issuer,
            audience: this.config.client_id,
            clockTolerance: 60,
          },
          (err, payload) => {
            if (err) return reject(err);
            if (nonce && payload.nonce !== nonce) return reject(new Error("nonce mismatch"));
            resolve(payload);
          }
        );
      });
    }
    return new Promise((resolve, reject) => {
      jwt.verify(
        idToken,
        (header, cb) => this.getSigningKey(header, cb),
        {
          algorithms: ["RS256", "ES256"],
          issuer,
          audience: this.config.client_id,
          clockTolerance: 60,
        },
        (err, payload) => {
          if (err) return reject(err);
          if (nonce && payload.nonce !== nonce) return reject(new Error("nonce mismatch"));
          resolve(payload);
        }
      );
    });
  }

  async getUserProfile(tokens) {
    if (tokens.id_token) {
      const claims = await this.verifyIdToken(tokens.id_token);
      return {
        subject: claims.sub,
        email: claims.email,
        email_verified: claims.email_verified,
        name: claims.name || claims.preferred_username,
      };
    }
    const discovery = await this._getDiscovery();
    const userinfoUrl = discovery.userinfo_endpoint;
    if (!userinfoUrl) {
      throw new Error("No id_token and no userinfo_endpoint");
    }
    const res = await new Promise((resolve, reject) => {
      const url = new URL(userinfoUrl);
      const lib = url.protocol === "https:" ? https : http;
      const opts = {
        hostname: url.hostname,
        port: url.port || (url.protocol === "https:" ? 443 : 80),
        path: url.pathname + url.search,
        method: "GET",
        headers: { Authorization: `Bearer ${tokens.access_token}` },
        ...HTTP_OPTIONS,
      };
      lib
        .request(opts, (res) => {
          let buf = "";
          res.on("data", (ch) => (buf += ch));
          res.on("end", () => {
            try {
              resolve(JSON.parse(buf));
            } catch {
              reject(new Error("Invalid userinfo JSON"));
            }
          });
        })
        .on("error", reject)
        .end();
    });
    return {
      subject: res.sub,
      email: res.email,
      email_verified: res.email_verified,
      name: res.name || res.preferred_username,
    };
  }
}

module.exports = { GenericOIDCAdapter };
