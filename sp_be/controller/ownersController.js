const pool = require('../db');
const { ok, fail } = require('../utils/response');
const logger = require('../utils/logger');
const { getBankDetails } = require('../utils/featureFlags');
const { createOwnerAccount } = require('../services/ownerAccounts');
const notificationCatalog = require('../utils/notificationCatalog');

const PLAN_FIELDS = ['name', 'term_days', 'price_lkr', 'booking_allowance', 'overflow_fee_percent'];

// node-postgres returns `date` columns as Date objects constructed in the
// server's local timezone; render them back to the wall-clock date stored.
function fmtDate(value) {
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(value || '').slice(0, 10);
}

function fmtPlanDates(plan) {
  if (!plan) return plan;
  return { ...plan, start_date: fmtDate(plan.start_date), end_date: fmtDate(plan.end_date) };
}

function validatePlanInput(plan) {
  if (!plan || typeof plan !== 'object') {
    throw Object.assign(new Error('A plan is required'), { code: 'PLAN_VALIDATION' });
  }
  const name = String(plan.name || '').trim();
  const termDays = Number(plan.term_days);
  const priceLkr = Number(plan.price_lkr ?? 0);
  const bookingAllowance = plan.booking_allowance === undefined ? 0 : Number(plan.booking_allowance);
  const overflowFeePercent = plan.overflow_fee_percent === undefined ? 5 : Number(plan.overflow_fee_percent);
  if (!name || name.length > 60) {
    throw Object.assign(new Error('Plan name is required (60 characters or fewer)'), { code: 'PLAN_VALIDATION' });
  }
  if (!Number.isInteger(termDays) || termDays <= 0) {
    throw Object.assign(new Error('term_days must be a positive integer'), { code: 'PLAN_VALIDATION' });
  }
  if (!Number.isInteger(priceLkr) || priceLkr < 0) {
    throw Object.assign(new Error('price_lkr must be a non-negative integer'), { code: 'PLAN_VALIDATION' });
  }
  if (!Number.isInteger(bookingAllowance) || bookingAllowance < 0) {
    throw Object.assign(new Error('booking_allowance must be a non-negative integer'), { code: 'PLAN_VALIDATION' });
  }
  if (!Number.isInteger(overflowFeePercent) || overflowFeePercent < 0 || overflowFeePercent > 100) {
    throw Object.assign(new Error('overflow_fee_percent must be an integer between 0 and 100'), { code: 'PLAN_VALIDATION' });
  }
  return {
    name,
    term_days: termDays,
    price_lkr: priceLkr,
    booking_allowance: bookingAllowance,
    overflow_fee_percent: overflowFeePercent
  };
}

async function resolvePlanTemplate(client, templateId) {
  const { rows } = await client.query(
    `select * from owner_plan_templates where id = $1 and not is_archived`,
    [templateId]
  );
  if (rows.length === 0) {
    throw Object.assign(new Error('Plan template not found or archived'), { code: 'PLAN_TEMPLATE_NOT_FOUND' });
  }
  return rows[0];
}

// Insert an Owner Plan instance for an owner; end = start + term (ticket 09).
async function createPlanInstance(client, ownerId, planFields, startDate) {
  const start = startDate && /^\d{4}-\d{2}-\d{2}$/.test(startDate) ? startDate : new Date(Date.now() + (5 * 60 + 30) * 60 * 1000).toISOString().slice(0, 10);
  const { rows } = await client.query(
    `insert into owner_plans (owner_id, name, term_days, price_lkr, booking_allowance, overflow_fee_percent, start_date, end_date)
     values ($1, $2, $3, $4, $5, $6, $7, $7::date + make_interval(days => $3))
     returning *`,
    [ownerId, planFields.name, planFields.term_days, planFields.price_lkr, planFields.booking_allowance, planFields.overflow_fee_percent, start]
  );
  return rows[0];
}

