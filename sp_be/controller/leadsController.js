const pool = require('../db');
const { ok, fail } = require('../utils/response');
const logger = require('../utils/logger');
const emailService = require('../utils/emailService');

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

    // New lead -> notify every admin (in-app row + fire-and-forget email).
    const { rows: admins } = await pool.query(
      `select id, email from users where role = 'admin' and email is not null`
    );
    for (const admin of admins) {
      await pool.query(
        `insert into notifications (user_id, type, title, body)
         values ($1, 'owner_lead', $2, $3)`,
        [admin.id, 'New owner lead', `${lead.name} wants to list a venue`]
      );
    }
    for (const admin of admins) {
      emailService.sendEmail({
        to: admin.email,
        subject: `New owner lead: ${lead.name}`,
        html: emailService.shell(`
          <h2 style="color:#176036;">New owner lead</h2>
          <p><strong>${emailService.escapeHtml(lead.name)}</strong> (${emailService.escapeHtml(lead.email)}) wants to list a venue${lead.venue_name ? ` — "${emailService.escapeHtml(lead.venue_name)}"` : ''}.</p>
          <p style="color:#666;">Open the Leads tab in the console to review and convert this lead.</p>`)
      }).catch((err) => logger.error(`New-lead admin email failed: ${err.message}`));
    }

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