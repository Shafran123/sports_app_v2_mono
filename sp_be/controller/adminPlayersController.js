const pool = require('../db');
const { ok, fail } = require('../utils/response');
const logger = require('../utils/logger');

// Admin-only: list players with verified status; optional search term.
exports.listPlayers = async (req, res) => {
  try {
    const search = String(req.query.search || '').trim();
    const { rows } = await pool.query(
      `select id, name, email, phone, city, role, phone_verified_at, created_at
       from users
       where $1 = ''
          or name ilike '%' || $1 || '%'
          or email ilike '%' || $1 || '%'
          or phone ilike '%' || $1 || '%'
       order by created_at desc
       limit 100`,
      [search]
    );
    ok(res, 200, rows);
  } catch (error) {
    logger.error(`Error listing players: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  }
};

// Admin-only: mark a player's phone as verified (test users / pre-prod).
exports.verifyPlayer = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `update users set phone_verified_at = coalesce(phone_verified_at, now()), updated_at = now()
       where id = $1 returning *`,
      [req.params.id]
    );
    if (rows.length === 0) {
      return fail(res, 404, 'PLAYER_NOT_FOUND', 'Player not found');
    }
    ok(res, 200, rows[0]);
  } catch (error) {
    logger.error(`Error verifying player: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  }
};