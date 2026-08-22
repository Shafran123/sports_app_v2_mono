const express = require('express');
const pool = require('../db');
const { ok, fail } = require('../utils/response');
const logger = require('../utils/logger');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `select id, slug, name, icon from sports where is_active order by name`
    );
    ok(res, 200, rows);
  } catch (error) {
    logger.error(`Error listing sports: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  }
});

module.exports = router;
