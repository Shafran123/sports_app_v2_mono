const { fail } = require('../utils/response');

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return fail(res, 401, 'UNAUTHORIZED', 'Access denied. No token provided.');
    }
    if (req.user.is_suspended) {
      return fail(res, 403, 'ACCOUNT_SUSPENDED', 'This account has been suspended.');
    }
    if (req.user.status === 'banned') {
      return fail(res, 403, 'ACCOUNT_BANNED', 'This account has been banned.');
    }
    if (!roles.includes(req.user.role)) {
      return fail(res, 403, 'FORBIDDEN', 'Access denied.');
    }
    next();
  };
}

module.exports = { requireRole };
