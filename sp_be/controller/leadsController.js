const pool = require('../db');
const { ok, fail } = require('../utils/response');
const logger = require('../utils/logger');
const notificationCatalog = require('../utils/notificationCatalog');

const LEAD_STATUSES = ['new', 'contacted', 'converted', 'closed'];

// Public "list your place" form (ticket 07). Stored as an Owner Lead and
// surfaced to admins; converting always creates a brand-new Owner account and
// never touches an existing player account (CONTEXT.md).
exports.submitLead = async (req, res) => {
  try {
    const { name, email, phone, venue_name, city, message } = req.body;

    const trimmedName = String(name || '').trim();
    const trimmedEmail = String(email || '').trim().toLowerCase();
    if (!trimmedName || !trimmedEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmedEmail)) {
      return fail(res, 400, 'LEAD_VALIDATION', 'name and a valid email are required');
    }
    if (trimmedName.length > 120) {
      return fail(res, 400, 'LEAD_VALIDATION', 'name must be 120 characters or fewer');
    }

    const { rows } = await pool.query(
      `insert into owner_leads (name, email, phone, venue_name, city, message)
       values ($1, $2, $3, $4, $5, $6)
       returning *`,
      [trimmedName, trimmedEmail, String(phone || '').trim() || null, String(venue_name || '').trim() || null, String(city || '').trim() || null, String(message || '').trim() || null]
    );
    const lead = rows[0];

    // New lead -> notify every admin (in-app row + fire-and-forget email),
    // fanned out by the notification catalog.
    await notificationCatalog.dispatch('lead.new', { lead });

    ok(res, 201, { id: lead.id, status: lead.status });
  } catch (error) {
    logger.error(`Error submitting lead: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  }
};

// Admin leads queue. Duplicates (same email or same venue name elsewhere in
// the queue) are flagged for human judgement rather than merged.
exports.listLeads = async (req, res) => {
  try {
    const { status } = req.query;
    const params = [];
    let where = '';
    if (status && LEAD_STATUSES.includes(status)) {
      params.push(status);
      where = `where l.status = $1`;
    }
    const { rows } = await pool.query(
      `select l.*,
              exists (
                select 1 from owner_leads l2
                where l2.id <> l.id
                  and (l2.email = l.email
                       or (l2.venue_name is not null and l.venue_name is not null and l2.venue_name = l.venue_name))
              ) as is_duplicate
       from owner_leads l
       ${where}
       order by l.created_at desc`,
      params
    );
    ok(res, 200, rows);
  } catch (error) {
    logger.error(`Error listing leads: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  }
};

exports.updateLead = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, admin_notes } = req.body;

    if (status !== undefined && !LEAD_STATUSES.includes(status)) {
      return fail(res, 400, 'LEAD_VALIDATION', `status must be one of: ${LEAD_STATUSES.join(', ')}`);
    }

    const updates = ['updated_at = now()'];
    const values = [];
    let index = 1;
    if (status !== undefined) {
      updates.push(`status = $${index++}`);
      values.push(status);
    }
    if (admin_notes !== undefined) {
      updates.push(`admin_notes = $${index++}`);
      values.push(String(admin_notes).trim() || null);
    }
    values.push(id);

    const { rows } = await pool.query(
      `update owner_leads set ${updates.join(', ')} where id = $${index} returning *`,
      values
    );
    if (rows.length === 0) {
      return fail(res, 404, 'LEAD_NOT_FOUND', 'Lead not found');
    }
    ok(res, 200, rows[0]);
  } catch (error) {
    logger.error(`Error updating lead: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  }
};