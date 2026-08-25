const express = require('express');
const { ok, fail } = require('../utils/response');
const logger = require('../utils/logger');
const { getFlags, getBrandName } = require('../utils/featureFlags');

const router = express.Router();

// Minimal public read of platform flags so the player app can mirror the
// server's gates (which remain the source of truth). No auth required.
// `app_url` is the player-app origin (the embed/widget host) — public by
// nature, surfaced so embed snippets can be generated from any console.
router.get('/feature-flags', async (req, res) => {
  try {
    const [flags, brandName] = await Promise.all([getFlags(), getBrandName()]);
    ok(res, 200, { ...flags, brand_name: brandName, app_url: process.env.FRONTEND_URL || null });
  } catch (error) {
    logger.error(`Error fetching public flags: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  }
});

module.exports = router;