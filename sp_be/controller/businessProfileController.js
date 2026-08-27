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

// ---- Booking settings (ADR-0040) ----

// Auto-confirm switch + Pending Auto-cancel timer, both Business-level.
exports.getBookingSettings = async (req, res) => {
  try {
    const business = await businessService.getByOwnerId(req.user.id);
    if (!business) {
      return fail(res, 404, 'BUSINESS_NOT_FOUND', 'No business is set up for this account');
    }
    ok(res, 200, {
      auto_confirm: business.auto_confirm,
      pending_auto_cancel_hours: business.pending_auto_cancel_hours
    });
  } catch (error) {
    logger.error(`Error fetching booking settings: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  }
};

exports.updateBookingSettings = async (req, res) => {
  try {
    const business = await businessService.getByOwnerId(req.user.id);
    if (!business) {
      return fail(res, 404, 'BUSINESS_NOT_FOUND', 'No business is set up for this account');
    }
    const { auto_confirm, pending_auto_cancel_hours } = req.body;
    if (auto_confirm !== undefined && typeof auto_confirm !== 'boolean') {
      return fail(res, 400, 'BOOKING_SETTINGS_VALIDATION', 'auto_confirm must be a boolean');
    }
    if (
      pending_auto_cancel_hours !== undefined &&
      (!Number.isInteger(Number(pending_auto_cancel_hours)) || Number(pending_auto_cancel_hours) < 1)
    ) {
      return fail(res, 400, 'BOOKING_SETTINGS_VALIDATION', 'pending_auto_cancel_hours must be a whole number of hours (minimum 1)');
    }
    const { rows } = await pool.query(
      `update businesses set
         auto_confirm = coalesce($2, auto_confirm),
         pending_auto_cancel_hours = coalesce($3, pending_auto_cancel_hours),
         updated_at = now()
       where id = $1
       returning auto_confirm, pending_auto_cancel_hours`,
      [business.id, auto_confirm ?? null, pending_auto_cancel_hours !== undefined ? Number(pending_auto_cancel_hours) : null]
    );
    ok(res, 200, rows[0]);
  } catch (error) {
    logger.error(`Error updating booking settings: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  }
};