async function createAgreement(client, ownerId, planId, title, body) {
  const trimmedTitle = String(title || '').trim();
  const trimmedBody = String(body || '').trim();
  if (!trimmedTitle || !trimmedBody) {
    throw Object.assign(new Error('Agreement title and body are required'), { code: 'AGREEMENT_VALIDATION' });
  }
  // Agreement versioning (ADR-0028): every fresh draft bumps the version, so
  // the owner re-accepts the CURRENT terms on renewal — never a stale copy.
  const { rows } = await client.query(
    `insert into owner_agreements (owner_id, plan_id, title, body, version)
     values ($1, $2, $3, $4,
       coalesce((select max(version) + 1 from owner_agreements where owner_id = $1), 1))
     returning *`,
    [ownerId, planId || null, trimmedTitle, trimmedBody]
  );
  return rows[0];
}

// Build plan fields from either a template id or a free-form plan object.
async function resolvePlanInput(client, body) {
  if (body.plan_template_id) {
    const template = await resolvePlanTemplate(client, body.plan_template_id);
    return {
      name: template.name,
      term_days: template.term_days,
      price_lkr: template.price_lkr,
      booking_allowance: template.booking_allowance,
      overflow_fee_percent: template.overflow_fee_percent,
      template_id: template.id
    };
  }
  if (body.plan) {
    const fields = validatePlanInput(body.plan);
    return { ...fields, template_id: null };
  }
  throw Object.assign(new Error('plan_template_id or plan is required'), { code: 'PLAN_VALIDATION' });
}

exports.listPlanTemplates = async (req, res) => {
  try {
    const includeArchived = String(req.query.include_archived || '') === '1';
    const { rows } = await pool.query(
      `select * from owner_plan_templates
       where $1 or not is_archived
       order by created_at desc`,
      [includeArchived]
    );
    ok(res, 200, rows);
  } catch (error) {
    logger.error(`Error listing plan templates: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  }
};

exports.createPlanTemplate = async (req, res) => {
  try {
    let fields;
    try {
      fields = validatePlanInput(req.body);
    } catch (error) {
      return fail(res, 400, error.code, error.message);
    }
    const { rows } = await pool.query(
      `insert into owner_plan_templates (name, term_days, price_lkr, booking_allowance, overflow_fee_percent)
       values ($1, $2, $3, $4, $5)
       returning *`,
      [fields.name, fields.term_days, fields.price_lkr, fields.booking_allowance, fields.overflow_fee_percent]
    );
    ok(res, 201, rows[0]);
  } catch (error) {
    logger.error(`Error creating plan template: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  }
};

exports.updatePlanTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const patch = {};
    for (const field of PLAN_FIELDS) {
      if (req.body[field] !== undefined) patch[field] = req.body[field];
    }
    if (Object.keys(patch).length === 0) {
      return fail(res, 400, 'PLAN_VALIDATION', 'Nothing to update');
    }
    // Validate through the same rules; instances already snapshot their terms.
    // Merge with the current row so a partial PATCH (e.g. fee only) validates.
    const { rows: currentRows } = await pool.query(
      `select name, term_days, price_lkr, booking_allowance, overflow_fee_percent
       from owner_plan_templates where id = $1`,
      [id]
    );
    if (currentRows.length === 0) {
      return fail(res, 404, 'PLAN_TEMPLATE_NOT_FOUND', 'Plan template not found');
    }
    const fields = validatePlanInput({ ...currentRows[0], ...patch });
    const { rows } = await pool.query(
      `update owner_plan_templates set name = $2, term_days = $3, price_lkr = $4,
              booking_allowance = $5, overflow_fee_percent = $6
       where id = $1
       returning *`,
      [id, fields.name, fields.term_days, fields.price_lkr, fields.booking_allowance, fields.overflow_fee_percent]
    );
    ok(res, 200, rows[0]);
  } catch (error) {
    if (error.code === 'PLAN_VALIDATION') {
      return fail(res, 400, error.code, error.message);
    }
    logger.error(`Error updating plan template: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  }
};

exports.archivePlanTemplate = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `update owner_plan_templates set is_archived = true where id = $1 returning *`,
      [req.params.id]
    );
    if (rows.length === 0) {
      return fail(res, 404, 'PLAN_TEMPLATE_NOT_FOUND', 'Plan template not found');
    }
    ok(res, 200, rows[0]);
  } catch (error) {
    logger.error(`Error archiving plan template: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  }
};

