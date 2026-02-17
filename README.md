# CloudBase 백엔드 (Node.js)

Tencent CloudBase에 연결해 MySQL 테이블 목록을 조회하는 백엔드 스크립트입니다.

## 요구 사항

- Node.js 12+
- CloudBase 환경 ID, Secret ID, Secret Key

## 설치

```bash
npm install
```

## 환경 변수

프로젝트 루트에 `.env` 파일을 만들고 아래 값을 채우세요. (`cp .env.example .env` 후 수정)

| 변수 | 설명 |
|------|------|
| `CLOUDBASE_ENV_ID` | CloudBase 환경 ID |
| `CLOUDBASE_SECRET_ID` / `CLOUDBASE_SECRET_KEY` | Tencent Cloud API Secret (또는 `CLOUDBASE_SECRETID` / `CLOUDBASE_SECRETKEY`) |

## HTTP 서버 (테이블 목록 API)

MySQL에 직접 연결해 **테이블 목록을 JSON으로 반환**하는 HTTP 서버를 실행할 수 있습니다.

1. `.env`에 MySQL 연결 정보를 설정 (방법 2와 동일: `CONNECTION_URI` 또는 `DB_HOST`, `DB_USER`, `DB_PASSWORD`)
2. 서버 실행:

```bash
npm start
# 또는
npm run server
```

3. 브라우저 또는 curl로 요청:
   - `GET http://localhost:3000/api/tables` → MySQL 테이블 목록 (JSON)
   - `GET http://localhost:3000/health` → 헬스 체크

포트는 환경 변수 `PORT`로 변경 가능 (기본 3000).

## Auth API (로그인 서버)

`npm start`로 실행되는 앱에 **로그인 API**가 포함되어 있습니다.

### DB 스키마 적용

Auth API를 사용하려면 MySQL에 스키마를 적용하세요.

```bash
# MySQL 클라이언트로 적용 (DB_NAME은 사용 중인 DB로 변경)
mysql -h DB_HOST -u DB_USER -p DB_NAME < sql/schema.sql
# IdP 예시 등록 (선택)
mysql -h DB_HOST -u DB_USER -p DB_NAME < sql/seed-providers.sql
```

`.env`에 `DB_NAME=auth` 또는 기존 DB 이름을 두고, 동일 DB에 테이블을 생성하면 됩니다.

### Auth 환경 변수

| 변수 | 설명 |
|------|------|
| `JWT_SECRET` | JWT 서명용 시크릿 (운영 시 필수, 32자 이상 권장) |
| `JWT_ISSUER` | JWT iss 클레임 (기본 `auth.example.com`) |
| `AUTH_BASE_URL` | Provider 목록의 `authUrl` 기준 URL (리다이렉트용) |
| `ACCESS_TOKEN_EXPIRES_IN` | Access Token 만료(초, 기본 900) |
| `REFRESH_TOKEN_EXPIRES_IN` | Refresh Token 만료(초, 기본 2592000) |

### Auth API 엔드포인트 요약

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/v1/auth/providers` | 로그인 가능한 Provider 목록 |
| POST | `/v1/auth/oidc/:provider/start` | OIDC 로그인 시작 (PKCE, state, nonce) |
| POST | `/v1/auth/oidc/:provider/exchange` | 인가 코드 교환 → 토큰 발급 |
| POST | `/v1/auth/password/signup` | 이메일/비밀번호 가입 |
| POST | `/v1/auth/password/login` | 이메일/비밀번호 로그인 |
| POST | `/v1/auth/otp/send` | OTP 발송 (SMS/WhatsApp 등) |
| POST | `/v1/auth/otp/verify` | OTP 검증 → 토큰 발급 |
| POST | `/v1/auth/token/refresh` | Refresh Token으로 Access/Refresh 재발급 (Rotation) |
| POST | `/v1/auth/logout` | Refresh Token 폐기 |
| POST | `/v1/auth/link/oidc/:provider/start` | IdP 연결 시작 (Bearer 필요) |
| POST | `/v1/auth/link/oidc/:provider/exchange` | IdP 연결 완료 (Bearer 필요) |
| DELETE | `/v1/auth/identities/:identityId` | Identity 해제 (최소 1개 유지) |

OIDC IdP는 `auth_providers` 테이블에 설정만 추가하면 Generic OIDC로 동작합니다 (discovery_url/issuer, client_id, client_secret, scopes 등).

## MySQL 테이블 목록 출력 (CLI)

### 방법 1: CloudBase Node SDK (데이터 모델)

환경에 **云数据库(MySQL型)** 이 연결되어 있고, 데이터 모델 SDK에서 SQL 실행이 가능한 경우:

```bash
npm run list-tables
```

CloudBase에 연결한 뒤 `information_schema`를 이용해 현재 데이터베이스의 테이블 목록을 출력합니다.

### 방법 2: mysql2 직접 연결

CloudBase MySQL **내부 네트워크 연결 주소**를 알고 있는 경우:

1. `.env`에 다음 중 하나를 설정  
   - `CONNECTION_URI=mysql://root:비밀번호@내부주소:3306/tcb`  
   - 또는 `DB_HOST`, `DB_USER`, `DB_PASSWORD` (선택: `DB_PORT`, `DB_NAME`)
2. 실행:

```bash
npm run list-tables:mysql
```

## 참고

- [CloudBase Node SDK 소개](https://docs.cloudbase.net/en/api-reference/server/node-sdk/introduction)
- [云数据库(MySQL型) 접근 - $runSQL / $runSQLRaw](https://docs.cloudbase.net/en/database/access/tdsql)
- [Cloud Function에서 MySQL 호출](https://docs.cloudbase.net/en/cloud-function/resource-integration/mysql)
