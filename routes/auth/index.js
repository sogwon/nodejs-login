/**
 * /v1/auth 라우터
 */
const express = require("express");
const rateLimit = require("express-rate-limit");
const { getProviders } = require("./providers");
const { oidcStart, oidcExchange } = require("./oidc");
const { passwordSignup, passwordLogin } = require("./password");
const { otpSend, otpVerify } = require("./otp");
const { tokenRefresh, logout } = require("./token");
const { linkOidcStart, linkOidcExchange, deleteIdentity } = require("./link");
const { authMiddleware } = require("../../lib/auth/middleware");
const { errorWithCode } = require("../../lib/auth/response");

const router = express.Router();
router.use(express.json());

const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  handler: (req, res) => {
    res.status(429).json({ success: false, error: { code: "RATE_LIMITED", message: "Too many requests" } });
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

router.get("/providers", getProviders);

router.post("/oidc/:provider/start", authLimiter, oidcStart);
router.post("/oidc/:provider/exchange", strictLimiter, oidcExchange);

router.post("/password/signup", strictLimiter, passwordSignup);
router.post("/password/login", strictLimiter, passwordLogin);

router.post("/otp/send", strictLimiter, otpSend);
router.post("/otp/verify", strictLimiter, otpVerify);

router.post("/token/refresh", strictLimiter, tokenRefresh);
router.post("/logout", authLimiter, logout);

router.post("/link/oidc/:provider/start", authMiddleware, authLimiter, linkOidcStart);
router.post("/link/oidc/:provider/exchange", authMiddleware, strictLimiter, linkOidcExchange);
router.delete("/identities/:identityId", authMiddleware, deleteIdentity);

router.use((err, req, res, next) => {
  console.error("auth route error", err);
  errorWithCode(res, "INTERNAL_ERROR", err.message);
});

module.exports = router;
