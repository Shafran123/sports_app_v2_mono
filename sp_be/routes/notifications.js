const express = require('express');
const pool = require('../db');
const { ok, fail } = require('../utils/response');
const logger = require('../utils/logger');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `select * from notifications where user_id = $1 order by created_at desc limit 50`,
      [req.user.id]
    );
    ok(res, 200, rows);
  } catch (error) {
    logger.error(`Error listing notifications: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  }
});

router.patch('/:id/read', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `update notifications set is_read = true where id = $1 and user_id = $2 returning *`,
      [req.params.id, req.user.id]
    );
    if (rows.length === 0) {
      return fail(res, 404, 'NOTIFICATION_NOT_FOUND', 'Notification not found');
    }
    ok(res, 200, rows[0]);
  } catch (error) {
    logger.error(`Error marking notification read: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  }
});

router.patch('/read-all', async (req, res) => {
  try {
    await pool.query(
      `update notifications set is_read = true where user_id = $1 and is_read = false`,
      [req.user.id]
    );
    ok(res, 200, { marked: true });
  } catch (error) {
    logger.error(`Error marking notifications read: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  }
});

router.put('/fcm-token', async (req, res) => {
  try {
    const { fcm_token } = req.body;
    await pool.query(
      `update users set fcm_token = $2, updated_at = now() where id = $1`,
      [req.user.id, fcm_token || null]
    );
    ok(res, 200, { updated: true });
  } catch (error) {
    logger.error(`Error saving fcm token: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  }
});

module.exports = router;
