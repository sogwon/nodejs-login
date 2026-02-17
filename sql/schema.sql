-- Auth API 서버 스키마
-- MySQL 8.0+ / utf8mb4

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- 사용자 (서비스 내부 고유 ID)
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) PRIMARY KEY,
  status ENUM('active','suspended','deleted') NOT NULL DEFAULT 'active',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Identity: 로그인 수단별 외부 식별자 (provider+subject unique)
CREATE TABLE IF NOT EXISTS identities (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  provider VARCHAR(64) NOT NULL,
  subject VARCHAR(512) NOT NULL,
  email VARCHAR(255) NULL,
  phone VARCHAR(32) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  last_login_at DATETIME(3) NULL,
  UNIQUE KEY uq_identity_provider_subject (provider, subject(255)),
  KEY idx_identities_user_id (user_id),
  KEY idx_identities_email (email),
  KEY idx_identities_phone (phone),
  CONSTRAINT fk_identities_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 비밀번호(이메일/패스워드 Identity용)
CREATE TABLE IF NOT EXISTS user_passwords (
  user_id VARCHAR(36) PRIMARY KEY,
  password_hash VARCHAR(255) NOT NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_passwords_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 세션 (디바이스/클라이언트 단위)
CREATE TABLE IF NOT EXISTS sessions (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  device_id VARCHAR(128) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  last_seen_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  revoked_at DATETIME(3) NULL,
  KEY idx_sessions_user_id (user_id),
  KEY idx_sessions_device (user_id, device_id(64)),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Refresh 토큰 (해시만 저장, rotation + reuse detection)
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id VARCHAR(36) PRIMARY KEY,
  session_id VARCHAR(36) NOT NULL,
  token_hash VARCHAR(64) NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  rotated_from_id VARCHAR(36) NULL,
  revoked_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_refresh_session (session_id),
  KEY idx_refresh_hash (token_hash),
  KEY idx_refresh_expires (expires_at),
  CONSTRAINT fk_refresh_session FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- OTP 요청 (SMS/WhatsApp 등)
CREATE TABLE IF NOT EXISTS otp_requests (
  id VARCHAR(36) PRIMARY KEY,
  phone VARCHAR(32) NOT NULL,
  code_hash VARCHAR(64) NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  locked_until DATETIME(3) NULL,
  purpose VARCHAR(32) NOT NULL DEFAULT 'login',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_otp_phone (phone),
  KEY idx_otp_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- IdP 설정 (DB화, 코드 변경 최소화)
CREATE TABLE IF NOT EXISTS auth_providers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  provider_key VARCHAR(64) NOT NULL UNIQUE,
  protocol ENUM('oidc','oauth2','saml') NOT NULL DEFAULT 'oidc',
  issuer VARCHAR(512) NULL,
  discovery_url VARCHAR(512) NULL,
  client_id VARCHAR(512) NOT NULL,
  client_secret TEXT NULL,
  scopes VARCHAR(512) NOT NULL DEFAULT 'openid email profile',
  enabled TINYINT(1) NOT NULL DEFAULT 1,
  button_visible TINYINT(1) NOT NULL DEFAULT 1,
  display_name VARCHAR(128) NULL,
  token_auth_method VARCHAR(32) NOT NULL DEFAULT 'client_secret_post',
  pkce_required TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY idx_providers_enabled (enabled, button_visible)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 감사 로그 (토큰/OTP 원문 로깅 금지)
CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(36) NULL,
  action VARCHAR(64) NOT NULL,
  resource VARCHAR(128) NULL,
  ip VARCHAR(45) NULL,
  user_agent VARCHAR(512) NULL,
  details JSON NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_audit_user (user_id),
  KEY idx_audit_action (action),
  KEY idx_audit_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- PKCE state/nonce 임시 저장 (만료 후 정리)
CREATE TABLE IF NOT EXISTS auth_states (
  id VARCHAR(64) PRIMARY KEY,
  provider VARCHAR(64) NOT NULL,
  state VARCHAR(64) NOT NULL,
  nonce VARCHAR(64) NULL,
  code_verifier VARCHAR(128) NULL,
  redirect_uri VARCHAR(512) NULL,
  linking_user_id VARCHAR(36) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  expires_at DATETIME(3) NOT NULL,
  KEY idx_states_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