// Owner registry: every venue_owner with their current plan, latest agreement
// status, and onboarding state. `expiring_within=N` filters owners whose plan
// ends within N days (the "ends tomorrow" case in the brief).
exports.listOwners = async (req, res) => {
  try {
    const expiringWithin = Number(req.query.expiring_within);
    const expiringCond = Number.isInteger(expiringWithin) && expiringWithin >= 0
      ? `and p.end_date <= (current_date + ${expiringWithin}) and p.end_date >= current_date`
      : '';

    const { rows } = await pool.query(
      `select
         u.id, u.name, u.email, u.phone, u.onboarding_state, u.created_at,
         p.id as plan_id, p.name as plan_name, p.term_days as plan_term_days,
         p.price_lkr as plan_price_lkr, to_char(p.start_date, 'YYYY-MM-DD') as plan_start, to_char(p.end_date, 'YYYY-MM-DD') as plan_end,
         a.id as agreement_id, a.status as agreement_status, a.accepted_at as agreement_accepted_at,
         (select count(*)::int from venues v where v.owner_id = u.id) as venue_count
       from users u
       left join lateral (
         select * from owner_plans op where op.owner_id = u.id order by op.start_date desc limit 1
       ) p on true
       left join lateral (
         select * from owner_agreements oa where oa.owner_id = u.id order by oa.created_at desc limit 1
       ) a on true
       where u.role = 'venue_owner'
         ${expiringCond}
       order by p.end_date nulls last, u.created_at desc`,
      []
    );
    ok(res, 200, rows);
  } catch (error) {
    logger.error(`Error listing owners: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  }
};

// Admin creates a Venue Owner (ADR-0022): brand-new account, unique email,
// temporary password, a Plan instance, and a drafted Agreement — all emailed.
// Booking Allowance tally for an owner in a month (ADR-0028, ticket 10).
// Rules: one Booking counts once regardless of slot count; walk-in (quick-book)
// bookings count; cancelled and refunded bookings are excluded; overflow is
// the revenue of the bookings that fall AFTER the allowance is consumed
// (chronological), so the first `allowance` bookings in the month are free and
// everything after carries the fee. Billed off-platform (invoice/bank), so
// this endpoint is the record + readout the admin bases the invoice on.
exports.listOwnerAllowance = async (req, res) => {
  try {
    const ownerId = req.params.id;
    const month = String(req.query.month || '');
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return fail(res, 400, 'MONTH_INVALID', 'month must be YYYY-MM');
    }

    const { rows: ownerRows } = await pool.query(
      `select u.id, u.name, u.email,
              p.id as plan_id, p.name as plan_name, p.booking_allowance, p.overflow_fee_percent
       from users u
       left join lateral (
         select * from owner_plans op
         where op.owner_id = u.id and op.start_date <= $2::date and op.end_date >= $2::date
         order by op.start_date desc limit 1
       ) p on true
       where u.id = $1 and u.role = 'venue_owner'`,
      [ownerId, `${month}-01`]
    );
    if (ownerRows.length === 0) {
      return fail(res, 404, 'OWNER_NOT_FOUND', 'Owner not found');
    }
    const owner = ownerRows[0];

    const { rows: tallyRows } = await pool.query(
      `select
         count(*)::int as usage,
         coalesce(sum(total_price) filter (where b.total_price is not null), 0)::int as revenue
       from bookings b
       join courts c on c.id = b.court_id
       join venues v on v.id = c.venue_id
       where v.owner_id = $1
         and b.start_at >= $2::date
         and b.start_at < ($2::date + interval '1 month')
         and b.status <> 'cancelled'`,
      [ownerId, `${month}-01`]
    );
    const { usage, revenue } = tallyRows[0];
    const allowance = Number(owner.booking_allowance || 0);
    const overflowCount = Math.max(0, usage - allowance);

    let overflowRevenue = 0;
    if (overflowCount > 0) {
      const { rows: overflowRows } = await pool.query(
        `select coalesce(sum(total_price), 0)::int as overflow_revenue
         from (
           select total_price, row_number() over (order by b.start_at, b.created_at) as rn
           from bookings b
           join courts c on c.id = b.court_id
           join venues v on v.id = c.venue_id
           where v.owner_id = $1
             and b.start_at >= $2::date
             and b.start_at < ($2::date + interval '1 month')
             and b.status <> 'cancelled'
         ) ranked
         where ranked.rn > $3`,
        [ownerId, `${month}-01`, allowance]
      );
      overflowRevenue = overflowRows[0].overflow_revenue;
    }

    const overflowFeePercent = Number(owner.overflow_fee_percent ?? 0);
    const feeEstimateLkr = Math.round(overflowRevenue * overflowFeePercent / 100);

    ok(res, 200, {
      owner: { id: owner.id, name: owner.name, email: owner.email },
      plan: owner.plan_id
        ? { id: owner.plan_id, name: owner.plan_name, booking_allowance: allowance, overflow_fee_percent: overflowFeePercent }
        : null,
      month,
      usage,
      revenue,
      overflow_count: overflowCount,
      overflow_revenue: overflowRevenue,
      fee_estimate_lkr: feeEstimateLkr
    });
  } catch (error) {
    logger.error(`Error listing owner allowance: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  }
};

exports.createOwner = async (req, res) => {
  const client = await pool.connect();
  try {
    const { name, email, phone, temporary_password, start_date, agreement, lead_id } = req.body;

    const trimmedEmail = String(email || '').trim().toLowerCase();
    const password = String(temporary_password || '');
    if (!trimmedEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmedEmail)) {
      return fail(res, 400, 'OWNER_VALIDATION', 'A valid email is required');
    }
    if (password.length < 8) {
      return fail(res, 400, 'OWNER_VALIDATION', 'temporary_password must be at least 8 characters');
    }
    if (!agreement || !String(agreement.title || '').trim() || !String(agreement.body || '').trim()) {
      return fail(res, 400, 'OWNER_VALIDATION', 'agreement with a title and body is required');
    }

    await client.query('begin');

    const { rows: existing } = await client.query(
      `select 1 from users where lower(email) = $1 limit 1`,
      [trimmedEmail]
    );
    if (existing.length > 0) {
      await client.query('rollback');
      // Never reuse or mutate an existing account (even a Player's) — the
      // admin must supply a distinct email for the owner account.
      return fail(res, 409, 'EMAIL_IN_USE', 'That email already belongs to an account. Owner accounts always get their own email.');
    }

    const planFields = await resolvePlanInput(client, req.body);
    const account = await createOwnerAccount({
      name: String(name || '').trim(),
      email: trimmedEmail,
      phone: String(phone || '').trim() || null,
      temporaryPassword: password
    });
    const owner = account.user;

    const plan = await createPlanInstance(client, owner.id, planFields, start_date);
    const ownerAgreement = await createAgreement(client, owner.id, plan.id, agreement.title, agreement.body);

    if (lead_id) {
      await client.query(
        `update owner_leads set status = 'converted', updated_at = now() where id = $1 and status <> 'converted'`,
        [lead_id]
      );
    }

    await client.query('commit');

    const bankDetails = await getBankDetails();
    await notificationCatalog.dispatch('owner.welcome', { owner, password, plan, agreement: ownerAgreement, bankDetails });

    const { rows: savedPlan } = await pool.query(
      `select * from owner_plans where id = $1`,
      [plan.id]
    );
    const { rows: savedAgreement } = await pool.query(
      `select * from owner_agreements where id = $1`,
      [ownerAgreement.id]
    );

    ok(res, 201, {
      owner: { id: owner.id, name: owner.name, email: owner.email, role: owner.role, onboarding_state: owner.onboarding_state },
      plan: fmtPlanDates(savedPlan[0]),
      agreement: savedAgreement[0]
    });
  } catch (error) {
    await client.query('rollback').catch(() => {});
    if (error.code === 'PLAN_VALIDATION' || error.code === 'PLAN_TEMPLATE_NOT_FOUND' || error.code === 'AGREEMENT_VALIDATION' || error.code === 'EMAIL_IN_USE') {
      return fail(res, error.code === 'PLAN_TEMPLATE_NOT_FOUND' ? 404 : 400, error.code, error.message);
    }
    logger.error(`Error creating owner: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  } finally {
    client.release();
  }
};

// Renewal: a fresh Plan instance + a fresh pending Agreement, emailed with
// the bank details; the owner must re-accept (ADR-0022).
exports.renewOwner = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { start_date, agreement } = req.body;

    await client.query('begin');

    const { rows: ownerRows } = await client.query(
      `select * from users where id = $1 and role = 'venue_owner'`,
      [id]
    );
    if (ownerRows.length === 0) {
      await client.query('rollback');
      return fail(res, 404, 'OWNER_NOT_FOUND', 'Venue owner not found');
    }
    const owner = ownerRows[0];

    if (!agreement || !String(agreement.title || '').trim() || !String(agreement.body || '').trim()) {
      await client.query('rollback');
      return fail(res, 400, 'OWNER_VALIDATION', 'agreement with a title and body is required');
    }

    const planFields = await resolvePlanInput(client, req.body);
    const plan = await createPlanInstance(client, owner.id, planFields, start_date);
    const ownerAgreement = await createAgreement(client, owner.id, plan.id, agreement.title, agreement.body);

    await client.query('commit');

    const bankDetails = await getBankDetails();
    await notificationCatalog.dispatch('owner.renewal', { owner, plan, agreement: ownerAgreement, bankDetails });

    ok(res, 200, { plan: fmtPlanDates(plan), agreement: ownerAgreement });
  } catch (error) {
    await client.query('rollback').catch(() => {});
    if (error.code === 'PLAN_VALIDATION' || error.code === 'PLAN_TEMPLATE_NOT_FOUND' || error.code === 'AGREEMENT_VALIDATION') {
      return fail(res, error.code === 'PLAN_TEMPLATE_NOT_FOUND' ? 404 : 400, error.code, error.message);
    }
    logger.error(`Error renewing owner: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  } finally {
    client.release();
  }
};

// Off-platform renewal chase: an email with the plan status and bank details.
exports.nudgeOwner = async (req, res) => {
  try {
    const { id } = req.params;
    const { rows: ownerRows } = await pool.query(
      `select * from users where id = $1 and role = 'venue_owner'`,
      [id]
    );
    if (ownerRows.length === 0) {
      return fail(res, 404, 'OWNER_NOT_FOUND', 'Venue owner not found');
    }
    const owner = ownerRows[0];

    const { rows: planRows } = await pool.query(
      `select * from owner_plans where owner_id = $1 order by start_date desc limit 1`,
      [id]
    );
    const plan = planRows[0] || null;

    const bankDetails = await getBankDetails();
    await notificationCatalog.dispatch('owner.nudge', { owner, plan, bankDetails });

    ok(res, 200, { nudged: true });
  } catch (error) {
    logger.error(`Error nudging owner: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  }
};

// Owner-facing: current plan + agreement history.
exports.getMyPlan = async (req, res) => {
  try {
    const { rows: planRows } = await pool.query(
      `select * from owner_plans where owner_id = $1 order by start_date desc`,
      [req.user.id]
    );
    const { rows: agreementRows } = await pool.query(
      `select * from owner_agreements where owner_id = $1 order by created_at desc`,
      [req.user.id]
    );
    const { rows: bankRows } = await pool.query(
      `select value from platform_config where key = 'bank_details'`
    );
    ok(res, 200, {
      plans: planRows.map(fmtPlanDates),
      agreements: agreementRows,
      bank_details: bankRows.length ? bankRows[0].value : {}
    });
  } catch (error) {
    logger.error(`Error fetching owner plan: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  }
};

// The agreement the owner must accept before console use: the latest pending
// one, or the latest overall when none is pending.
exports.getCurrentAgreement = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `select oa.*, p.name as plan_name, p.term_days as plan_term_days, p.price_lkr as plan_price_lkr,
              to_char(p.start_date, 'YYYY-MM-DD') as plan_start, to_char(p.end_date, 'YYYY-MM-DD') as plan_end
       from owner_agreements oa
       left join owner_plans p on p.id = oa.plan_id
       where oa.owner_id = $1
       order by (oa.status = 'pending') desc, oa.created_at desc
       limit 1`,
      [req.user.id]
    );
    if (rows.length === 0) {
      return fail(res, 404, 'AGREEMENT_NOT_FOUND', 'No agreement has been issued for this account');
    }
    ok(res, 200, rows[0]);
  } catch (error) {
    logger.error(`Error fetching current agreement: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  }
};

exports.acceptAgreement = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('begin');

    const { rows } = await client.query(
      `update owner_agreements set status = 'accepted', accepted_at = now()
       where id = $1 and owner_id = $2 and status = 'pending'
       returning *`,
      [req.params.id, req.user.id]
    );
    if (rows.length === 0) {
      await client.query('rollback');
      return fail(res, 409, 'AGREEMENT_NOT_ACCEPTABLE', 'This agreement is not pending acceptance');
    }

    await client.query(
      `update users set onboarding_state = 'accepted', updated_at = now()
       where id = $1`,
      [req.user.id]
    );

    await client.query('commit');
    ok(res, 200, rows[0]);
  } catch (error) {
    await client.query('rollback').catch(() => {});
    logger.error(`Error accepting agreement: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  } finally {
    client.release();
  }
};

