const crypto = require('crypto');

// Random secret single-use token encoded in a booking's check-in QR code.
function mintQrToken() {
  return crypto.randomBytes(16).toString('hex');
}

// PayHere return/notify bases. Never derived from the request Host header
// (an attacker-controlled Host would redirect the player's return flow);
// always the configured frontend origin.
function requestBaseUrl() {
  return process.env.FRONTEND_URL || undefined;
}

module.exports = { mintQrToken, requestBaseUrl };
