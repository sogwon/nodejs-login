/**
 * DB 풀 및 쿼리 헬퍼
 */
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });
const mysql = require("mysql2/promise");

let pool = null;

function getPool() {
  if (!pool) {
    const connectionUri = process.env.CONNECTION_URI;
    const hasDbVars =
      process.env.DB_HOST && process.env.DB_USER && process.env.DB_PASSWORD;
    if (!connectionUri && !hasDbVars) {
      throw new Error(
        ".env에 CONNECTION_URI 또는 DB_HOST, DB_USER, DB_PASSWORD를 설정하세요."
      );
    }
    const config = connectionUri
      ? { uri: connectionUri }
      : {
          host: process.env.DB_HOST,
          port: parseInt(process.env.DB_PORT || "3306", 10),
          user: process.env.DB_USER,
          password: process.env.DB_PASSWORD,
          database: process.env.DB_NAME || "auth",
          charset: "utf8mb4",
          waitForConnections: true,
          connectionLimit: 10,
          queueLimit: 0,
        };
    pool = connectionUri
      ? mysql.createPool(connectionUri)
      : mysql.createPool(config);
  }
  return pool;
}

async function query(sql, params = []) {
  const p = getPool();
  const [rows] = await p.execute(sql, params);
  return rows;
}

async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] || null;
}

function uuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

module.exports = { getPool, query, queryOne, uuid };
