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

module.exports = { fmtWhen, fmtLkr };