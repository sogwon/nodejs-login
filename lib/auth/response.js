/**
 * 공통 응답 포맷 (설계 4)
 * - success/error 구조, 토큰/OTP 원문 로깅 금지
 */
function success(res, data, statusCode = 200) {
  return res.status(statusCode).json({ success: true, ...data });
}

function error(res, code, message, details = {}, statusCode = 400) {
  return res.status(statusCode).json({
    success: false,
    error: { code, message, details },
  });
}

const ERROR_CODES = {
  INVALID_CREDENTIALS: 401,
  INVALID_REQUEST: 400,
  UNAUTHORIZED: 401,
  REFRESH_TOKEN_REUSED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
};

function errorWithCode(res, code, message, details = {}) {
  const statusCode = ERROR_CODES[code] || 400;
  return error(res, code, message, details, statusCode);
}

module.exports = { success, error, errorWithCode, ERROR_CODES };
