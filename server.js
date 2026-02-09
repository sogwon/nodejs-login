/**
 * CloudBase MySQL 테이블 목록을 반환하는 HTTP 서버
 * - GET /api/tables → MySQL 테이블 목록 JSON
 * - GET /health → 서버 상태
 * @see https://docs.cloudbase.net/en/cloud-function/resource-integration/mysql
 */
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, ".env") });
const http = require("http");
const mysql = require("mysql2/promise");

const PORT = Number(process.env.PORT) || 3000;

async function getMySQLConnection() {
  const connectionUri = process.env.CONNECTION_URI;
  const hasDbVars =
    process.env.DB_HOST && process.env.DB_USER && process.env.DB_PASSWORD;

  if (!connectionUri && !hasDbVars) {
    throw new Error(
      ".env에 CONNECTION_URI 또는 DB_HOST, DB_USER, DB_PASSWORD를 설정하세요."
    );
  }

  if (connectionUri) {
    return mysql.createConnection(connectionUri);
  }
  return mysql.createConnection({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || "3306", 10),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || "tcb",
    charset: "utf8mb4",
  });
}

async function listTables() {
  const connection = await getMySQLConnection();
  try {
    const [rows] = await connection.query("SHOW TABLES");
    const key = rows.length > 0 ? Object.keys(rows[0])[0] : null;
    const tables = key ? rows.map((r) => r[key]) : [];
    return tables;
  } finally {
    await connection.end();
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://localhost:${PORT}`);
  const path = url.pathname;

  const send = (statusCode, body, contentType = "application/json") => {
    res.writeHead(statusCode, {
      "Content-Type": contentType,
      "Access-Control-Allow-Origin": "*",
    });
    res.end(typeof body === "string" ? body : JSON.stringify(body));
  };

  try {
    if (path === "/health" && req.method === "GET") {
      send(200, { ok: true, message: "CloudBase MySQL 테이블 서버" });
      return;
    }

    if (path === "/api/tables" && req.method === "GET") {
      const tables = await listTables();
      send(200, { success: true, count: tables.length, tables });
      return;
    }

    if (path === "/" && req.method === "GET") {
      send(200, {
        message: "CloudBase MySQL 테이블 API",
        endpoints: {
          "GET /api/tables": "MySQL 테이블 목록",
          "GET /health": "헬스 체크",
        },
      });
      return;
    }

    send(404, { error: "Not Found" });
  } catch (err) {
    console.error(err);
    send(500, {
      success: false,
      error: err.message || "서버 오류",
    });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`서버 실행: http://localhost:${PORT}`);
  console.log("  GET /api/tables  → MySQL 테이블 목록");
  console.log("  GET /health     → 헬스 체크");
});
