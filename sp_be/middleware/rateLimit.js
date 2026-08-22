const { rateLimit } = require('express-rate-limit');

// Targeted + app-level limits. Under NODE_ENV=test the middleware is a
// pass-through so the API test suite (and its deliberate abuse cases) keeps
// working; `force: true` lets the limiter's own unit test exercise the real
// path. In production the API fails closed onto 429s per IP.
function makeRateLimiter({ windowMs, limit, force = false, message = 'Too many requests, slow down.' }) {
  if (process.env.NODE_ENV === 'test' && !force) {
    return (req, res, next) => next();
  }
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: { code: 'RATE_LIMITED', message } }
  });
}

module.exports = { makeRateLimiter };