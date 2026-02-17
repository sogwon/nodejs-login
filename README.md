# Node.js Login API Server

다중 로그인 수단(Email/Password, Phone OTP, OIDC)을 지원하는 인증 API 서버입니다.  
User와 Identity를 분리해 계정 연결(linking)을 지원하며, refresh token rotation/reuse detection까지 포함합니다.

## 핵심 기능

- 다중 로그인 채널
  - Email/Password
  - Phone OTP
  - OIDC Provider (Generic, DB 설정 기반 확장)
- 계정 모델
  - `users`(내부 사용자) + `identities`(외부 로그인 식별자) 분리
  - 1명의 User에 여러 Identity 연결 가능
- 보안
  - PKCE(S256), state/nonce
  - Access/Refresh 토큰 분리
  - Refresh rotation + reuse detection
  - 민감 엔드포인트 rate limit

## 기술 스택

- Node.js + Express
- MySQL (`mysql2`)
- JWT (`jsonwebtoken`)
- Password hashing (`bcrypt`)

## 빠른 시작

### 1) 설치

```bash
npm install
```

### 2) 환경 변수 설정

`.env.example`를 복사해서 `.env`를 만듭니다.

```bash
cp .env.example .env
```

필수 항목:

- DB 연결: `CONNECTION_URI` 또는 `DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME`
- JWT: `JWT_SECRET` (운영 환경 필수)

권장 항목:

- `JWT_ISSUER` (기본 `auth.example.com`)
- `AUTH_BASE_URL` (Provider 목록의 `authUrl` 생성 기준)
- `ACCESS_TOKEN_EXPIRES_IN` (기본 900)
- `REFRESH_TOKEN_EXPIRES_IN` (기본 2592000)

### 3) DB 스키마 적용

```bash
mysql -h <DB_HOST> -P <DB_PORT> -u <DB_USER> -p <DB_NAME> < sql/schema.sql
```

OIDC 예시 Provider를 넣으려면:

```bash
mysql -h <DB_HOST> -P <DB_PORT> -u <DB_USER> -p <DB_NAME> < sql/seed-providers.sql
```

### 4) 서버 실행

```bash
npm start
```

- 기본 포트: `3000`
- 헬스 체크: `GET /health`
- 예제 웹앱: `GET /example`

### 5) 예제 웹앱 사용

이 프로젝트에는 API 호출 흐름을 바로 테스트할 수 있는 샘플 웹앱이 포함되어 있습니다.

1. 서버 실행: `npm start`
2. 브라우저 접속: `http://localhost:3000/example`
3. 페이지에서 다음 기능을 순서대로 테스트
   - Provider 목록 조회
   - Email 회원가입/로그인
   - OTP 발송/검증
   - 토큰 갱신/로그아웃
   - OIDC start URL 생성

## 인증 아키텍처 요약

- Access Token (JWT): API 호출용, 짧은 만료
- Refresh Token (Opaque): 세션 유지용, DB에는 해시만 저장
- Refresh Rotation: refresh 호출 시 새 refresh 발급
- Reuse Detection:
  - 이미 회전된 이전 refresh 재사용 시
  - 세션 revoke + `REFRESH_TOKEN_REUSED` 반환

## API 요약

Base URL: `http://localhost:3000`

### Provider / OIDC

- `GET /v1/auth/providers`
- `POST /v1/auth/oidc/:provider/start`
- `POST /v1/auth/oidc/:provider/exchange`

### Password

- `POST /v1/auth/password/signup`
- `POST /v1/auth/password/login`

### OTP

- `POST /v1/auth/otp/send`
- `POST /v1/auth/otp/verify`

### Session / Token

- `POST /v1/auth/token/refresh`
- `POST /v1/auth/logout`

### Account Linking

- `POST /v1/auth/link/oidc/:provider/start` (Bearer 필요)
- `POST /v1/auth/link/oidc/:provider/exchange` (Bearer 필요)
- `DELETE /v1/auth/identities/:identityId` (Bearer 필요)

상세 요청/응답 예시는 `docs/API_GUIDE.md`를 참고하세요.

## 공통 응답 포맷

### 성공

```json
{
  "success": true
}
```

### 실패

```json
{
  "success": false,
  "error": {
    "code": "INVALID_REQUEST",
    "message": "error message",
    "details": {}
  }
}
```

주요 에러 코드:

- `INVALID_REQUEST`
- `INVALID_CREDENTIALS`
- `UNAUTHORIZED`
- `REFRESH_TOKEN_REUSED`
- `CONFLICT`
- `RATE_LIMITED`

## 프로젝트 구조

```text
app.js
docs/API_GUIDE.md
routes/auth/
lib/auth/
sql/schema.sql
sql/seed-providers.sql
```

## 개발 메모

- 운영 배포 전 반드시 `JWT_SECRET`, DB 계정, CORS 정책을 환경에 맞게 조정
