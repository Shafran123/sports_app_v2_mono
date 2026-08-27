// Site Domain Request controllers (ADR-0029): the owner console half (submit /
// view / re-request) and the admin queue half (queue, approve, reject, DNS
// hand-off, automated verify, checklist, mark live). Every state change fans
// out a `site.request.status` Email Notification (and in-app row) to the
// owner — email is mandatory on rejection (grill Q18).

const { ok, fail } = require('../utils/response');
const logger = require('../utils/logger');
const pool = require('../db');
const businessService = require('../services/businesses');
const siteDomains = require('../services/siteDomains');
const notificationCatalog = require('../utils/notificationCatalog');

async function requireBusiness(req, res) {
  const business = await businessService.getByOwnerId(req.user.id);
  if (!business) {
    fail(res, 404, 'BUSINESS_NOT_FOUND', 'No business is set up for this account');
    return null;
  }
  return business;
}

// ---- Owner console ----

async function notifyStatusChanged(req, row) {
  const business = await businessService.getById(row.business_id);
  if (!business) return;
  const owner = await pool.query(
    `select id, email from users where id = $1`,
    [business.owner_id]
  );
  const ownerRow = owner.rows[0];
  if (!ownerRow || !ownerRow.email) return;
  notificationCatalog.dispatch('site.request.status', {
    owner: { id: ownerRow.id, email: ownerRow.email },
    // Full Business context (name + brand) so the status email is branded to
    // the Business (brand-consolidation tickets 02/04).
    business: { name: business.name, brand: business.brand },
    request: {
      hostname: siteDomains.displayHostname(row),
      status: row.status,
      rejection_reason: row.rejection_reason,
      dns_type: row.dns_type,
      dns_name: row.dns_name,
      dns_value: row.dns_value
    }
  });
}

exports.getMine = async (req, res) => {
  try {
    const business = await requireBusiness(req, res);
    if (!business) return;
    const row = await siteDomains.getForBusiness(business.id);
    ok(res, 200, row ? { ...row, display_hostname: siteDomains.displayHostname(row), suggested_subdomain: siteDomains.suggestSubdomain(business.name) } : {
      suggested_subdomain: siteDomains.suggestSubdomain(business.name)
    });
  } catch (error) {
    logger.error(`Error fetching site request: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  }
};

exports.request = async (req, res) => {
  try {
    const business = await requireBusiness(req, res);
    if (!business) return;
    const row = await siteDomains.request(business.id, req.body);
    notifyStatusChanged(req, row);
    ok(res, 201, { ...row, display_hostname: siteDomains.displayHostname(row) });
  } catch (error) {
    if (error.code) {
      return fail(res, error.code === 'SITE_REQUEST_CONFLICT' ? 409 : 400, error.code, error.message);
    }
    logger.error(`Error creating site request: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  }
};

// Owner signals "I've added the DNS record" — moves the request to dns_pending
// so staff can run the automated verification.
exports.dnsAdded = async (req, res) => {
  try {
    const business = await requireBusiness(req, res);
    if (!business) return;
    const row = await siteDomains.getForBusiness(business.id);
    if (!row) {
      return fail(res, 404, 'SITE_REQUEST_NOT_FOUND', 'No site request yet');
    }
    if (!['approved', 'dns_pending'].includes(row.status)) {
      return fail(res, 400, 'SITE_REQUEST_BAD_STATE', 'Wait for approval before adding DNS records');
    }
    const updated = await siteDomains.markDnsAdded(row.id);
    notifyStatusChanged(req, updated);
    ok(res, 200, updated);
  } catch (error) {
    logger.error(`Error marking DNS added: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  }
};

// ---- Admin queue ----

exports.listQueue = async (req, res) => {
  try {
    const rows = await siteDomains.listAll();
    ok(res, 200, rows.map((r) => ({ ...r, display_hostname: siteDomains.displayHostname(r) })));
  } catch (error) {
    logger.error(`Error listing site requests: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  }
};

async function requireRequest(req, res) {
  const row = await siteDomains.getById(req.params.id);
  if (!row) {
    fail(res, 404, 'SITE_REQUEST_NOT_FOUND', 'Site request not found');
    return null;
  }
  return row;
}

async function runAdminTransition(req, res, fn, expectedKey) {
  try {
    const row = await requireRequest(req, res);
    if (!row) return;
    const updated = await fn(row.id);
    notifyStatusChanged(req, updated);
    ok(res, 200, updated);
  } catch (error) {
    if (error.code) {
      return fail(res, 400, error.code, error.message);
    }
    logger.error(`Error in site request ${expectedKey}: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  }
}

exports.approve = (req, res) => runAdminTransition(req, res, siteDomains.approve, 'approve');

exports.reject = async (req, res) => {
  try {
    const row = await requireRequest(req, res);
    if (!row) return;
    const updated = await siteDomains.reject(row.id, req.body.reason);
    notifyStatusChanged(req, updated);
    ok(res, 200, updated);
  } catch (error) {
    if (error.code) {
      return fail(res, 400, error.code, error.message);
    }
    logger.error(`Error rejecting site request: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  }
};

exports.setMarketplaceListing = async (req, res) => {
  try {
    const business = await requireBusiness(req, res);
    if (!business) return;
    const { id } = req.params;
    const enabled = req.body && req.body.enabled;
    const row = await siteDomains.setMarketplaceListing(business.id, id, enabled);
    if (!row) {
      return fail(res, 404, 'VENUE_NOT_FOUND', 'Only approved venues of a live-site business can toggle marketplace listing');
    }
    ok(res, 200, row);
  } catch (error) {
    logger.error(`Error toggling marketplace listing: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  }
};

exports.verify = async (req, res) => {
  try {
    const row = await requireRequest(req, res);
    if (!row) return;
    const updated = await siteDomains.verify(row.id);
    notifyStatusChanged(req, updated);
    ok(res, 200, updated);
  } catch (error) {
    if (error.code) {
      return fail(res, 400, error.code, error.message);
    }
    logger.error(`Error verifying site request: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  }
};

exports.markLive = (req, res) => runAdminTransition(req, res, siteDomains.markLive, 'mark-live');

exports.setChecklist = async (req, res) => {
  try {
    const row = await requireRequest(req, res);
    if (!row) return;
    const { key, done } = req.body;
    if (!key || typeof key !== 'string') {
      return fail(res, 400, 'SITE_REQUEST_VALIDATION', 'A checklist item key is required');
    }
    const updated = await siteDomains.setChecklistItem(row.id, key, !!done);
    ok(res, 200, updated);
  } catch (error) {
    logger.error(`Error updating site request checklist: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  }
};

module.exports = { ...exports };