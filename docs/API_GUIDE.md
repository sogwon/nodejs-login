# Auth API Guide

이 문서는 `nodejs-login` 프로젝트의 인증 API 사용 방법을 정리한 가이드입니다.

- Base URL (로컬): `http://localhost:3000`
- API Prefix: `/v1/auth`
- Content-Type: `application/json`

## 1) 공통 응답 포맷

### 성공 응답

```json
{
  "success": true
}
```

필요한 데이터는 `success`와 함께 추가 필드로 반환됩니다.

### 실패 응답

```json
{
  "success": false,
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Invalid email or password",
    "details": {}
  }
}
```

주요 에러 코드:

- `INVALID_REQUEST`
- `INVALID_CREDENTIALS`
- `UNAUTHORIZED`
- `REFRESH_TOKEN_REUSED`
- `FORBIDDEN`
- `NOT_FOUND`
- `CONFLICT`
- `RATE_LIMITED`
- `INTERNAL_ERROR`

## 2) 인증 모델 요약

- Access Token: JWT, 기본 900초(15분)
- Refresh Token: Opaque 문자열, 기본 2,592,000초(30일)
- Refresh Rotation: refresh 호출 시 새 refresh 발급, 이전 토큰 폐기
- Reuse Detection: 회전된 이전 refresh 재사용 시 세션 revoke + `REFRESH_TOKEN_REUSED`

## 3) 사전 준비

1. `.env` 설정
2. DB 스키마 적용

```bash
mysql -h <DB_HOST> -P <DB_PORT> -u <DB_USER> -p <DB_NAME> < sql/schema.sql
mysql -h <DB_HOST> -P <DB_PORT> -u <DB_USER> -p <DB_NAME> < sql/seed-providers.sql
```

3. 서버 실행

```bash
npm start
```

## 4) 엔드포인트 상세

---

### GET `/v1/auth/providers`

로그인 가능한 Provider 목록을 반환합니다.

#### Example

```bash
curl -X GET http://localhost:3000/v1/auth/providers
```

#### Response

```json
{
  "success": true,
  "providers": [
    {
      "provider": "google",
      "type": "oidc",
      "displayName": "Google",
      "enabled": true,
      "authUrl": "https://auth.example.com/v1/auth/oidc/google/start",
      "scopes": ["openid", "email", "profile"]
    }
  ]
}
```

---

### POST `/v1/auth/oidc/:provider/start`

OIDC/OAuth 로그인 시작 URL을 생성합니다. (PKCE, state, nonce)

#### Request

```json
{
  "clientType": "web",
  "redirectUri": "https://app.example.com/auth/callback",
  "codeChallenge": "your_code_challenge",
  "codeChallengeMethod": "S256",
  "state": "random_state",
  "nonce": "random_nonce",
  "loginHint": "user@example.com",
  "linking": false
}
```

#### Example

```bash
curl -X POST http://localhost:3000/v1/auth/oidc/google/start \
  -H "Content-Type: application/json" \
  -d '{
    "clientType":"web",
    "redirectUri":"https://app.example.com/auth/callback",
    "codeChallenge":"abc123",
    "codeChallengeMethod":"S256",
    "state":"state123",
    "nonce":"nonce123"
  }'
```

#### Response

```json
{
  "success": true,
  "authorizationUrl": "https://accounts.google.com/o/oauth2/v2/auth?...",
  "state": "state123"
}
```

---

### POST `/v1/auth/oidc/:provider/exchange`

인가 코드를 IdP 토큰으로 교환하고, 서비스 토큰(access/refresh)을 발급합니다.

#### Request

```json
{
  "code": "auth_code_from_idp",
  "redirectUri": "https://app.example.com/auth/callback",
  "codeVerifier": "code_verifier_if_needed",
  "state": "state123",
  "device": {
    "deviceId": "device-uuid",
    "platform": "ios",
    "appVersion": "1.2.3"
  }
}
```

#### Response

```json
{
  "success": true,
  "user": {
    "id": "u_123",
    "email": "a@b.com"
  },
  "tokens": {
    "accessToken": "jwt...",
    "expiresIn": 900,
    "refreshToken": "opaque...",
    "refreshExpiresIn": 2592000
  },
  "isNewUser": false
}
```

---

### POST `/v1/auth/password/signup`

Email/Password 회원가입

#### Request

```json
{
  "email": "tester@example.com",
  "password": "Passw0rd!123"
}
```

#### Example

```bash
curl -X POST http://localhost:3000/v1/auth/password/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"tester@example.com","password":"Passw0rd!123"}'
```

#### Response

```json
{
  "success": true,
  "user": {
    "id": "user_uuid",
    "email": "tester@example.com"
  }
}
```

---

### POST `/v1/auth/password/login`

Email/Password 로그인

#### Request

```json
{
  "email": "tester@example.com",
  "password": "Passw0rd!123",
  "deviceId": "device-a"
}
```

#### Example

```bash
curl -X POST http://localhost:3000/v1/auth/password/login \
  -H "Content-Type: application/json" \
  -d '{"email":"tester@example.com","password":"Passw0rd!123","deviceId":"device-a"}'
```

