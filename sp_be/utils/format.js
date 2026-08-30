// Small shared formatting helpers used by the notification services.

function fmtWhen(iso) {
  try {
    return new Date(iso).toLocaleString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return String(iso || '');
  }
}

function fmtLkr(n) {
  return `LKR ${Number(n || 0).toLocaleString('en-US')}`;
}

// Mask a secret for display: only the last 4 characters survive, everything
// else is bullets. Used for the app_id hint in owner/admin UIs.
function maskLast4(value) {
  const s = String(value || '');
  if (s.length <= 4) return '••••';
  return `••••${s.slice(-4)}`;
}

module.exports = { fmtWhen, fmtLkr, maskLast4 };