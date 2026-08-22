const pool = require('../db');
const { ok, fail } = require('../utils/response');
const logger = require('../utils/logger');

const EDITABLE_FIELDS = ['name', 'phone', 'city'];

exports.getMe = async (req, res) => {
  ok(res, 200, req.user);
};

exports.updateMe = async (req, res) => {
  try {
    const updates = [];
    const values = [];
    let index = 1;

    for (const field of EDITABLE_FIELDS) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = $${index++}`);
        values.push(req.body[field]);
      }
    }

    if (updates.length === 0) {
      return ok(res, 200, req.user);
    }

    // A changed phone number must be re-verified before the next booking.
    if (req.body.phone !== undefined && String(req.body.phone).trim() !== String(req.user.phone || '').trim()) {
      updates.push(`phone_verified_at = null`);
    }

    updates.push(`updated_at = now()`);
    values.push(req.user.id);

    const { rows } = await pool.query(
      `update users set ${updates.join(', ')} where id = $${index} returning *`,
      values
    );

    ok(res, 200, rows[0]);
  } catch (error) {
    logger.error(`Error updating profile: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  }
};
