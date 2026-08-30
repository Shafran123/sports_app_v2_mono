// AES-256-GCM encryption at rest shared by the per-Business PayHere
// credentials (ADR-0044). Same scheme as the Second Factor secrets in
// services/siteTotp.js (iv:tag:ciphertext, hex) — deliberately kept as a
// separate module with its own key chain so the TOTP key derivation never
// changes (existing stored TOTP secrets must keep decrypting).

const crypto = require('node:crypto');

// Master key from MASTER_ENCRYPTION_KEY (a Platform Secret in Google Secret
// Manager, ADR-0046 — required at boot, no fallback). Tests use a fixed dev
// key so the suite never depends on process env. siteTotp keeps its own key
// chain unchanged (existing stored TOTP secrets must keep decrypting).
function encryptionKey() {
  const raw = process.env.NODE_ENV === 'test' ? 'payment-cred-test-dev-key' : process.env.MASTER_ENCRYPTION_KEY;
  return crypto.createHash('sha256').update(raw).digest();
}

function encryptSecret(secret) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const enc = Buffer.concat([cipher.update(String(secret), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`;
}

function decryptSecret(stored) {
  const parts = String(stored || '').split(':');
  if (parts.length !== 3) return null;
  const [ivHex, tagHex, encHex] = parts;
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    return Buffer.concat([decipher.update(Buffer.from(encHex, 'hex')), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

// Mask a secret for display: only the last 4 characters survive, everything
// else is bullets. Used for the app_id hint in owner/admin UIs.
function maskLast4(value) {
  const s = String(value || '');
  if (s.length <= 4) return '••••';
  return `••••${s.slice(-4)}`;
}

module.exports = { encryptSecret, decryptSecret, maskLast4 };