#### Response

```json
{
  "success": true,
  "user": {
    "id": "user_uuid",
    "email": "tester@example.com"
  },
  "tokens": {
    "accessToken": "jwt...",
    "expiresIn": 900,
    "refreshToken": "opaque...",
    "refreshExpiresIn": 2592000
  },
  "isNewUser": false
}
```

---

### POST `/v1/auth/otp/send`

OTP 코드 발송 요청

#### Request

```json
{
  "channel": "sms",
  "phone": "+821012345678",
  "purpose": "login"
}
```

#### Example

```bash
curl -X POST http://localhost:3000/v1/auth/otp/send \
  -H "Content-Type: application/json" \
  -d '{"channel":"sms","phone":"+821012345678","purpose":"login"}'
```

#### Response

```json
{
  "success": true,
  "expiresIn": 300
}
```

---

### POST `/v1/auth/otp/verify`

OTP 코드 검증 후 로그인 처리

#### Request

```json
{
  "phone": "+821012345678",
  "code": "123456",
  "deviceId": "device-b"
}
```

#### Response

```json
{
  "success": true,
  "user": {
    "id": "user_uuid",
    "phone": "+821012345678"
  },
  "tokens": {
    "accessToken": "jwt...",
    "expiresIn": 900,
    "refreshToken": "opaque...",
    "refreshExpiresIn": 2592000
  },
  "isNewUser": false
}
```

---

### POST `/v1/auth/token/refresh`

Refresh Token으로 Access/Refresh 재발급

#### Request

```json
{
  "refreshToken": "opaque...",
  "deviceId": "device-a"
}
```

#### Example

```bash
curl -X POST http://localhost:3000/v1/auth/token/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"<refresh_token>","deviceId":"device-a"}'
```

#### Response

```json
{
  "success": true,
  "user": {
    "id": "user_uuid",
    "email": "tester@example.com",
    "phone": null
  },
  "tokens": {
    "accessToken": "jwt...",
    "expiresIn": 900,
    "refreshToken": "opaque_new...",
    "refreshExpiresIn": 2592000
  }
}
```

#### Reuse Detected Response

```json
{
  "success": false,
  "error": {
    "code": "REFRESH_TOKEN_REUSED",
    "message": "Refresh token reuse detected. Session revoked.",
    "details": {}
  }
}
```

---

### POST `/v1/auth/logout`

Refresh Token 폐기

#### Request

```json
{
  "refreshToken": "opaque..."
}
```

#### Response

```json
{
  "success": true
}
```

---

### POST `/v1/auth/link/oidc/:provider/start`

현재 로그인 사용자에 다른 IdP를 연결하기 위한 시작 API

- 인증 필요: `Authorization: Bearer <accessToken>`

#### Request

```json
{
  "redirectUri": "https://app.example.com/auth/callback",
  "codeChallenge": "your_challenge",
  "codeChallengeMethod": "S256",
  "state": "link_state",
  "nonce": "link_nonce"
}
```

#### Example

```bash
curl -X POST http://localhost:3000/v1/auth/link/oidc/google/start \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -d '{
    "redirectUri":"https://app.example.com/auth/callback",
    "codeChallenge":"abc123",
    "codeChallengeMethod":"S256",
    "state":"s123",
    "nonce":"n123"
  }'
```

---

### POST `/v1/auth/link/oidc/:provider/exchange`

링킹 플로우 코드 교환 후 identity 연결

- 인증 필요: `Authorization: Bearer <accessToken>`

#### Request

```json
{
  "code": "auth_code",
  "redirectUri": "https://app.example.com/auth/callback",
  "codeVerifier": "verifier",
  "state": "link_state"
}
```

#### 주요 실패 케이스

- 다른 사용자에 이미 연결된 identity면 `409 CONFLICT`

---

### DELETE `/v1/auth/identities/:identityId`

identity 연결 해제

- 인증 필요: `Authorization: Bearer <accessToken>`
- 마지막 로그인 수단 1개는 유지되어야 함

#### 성공

```json
{
  "success": true
}
```

#### 마지막 수단 삭제 시도

```json
{
  "success": false,
  "error": {
    "code": "INVALID_REQUEST",
    "message": "At least one login method must remain",
    "details": {}
  }
}
```

## 5) Rate Limit 정책

민감 엔드포인트에 rate limit이 적용되어 있습니다.

- `/password/login`
- `/password/signup`
- `/otp/send`
- `/otp/verify`
- `/token/refresh`

한도 초과 시 `429 RATE_LIMITED`가 반환됩니다.

## 6) 보안/운영 주의사항

- 운영 환경에서 `JWT_SECRET`은 반드시 강한 값으로 설정
- DB에는 refresh token 원문이 아닌 해시만 저장
- 토큰/OTP 원문을 로그에 남기지 않도록 주의
- OIDC Provider는 `auth_providers` 테이블 설정으로 확장
- Google 외 IdP 추가 시 `issuer`/`discovery_url`/`client_id`/`client_secret` 정확히 등록

