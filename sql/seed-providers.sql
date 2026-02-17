-- IdP 예시 (실제 client_id/secret은 .env 또는 운영 DB에서 설정)
-- 스키마 적용 후 auth_providers 테이블이 있으면 아래로 일부 IdP 등록 가능

-- Google (OIDC 표준)
INSERT INTO auth_providers (provider_key, protocol, issuer, discovery_url, client_id, client_secret, scopes, enabled, button_visible, display_name, token_auth_method, pkce_required)
VALUES ('google', 'oidc', 'https://accounts.google.com', 'https://accounts.google.com/.well-known/openid-configuration', 'YOUR_GOOGLE_CLIENT_ID', 'YOUR_GOOGLE_CLIENT_SECRET', 'openid email profile', 1, 1, 'Google', 'client_secret_post', 1)
ON DUPLICATE KEY UPDATE updated_at = NOW(3);
