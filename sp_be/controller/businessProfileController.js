// Owner console: /business/me — the Business profile (name + brand) and the
// venue portfolio the Widget & site page operates on.

const pool = require('../db');
const { ok, fail } = require('../utils/response');
const logger = require('../utils/logger');
const businessService = require('../services/businesses');

exports.getMe = async (req, res) => {
  try {
    const business = await businessService.getByOwnerId(req.user.id);
    if (!business) {
      return fail(res, 404, 'BUSINESS_NOT_FOUND', 'No business is set up for this account');
    }
    const { rows: venues } = await pool.query(
      `select id, name, status, visibility, slug, marketplace_listing from venues
       where business_id = $1 order by created_at`,
      [business.id]
    );
    ok(res, 200, { ...business, venues });
  } catch (error) {
    logger.error(`Error fetching business profile: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  }
};

exports.updateMe = async (req, res) => {
  try {
    const business = await businessService.getByOwnerId(req.user.id);
    if (!business) {
      return fail(res, 404, 'BUSINESS_NOT_FOUND', 'No business is set up for this account');
    }
    const updated = await businessService.updateProfile(business.id, req.body);
    ok(res, 200, updated);
  } catch (error) {
    if (error.code) {
      return fail(res, 400, error.code, error.message);
    }
    logger.error(`Error updating business profile: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  }
};