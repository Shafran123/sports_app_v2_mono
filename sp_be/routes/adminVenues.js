const express = require('express');
const pool = require('../db');
const { ok, fail } = require('../utils/response');
const logger = require('../utils/logger');
const notificationCatalog = require('../utils/notificationCatalog');

const router = express.Router();

async function auditAction(client, venueId, actorId, action, reason) {
  await client.query(
    `insert into venue_audit (venue_id, actor_id, action, reason)
     values ($1, $2, $3, $4)`,
    [venueId, actorId, action, reason || null]
  );
}

router.get('/', async (req, res) => {
  try {
    const { status } = req.query;
    const params = [];
    let where = '';
    if (status && /^[a-z_]+$/.test(status)) {
      params.push(status);
      where = `where v.status = $1`;
    }
    const { rows } = await pool.query(
      `select v.*, u.email as owner_email, u.name as owner_name,
              (select count(*)::int from courts c where c.venue_id = v.id) as court_count
       from venues v
       join users u on u.id = v.owner_id
       ${where}
       order by v.created_at desc`,
      params
    );
    ok(res, 200, rows);
  } catch (error) {
    logger.error(`Error listing venues: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  }
});

router.get('/pending', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `select v.*, u.email as owner_email, u.name as owner_name,
              (select count(*)::int from courts c where c.venue_id = v.id) as court_count
       from venues v
       join users u on u.id = v.owner_id
       where v.status = 'pending'
       order by v.created_at asc`
    );
    ok(res, 200, rows);
  } catch (error) {
    logger.error(`Error listing pending venues: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  }
});

router.get('/:id/audit', async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query(
      `select a.action, a.reason, a.created_at, u.name as actor_name, u.email as actor_email
       from venue_audit a
       left join users u on u.id = a.actor_id
       where a.venue_id = $1
       order by a.created_at desc`,
      [id]
    );
    ok(res, 200, rows);
  } catch (error) {
    logger.error(`Error listing venue audit: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  }
});

router.post('/:id/approve', async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;

    await client.query('begin');

    const { rows } = await client.query(
      `update venues set status = 'approved', rejection_reason = null, updated_at = now()
       where id = $1 and status in ('pending', 'changes_requested')
       returning *`,
      [id]
    );

    if (rows.length === 0) {
      await client.query('rollback');
      const { rows: existing } = await client.query(
        `select status from venues where id = $1`,
        [id]
      );
      if (existing.length === 0) {
        return fail(res, 404, 'VENUE_NOT_FOUND', 'Venue not found');
      }
      return fail(res, 400, 'VENUE_NOT_PENDING', 'Venue is not pending approval');
    }

    const venue = rows[0];

    await client.query(
      `update users set role = 'venue_owner', status = 'active', updated_at = now()
       where id = $1 and role <> 'admin'`,
      [venue.owner_id]
    );

    await auditAction(client, venue.id, req.user.id, 'approved', null);

    const { rows: ownerRows } = await client.query(
      `select email from users where id = $1`,
      [venue.owner_id]
    );

    await client.query('commit');

    const ownerEmail = ownerRows[0]?.email;
    if (ownerEmail) {
      await notificationCatalog.dispatch('venue.approved', { venue, ownerEmail });
    }

    ok(res, 200, venue);
  } catch (error) {
    await client.query('rollback').catch(() => {});
    logger.error(`Error approving venue: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  } finally {
    client.release();
  }
});

