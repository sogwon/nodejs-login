/**
 * mysql2로 CloudBase MySQL에 직접 연결해 테이블 목록 출력
 * CloudBase 콘솔 > 데이터베이스 설정 > 내부 네트워크 연결 주소 사용
 * @see https://docs.cloudbase.net/en/cloud-function/resource-integration/mysql
 */
require("dotenv").config();
const mysql = require("mysql2/promise");

async function listMySQLTables() {
  const connectionUri = process.env.CONNECTION_URI;
  const hasDbVars =
    process.env.DB_HOST && process.env.DB_USER && process.env.DB_PASSWORD;

  if (!connectionUri && !hasDbVars) {
    console.error(
      "오류: .env에 다음 중 하나를 설정해 주세요.\n" +
        "  - CONNECTION_URI (예: mysql://root:password@내부주소:3306/tcb)\n" +
        "  - 또는 DB_HOST, DB_USER, DB_PASSWORD (선택: DB_PORT, DB_NAME)"
    );
    process.exit(1);
  }

  let connection;
  try {
    if (connectionUri) {
      connection = await mysql.createConnection(connectionUri);
    } else {
      connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT || "3306", 10),
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME || "tcb",
        charset: "utf8mb4",
      });
    }

    const [rows] = await connection.query("SHOW TABLES");
    await connection.end();

    const key = rows.length > 0 ? Object.keys(rows[0])[0] : null;
    const tables = key ? rows.map((r) => r[key]) : [];

    if (tables.length === 0) {
      console.log("MySQL 테이블이 없습니다.");
      return;
    }

    console.log("=== MySQL 테이블 목록 (mysql2 직접 연결) ===\n");
    tables.forEach((name, i) => console.log(`  ${i + 1}. ${name}`));
    console.log(`\n총 ${tables.length}개 테이블`);
  } catch (err) {
    console.error("MySQL 연결/조회 실패:", err.message);
    process.exit(1);
  }
}

listMySQLTables();
