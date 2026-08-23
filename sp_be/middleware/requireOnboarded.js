const pool = require('../db');
const { fail } = require('../utils/response');

// The owner console is gated on onboarding (ADR-0022): accounts provisioned
// through the admin flow stay 'pending' until the Owner Agreement is accepted,
// and a renewal issues a fresh pending agreement that must be re-accepted.
// Admins pass through; grandfathered owners (no agreement) pass.
async function requireOnboarded(req, res, next) {
  if (req.user.role === 'admin') return next();

  if (req.user.onboarding_state === 'pending') {
    return fail(res, 403, 'ONBOARDING_REQUIRED', 'Accept your owner agreement before using the console');
  }

  if (req.user.onboarding_state === 'accepted') {
    const { rows } = await pool.query(
      `select 1 from owner_agreements
       where owner_id = $1 and status = 'pending'
       limit 1`,
      [req.user.id]
    );
    if (rows.length > 0) {
      return fail(res, 403, 'ONBOARDING_REQUIRED', 'Accept your renewed agreement before using the console');
    }
  }

  next();
}

module.exports = { requireOnboarded };