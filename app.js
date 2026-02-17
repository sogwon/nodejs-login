/**
 * Auth API Express 앱
 * - /v1/auth/* : 로그인 API
 * - /health : 헬스 체크
 */
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, ".env") });
const express = require("express");
const authRoutes = require("./routes/auth");

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());
app.set("trust proxy", 1);
app.use("/example", express.static(path.join(__dirname, "example-web")));

app.use((req, res, next) => {
  res.set("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.use("/v1/auth", authRoutes);

app.get("/health", (req, res) => {
  res.json({ ok: true, message: "Auth API server" });
});

app.get("/example", (req, res) => {
  res.sendFile(path.join(__dirname, "example-web", "index.html"));
});

app.get("/", (req, res) => {
  res.json({
    message: "Auth API",
    endpoints: {
      "GET /health": "헬스 체크",
      "GET /example": "예제 웹앱",
      "GET /v1/auth/providers": "로그인 Provider 목록",
      "POST /v1/auth/oidc/:provider/start": "OIDC 로그인 시작",
      "POST /v1/auth/oidc/:provider/exchange": "OIDC 코드 교환",
      "POST /v1/auth/password/signup": "이메일 가입",
      "POST /v1/auth/password/login": "이메일 로그인",
      "POST /v1/auth/otp/send": "OTP 발송",
      "POST /v1/auth/otp/verify": "OTP 검증",
      "POST /v1/auth/token/refresh": "토큰 갱신",
      "POST /v1/auth/logout": "로그아웃",
      "POST /v1/auth/link/oidc/:provider/start": "IdP 연결 시작 (Bearer)",
      "POST /v1/auth/link/oidc/:provider/exchange": "IdP 연결 교환 (Bearer)",
      "DELETE /v1/auth/identities/:identityId": "Identity 해제 (Bearer)",
    },
  });
});

app.use((req, res) => {
  res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Not Found" } });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({
    success: false,
    error: { code: "INTERNAL_ERROR", message: err.message },
  });
});

if (require.main === module) {
  app.listen(PORT, "0.0.0.0", () => {
    console.log("서버 실행: http://localhost:" + PORT);
    console.log("  GET  /v1/auth/providers");
    console.log("  POST /v1/auth/oidc/:provider/start");
    console.log("  POST /v1/auth/oidc/:provider/exchange");
    console.log("  POST /v1/auth/password/signup | /password/login");
    console.log("  POST /v1/auth/otp/send | /otp/verify");
    console.log("  POST /v1/auth/token/refresh | /logout");
  });
}

module.exports = app;