router.post('/:id/reject', async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return fail(res, 400, 'REJECTION_REASON_REQUIRED', 'A reason is required');
    }

    await client.query('begin');

    const { rows } = await client.query(
      `update venues set status = 'changes_requested', rejection_reason = $2, updated_at = now()
       where id = $1 and status in ('pending', 'changes_requested')
       returning *`,
      [id, reason]
    );

    if (rows.length === 0) {
      await client.query('rollback');
      const { rows: existing } = await client.query(
        `select status from venues where id = $1`,
        [id]
      );
      if (existing.length === 0) {
        return fail(res, 404, 'VENUE_NOT_FOUND', 'Venue not found');
      }
      return fail(res, 400, 'VENUE_NOT_PENDING', 'Venue is not pending approval');
    }

    const venue = rows[0];
    await auditAction(client, venue.id, req.user.id, 'changes_requested', reason);

    const { rows: ownerRows } = await client.query(
      `select email from users where id = $1`,
      [venue.owner_id]
    );

    await client.query('commit');

    const ownerEmail = ownerRows[0]?.email;
    if (ownerEmail) {
      await notificationCatalog.dispatch('venue.rejected', { venue, ownerEmail, reason });
    }

    ok(res, 200, venue);
  } catch (error) {
    await client.query('rollback').catch(() => {});
    logger.error(`Error rejecting venue: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  } finally {
    client.release();
  }
});

// Shared for suspend / unsuspend / archive / ban: transition a venue, record audit.
async function transitionVenue(req, res, targetStatus, action, allowedFrom) {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { reason } = req.body || {};

    await client.query('begin');

    const { rows } = await client.query(
      `update venues set status = $2, updated_at = now()
       where id = $1 and status = any($3)
       returning *`,
      [id, targetStatus, allowedFrom]
    );

    if (rows.length === 0) {
      await client.query('rollback');
      const { rows: existing } = await client.query(
        `select status from venues where id = $1`,
        [id]
      );
      if (existing.length === 0) {
        return fail(res, 404, 'VENUE_NOT_FOUND', 'Venue not found');
      }
      return fail(res, 400, 'VENUE_NOT_IN_REQUIRED_STATE', `Venue is not in a state that allows ${action}`);
    }

    const venue = rows[0];

    if (targetStatus === 'banned') {
      await client.query(
        `update users set status = 'banned', updated_at = now()
         where id = $1 and role <> 'admin'`,
        [venue.owner_id]
      );
      // Ban is owner-account-level: every venue they own becomes unbookable.
      await client.query(
        `update venues set status = 'banned', updated_at = now()
         where owner_id = $1 and status in ('approved', 'suspended', 'changes_requested')`,
        [venue.owner_id]
      );
    }

    await auditAction(client, venue.id, req.user.id, action, reason);

    await client.query('commit');
    ok(res, 200, venue);
  } catch (error) {
    await client.query('rollback').catch(() => {});
    logger.error(`Error ${action} venue: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  } finally {
    client.release();
  }
}

router.post('/:id/suspend', (req, res) =>
  transitionVenue(req, res, 'suspended', 'suspended', ['approved', 'changes_requested']));
router.post('/:id/unsuspend', (req, res) =>
  transitionVenue(req, res, 'approved', 'unsuspended', ['suspended']));
router.post('/:id/archive', (req, res) =>
  transitionVenue(req, res, 'archived', 'archived', ['approved', 'suspended', 'banned', 'changes_requested']));
router.post('/:id/ban', (req, res) =>
  transitionVenue(req, res, 'banned', 'banned', ['approved', 'suspended', 'changes_requested']));

// Public/private switch — the Admin sets it (typically at provisioning).
// Visibility never changes through the marketplace or owner console; it only
// controls in-app discoverability, never bookability.
router.patch('/:id/visibility', async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { visibility } = req.body || {};
    if (!['public', 'private'].includes(visibility)) {
      return fail(res, 400, 'VISIBILITY_INVALID', 'visibility must be "public" or "private"');
    }

    await client.query('begin');
    const { rows } = await client.query(
      `update venues set visibility = $2, updated_at = now()
       where id = $1
       returning id, name, visibility, status`,
      [id, visibility]
    );
    if (rows.length === 0) {
      await client.query('rollback');
      return fail(res, 404, 'VENUE_NOT_FOUND', 'Venue not found');
    }
    await auditAction(client, id, req.user.id, visibility === 'private' ? 'made_private' : 'made_public', null);
    await client.query('commit');

    ok(res, 200, rows[0]);
  } catch (error) {
    await client.query('rollback').catch(() => {});
    logger.error(`Error updating venue visibility: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  } finally {
    client.release();
  }
});

module.exports = router;