exports.declineAgreement = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `update owner_agreements set status = 'declined'
       where id = $1 and owner_id = $2 and status = 'pending'
       returning *`,
      [req.params.id, req.user.id]
    );
    if (rows.length === 0) {
      return fail(res, 409, 'AGREEMENT_NOT_DECLINABLE', 'This agreement is not pending acceptance');
    }
    ok(res, 200, rows[0]);
  } catch (error) {
    logger.error(`Error declining agreement: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  }
};

// The owner has rotated their temporary password (client-side via Firebase);
// this clears the flag that forces the change on the next console visit.
exports.passwordChanged = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `update users set must_change_password = false, updated_at = now()
       where id = $1
       returning *`,
      [req.user.id]
    );
    ok(res, 200, rows[0]);
  } catch (error) {
    logger.error(`Error clearing password-change flag: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  }
};

// Owner-facing: the agreement as a printable PDF (owner or admin only).
exports.getAgreementPdf = async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query(
      `select oa.*, p.name as plan_name, p.term_days as plan_term_days,
              p.price_lkr as plan_price_lkr, p.start_date as plan_start, p.end_date as plan_end
       from owner_agreements oa
       left join owner_plans p on p.id = oa.plan_id
       where oa.id = $1`,
      [id]
    );
    if (rows.length === 0) {
      return fail(res, 404, 'AGREEMENT_NOT_FOUND', 'Agreement not found');
    }
    const agreement = rows[0];
    if (agreement.owner_id !== req.user.id && req.user.role !== 'admin') {
      return fail(res, 403, 'FORBIDDEN', 'Access denied');
    }

    const { renderAgreementPdf } = require('../utils/agreementService');
    const pdf = await renderAgreementPdf(agreement, agreement);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="owner-agreement.pdf"`);
    res.send(pdf);
  } catch (error) {
    logger.error(`Error generating agreement PDF: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  }
};