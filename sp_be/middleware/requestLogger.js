const logger = require('../utils/logger');

const SENSITIVE_KEY = /^(code|otp|token|password|secret|key|api_key|idempotency_key|fcm_token|phone|authorization)$/i;

function maskPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length < 8) return '[REDACTED]';
  return `${digits.slice(0, 6).replace(/^0?94?/, (m) => (m ? `+${m}` : ''))}****${digits.slice(-4)}`;
}

function redactSensitiveData(value) {
  if (Array.isArray(value)) {
    return value.map(redactSensitiveData);
  }
  if (value && typeof value === 'object') {
    const out = {};
    for (const [key, val] of Object.entries(value)) {
      if (SENSITIVE_KEY.test(key)) {
        out[key] = key.toLowerCase() === 'phone' ? maskPhone(val) : '[REDACTED]';
      } else {
        out[key] = redactSensitiveData(val);
      }
    }
    return out;
  }
  return value;
}

const requestLogger = (req, res, next) => {
  // Generate a unique request ID
  const requestId = Math.random().toString(36).substring(2, 15);

  // Log request details
  logger.info(`[${requestId}] ${req.method} ${req.originalUrl} - Request received`);

  // Log request body if it exists (but hide sensitive data)
  if (req.body && Object.keys(req.body).length > 0) {
    const sanitizedBody = redactSensitiveData(req.body);
    logger.info(`[${requestId}] Request Body: ${JSON.stringify(sanitizedBody)}`);
  }

  // Capture the original end method
  const originalEnd = res.end;
  const startTime = Date.now();

  // Override the end method to log response
  res.end = function(chunk, encoding) {
    // Calculate request duration
    const duration = Date.now() - startTime;

    // Log response details
    logger.info(`[${requestId}] ${req.method} ${req.originalUrl} - Status: ${res.statusCode} - Duration: ${duration}ms`);

    // Call the original end method
    return originalEnd.call(this, chunk, encoding);
  };

  next();
};

module.exports = requestLogger;
module.exports.redactSensitiveData = redactSensitiveData;