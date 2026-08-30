// Owner console: /business/payment-methods — the Payments page (ADR-0044).
// Toggles for cash + PayHere, PayHere credential save/remove, all read through
// the at-least-one-method guard. Secrets never leave the server; responses
// carry configured state + a masked app_id hint only.

const pool = require('../db');
const { ok, fail } = require('../utils/response');
const logger = require('../utils/logger');
const businessService = require('../services/businesses');
const {
  getMethods,
  setMethodEnabled,
  savePayhereCredentials,
  removePayhereCredentials
} = require('../services/businessPaymentMethods');
const { maskLast4 } = require('../utils/format');

async function requireBusiness(req, res) {
  const business = await businessService.getByOwnerId(req.user.id);
  if (!business) {
    fail(res, 404, 'BUSINESS_NOT_FOUND', 'No business is set up for this account');
    return null;
  }
  return business;
}

function publicState(rows) {
  const cash = rows.find((r) => r.method === 'cash');
  const payhere = rows.find((r) => r.method === 'payhere');
  const configured = Boolean(payhere && payhere.merchant_id && payhere.app_id);
  return {
    cash: { enabled: Boolean(cash && cash.enabled) },
    payhere: {
      enabled: Boolean(payhere && payhere.enabled),
      configured,
      app_last4: payhere && payhere.app_id ? payhere.app_id.slice(-4) : null,
      // The merchant secret is only provable on the first real transaction
      // (Q11/Q24): with credentials saved the state is "awaiting first
      // transaction" until a paid PayHere payment exists for the Business.
      state: !configured ? 'not_configured' : 'awaiting_first_transaction'
    }
  };
}

// Flips awaiting_first_transaction -> configured once the Business has at
// least one paid PayHere payment on its own gateway (the first real
// transaction proves the merchant secret).
async function refinePayhereState(businessId, state) {
  if (state === 'not_configured') return state;
  const { rows } = await pool.query(
    `select 1 from payments
     where gateway_business_id = $1 and payment_method = 'payhere' and status = 'paid'
     limit 1`,
    [businessId]
  );
  return rows.length > 0 ? 'configured' : 'awaiting_first_transaction';
}

async function respondWithState(res, businessId, rows) {
  const state = publicState(rows);
  state.payhere.state = await refinePayhereState(businessId, state.payhere.state);
  ok(res, 200, state);
}

exports.getPaymentMethods = async (req, res) => {
  try {
    const business = await requireBusiness(req, res);
    if (!business) return;
    const rows = await getMethods(business.id);
    await respondWithState(res, business.id, rows);
  } catch (error) {
    logger.error(`Error fetching payment methods: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  }
};

exports.updatePaymentMethods = async (req, res) => {
  try {
    const business = await requireBusiness(req, res);
    if (!business) return;
    const { cash, payhere } = req.body;
    if (cash === undefined && payhere === undefined) {
      return fail(res, 400, 'PAYMENT_METHODS_VALIDATION', 'Provide cash and/or payhere toggles');
    }
    for (const [method, enabled] of Object.entries({ cash, payhere })) {
      if (enabled === undefined) continue;
      if (typeof enabled !== 'boolean') {
        return fail(res, 400, 'PAYMENT_METHODS_VALIDATION', `${method} must be a boolean`);
      }
      await setMethodEnabled(business.id, method, enabled);
    }
    const rows = await getMethods(business.id);
    await respondWithState(res, business.id, rows);
  } catch (error) {
    if (error.code) {
      return fail(res, 400, error.code, error.message);
    }
    logger.error(`Error updating payment methods: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  }
};

exports.savePayhereCredentials = async (req, res) => {
  try {
    const business = await requireBusiness(req, res);
    if (!business) return;
    await savePayhereCredentials(business.id, req.body);
    const rows = await getMethods(business.id);
    await respondWithState(res, business.id, rows);
  } catch (error) {
    if (error.code) {
      return fail(res, 400, error.code, error.message);
    }
    logger.error(`Error saving PayHere credentials: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  }
};

exports.removePayhereCredentials = async (req, res) => {
  try {
    const business = await requireBusiness(req, res);
    if (!business) return;
    await removePayhereCredentials(business.id);
    const rows = await getMethods(business.id);
    await respondWithState(res, business.id, rows);
  } catch (error) {
    if (error.code) {
      return fail(res, 400, error.code, error.message);
    }
    logger.error(`Error removing PayHere credentials: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  }
};

// ---- Admin read-only summary (Q29/Q33) -------------------------------------
// Config state + PayHere collection sums per Business — informational only,
// since the money sits in the owner's PayHere account, never the platform's.

exports.adminSummary = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `select b.id as business_id, b.name as business_name,
              max(bpm.cash_enabled) as cash_enabled,
              max(bpm.payhere_enabled) as payhere_enabled,
              max(bpm.payhere_configured) as payhere_configured,
              max(bpm.app_id) as app_id_last4
       from businesses b
       left join lateral (
         select
           (m.method = 'cash' and m.enabled) as cash_enabled,
           (m.method = 'payhere' and m.enabled) as payhere_enabled,
           (m.method = 'payhere' and m.merchant_id is not null and m.app_id is not null) as payhere_configured,
           case when m.method = 'payhere' then m.app_id end as app_id
         from business_payment_methods m
         where m.business_id = b.id
       ) bpm on true
       group by b.id
       order by b.name`
    );

    const { rows: sums } = await pool.query(
      `select p.gateway_business_id as business_id,
              to_char((p.paid_at at time zone 'Asia/Colombo')::date, 'YYYY-MM-DD') as day,
              count(*)::int as payhere_payments,
              coalesce(sum(p.amount - p.tax_amount - p.venue_tax_amount), 0)::int as payhere_revenue_net,
              coalesce(sum(p.tax_amount + p.venue_tax_amount), 0)::int as payhere_tax
       from payments p
       where p.status = 'paid' and p.payment_method = 'payhere'
         and p.gateway_business_id is not null
         and p.paid_at >= now() - interval '90 days'
       group by p.gateway_business_id, day
       order by day`
    );

    ok(res, 200, {
      businesses: rows.map((r) => ({
        business_id: r.business_id,
        business_name: r.business_name,
        cash_enabled: Boolean(r.cash_enabled),
        payhere_enabled: Boolean(r.payhere_enabled),
        payhere_configured: Boolean(r.payhere_configured),
        app_id_last4: r.app_id_last4 ? maskLast4(r.app_id_last4) : null
      })),
      collection: sums
    });
  } catch (error) {
    logger.error(`Error fetching admin payment summary: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  }
};