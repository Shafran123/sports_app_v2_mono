// Owner-side Booking Widget & Branded Venue Page settings (ADR-0028): the
// on/off switch, the domain allowlist, and the venue's brand tokens. Every
// handler verifies venue ownership before reading or writing a row.

const pool = require('../db');
const { ok, fail } = require('../utils/response');
const logger = require('../utils/logger');
const { sanitizeBrand, sanitizeDomains } = require('../utils/widget');

async function verifyOwnership(client, venueId, userId) {
  const { rows } = await client.query(
    `select id, owner_id, widget_key, widget_enabled, allowed_domains, brand, slug,
            name, description, address, city, phone, photos, amenities, rules,
            cancellation_policy, accepts_cash, venue_tax_rate, status, visibility
     from venues where id = $1`,
    [venueId]
  );
  if (rows.length === 0) {
    return { error: { status: 404, code: 'VENUE_NOT_FOUND', message: 'Venue not found' } };
  }
  if (rows[0].owner_id !== userId) {
    return { error: { status: 403, code: 'FORBIDDEN', message: 'You do not own this venue' } };
  }
  return { venue: rows[0] };
}

exports.getWidgetSettings = async (req, res) => {
  try {
    const { venue, error } = await verifyOwnership(pool, req.params.id, req.user.id);
    if (error) return fail(res, error.status, error.code, error.message);

    ok(res, 200, {
      venue_id: venue.id,
      slug: venue.slug,
      widget_key: venue.widget_key,
      widget_enabled: venue.widget_enabled,
      allowed_domains: Array.isArray(venue.allowed_domains) ? venue.allowed_domains : [],
      brand: venue.brand || {},
      visibility: venue.visibility
    });
  } catch (error) {
    logger.error(`Error fetching widget settings: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  }
};

exports.updateWidgetSettings = async (req, res) => {
  const client = await pool.connect();
  try {
    const { venue, error } = await verifyOwnership(client, req.params.id, req.user.id);
    if (error) {
      await client.query('rollback');
      return fail(res, error.status, error.code, error.message);
    }

    // A brand page / embed without the venue's real presence is a dead end —
    // only approved venues may turn the off-platform surfaces on.
    if (req.body.widget_enabled === true && venue.status !== 'approved') {
      await client.query('rollback');
      return fail(res, 400, 'WIDGET_APPROVAL_REQUIRED', 'The venue must be approved before its widget can go live');
    }

    let brand = null;
    let domains = null;
    try {
      brand = req.body.brand !== undefined ? sanitizeBrand(req.body.brand) : null;
      domains = req.body.allowed_domains !== undefined ? sanitizeDomains(req.body.allowed_domains) : null;
    } catch (validationError) {
      await client.query('rollback');
      return fail(res, 400, validationError.code, validationError.message);
    }

    await client.query('begin');

    const { rows: updated } = await client.query(
      `update venues set
         widget_enabled = coalesce($2, widget_enabled),
         allowed_domains = coalesce($3::jsonb, allowed_domains),
         brand = coalesce($4::jsonb, brand),
         updated_at = now()
       where id = $1
       returning widget_enabled, allowed_domains, brand`,
      [
        venue.id,
        req.body.widget_enabled !== undefined ? !!req.body.widget_enabled : null,
        domains !== null ? JSON.stringify(domains) : null,
        brand !== null ? JSON.stringify(brand) : null
      ]
    );

    await client.query('commit');

    ok(res, 200, {
      venue_id: venue.id,
      slug: venue.slug,
      widget_key: venue.widget_key,
      widget_enabled: updated[0].widget_enabled,
      allowed_domains: updated[0].allowed_domains,
      brand: updated[0].brand
    });
  } catch (error) {
    await client.query('rollback').catch(() => {});
    logger.error(`Error updating widget settings: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  } finally {
    client.release();
  }
};