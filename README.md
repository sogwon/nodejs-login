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
