/**
 * CloudBase에 연결 후 MySQL 테이블 목록을 출력하는 스크립트
 * @see https://docs.cloudbase.net/en/database/access/tdsql
 * @see https://docs.cloudbase.net/api-reference/server/node-sdk/model/init
 */
const { cloudbase } = require("../lib/cloudbase");

async function listMySQLTables() {
  const envId = process.env.CLOUDBASE_ENV_ID;
  if (!envId) {
    console.error("오류: .env에 CLOUDBASE_ENV_ID를 설정해 주세요.");
    process.exit(1);
  }
  const secretId = process.env.CLOUDBASE_SECRET_ID || process.env.CLOUDBASE_SECRETID;
  const secretKey = process.env.CLOUDBASE_SECRET_KEY || process.env.CLOUDBASE_SECRETKEY;
  if (!secretId || !secretKey) {
    console.error("오류: .env에 CLOUDBASE_SECRET_ID(또는 CLOUDBASE_SECRETID), CLOUDBASE_SECRET_KEY(또는 CLOUDBASE_SECRETKEY)를 설정해 주세요.");
    process.exit(1);
  }

  try {
    const app = cloudbase;
    const models = app.models;

    if (!models || typeof models.$runSQLRaw !== "function") {
      console.error(
        "오류: 현재 환경에서 MySQL 데이터 모델(SQL 실행)을 사용할 수 없습니다.\n" +
          "  - CloudBase 콘솔에서 해당 환경에 '云数据库(MySQL型)'이 연결되어 있는지 확인하세요.\n" +
          "  - 또는 mysql2 드라이버로 직접 연결하려면 DB_HOST, DB_USER, DB_PASSWORD 등을 설정한 뒤\n" +
          "    npm run list-tables:mysql 로 실행할 수 있습니다."
      );
      process.exit(1);
    }

    // CloudBase MySQL형은 SELECT만 지원하므로 information_schema로 테이블 목록 조회
    const sql =
      "SELECT table_name AS tableName FROM information_schema.tables WHERE table_schema = DATABASE() ORDER BY table_name";
    const result = await models.$runSQLRaw(sql);

    const data = result?.data ?? result;
    const list = data?.executeResultList ?? data?.list ?? (Array.isArray(data) ? data : []);

    if (list.length === 0) {
      console.log("MySQL 테이블이 없습니다.");
      return;
    }

    console.log("=== MySQL 테이블 목록 ===\n");
    list.forEach((row, i) => {
      const name = row.tableName ?? row.TABLE_NAME ?? row.table_name ?? Object.values(row)[0];
      console.log(`  ${i + 1}. ${name}`);
    });
    console.log(`\n총 ${list.length}개 테이블`);
  } catch (err) {
    console.error("MySQL 테이블 목록 조회 실패:", err.message || err);
    if (err.code) console.error("코드:", err.code);
    process.exit(1);
  }
}

listMySQLTables();
