const express = require('express');
const { ok, fail } = require('../utils/response');
const logger = require('../utils/logger');
const { getFlags, getBrandName } = require('../utils/featureFlags');

const router = express.Router();

// Minimal public read of platform flags so the player app can mirror the
// server's gates (which remain the source of truth). No auth required.
router.get('/feature-flags', async (req, res) => {
  try {
    const [flags, brandName] = await Promise.all([getFlags(), getBrandName()]);
    ok(res, 200, { ...flags, brand_name: brandName });
  } catch (error) {
    logger.error(`Error fetching public flags: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  }
});

module.exports = router;