// Site Customer auth controllers (ADR-0030): register / login / Google / OTP
// verification — all scoped to a live site's Business via the site hostname
// the client passes on every request. Sessions are bearer tokens resolved by
// the requireSiteCustomer middleware.

const { ok, fail } = require('../utils/response');
const logger = require('../utils/logger');
const pool = require('../db');
const siteCustomers = require('../services/siteCustomers');

function ssoCustomer(customer) {
  return (({ id, business_id, email, name, phone, email_verified_at, phone_verified_at }) => ({
    id, business_id, email, name, phone, email_verified_at, phone_verified_at
  }))(customer);
}

exports.register = async (req, res) => {
  try {
    const { customer, session } = await siteCustomers.register(req.body || {});
    ok(res, 201, { customer: ssoCustomer(customer), token: session.token, expires_at: session.expires_at });
  } catch (error) {
    if (error.code === 'SITE_CUSTOMER_EXISTS') return fail(res, 409, error.code, error.message);
    if (error.code === 'SITE_HOST_NOT_LIVE') return fail(res, 403, error.code, error.message);
    if (error.code) return fail(res, 400, error.code, error.message);
    logger.error(`Error registering site customer: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  }
};

exports.login = async (req, res) => {
  try {
    const { customer, session } = await siteCustomers.login(req.body || {});
    ok(res, 200, { customer: ssoCustomer(customer), token: session.token, expires_at: session.expires_at });
  } catch (error) {
    if (error.code) return fail(res, error.code === 'SITE_CUSTOMER_BAD_CREDENTIALS' ? 401 : 400, error.code, error.message);
    logger.error(`Error logging in site customer: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  }
};

exports.google = async (req, res) => {
  try {
    const { customer, session } = await siteCustomers.googleUpsert(req.body || {});
    ok(res, 201, { customer: ssoCustomer(customer), token: session.token, expires_at: session.expires_at });
  } catch (error) {
    if (error.code) return fail(res, error.code === 'GOOGLE_PROFILE_INVALID' ? 400 : 403, error.code, error.message);
    logger.error(`Error signing in with Google: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  }
};

exports.me = async (req, res) => {
  ok(res, 200, ssoCustomer(req.siteCustomer));
};

exports.logout = async (req, res) => {
  await siteCustomers.revokeToken(req.token);
  ok(res, 200, { logged_out: true });
};

exports.sendPhoneCode = async (req, res) => {
  try {
    const result = await siteCustomers.sendPhoneCode(req.siteCustomer.id, req.body?.phone);
    ok(res, 200, { sent: true, ...result });
  } catch (error) {
    if (error.code) return fail(res, error.code === 'OTP_RATE_LIMITED' ? 429 : 400, error.code, error.message);
    logger.error(`Error sending site customer phone code: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  }
};

exports.confirmPhoneCode = async (req, res) => {
  try {
    await siteCustomers.confirmPhoneCode(req.siteCustomer.id, req.body?.phone, req.body?.code);
    ok(res, 200, { confirmed: true });
  } catch (error) {
    if (error.code) return fail(res, error.code === 'OTP_TOO_MANY_ATTEMPTS' ? 429 : 400, error.code, error.message);
    logger.error(`Error confirming site customer phone code: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  }
};

exports.sendEmailCode = async (req, res) => {
  try {
    const result = await siteCustomers.sendEmailCode(req.siteCustomer.id, req.body?.email);
    ok(res, 200, { sent: true, ...result });
  } catch (error) {
    if (error.code) return fail(res, error.code === 'OTP_RATE_LIMITED' ? 429 : 400, error.code, error.message);
    logger.error(`Error sending site customer email code: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  }
};

exports.confirmEmailCode = async (req, res) => {
  try {
    await siteCustomers.confirmEmailCode(req.siteCustomer.id, req.body?.email, req.body?.code);
    ok(res, 200, { confirmed: true });
  } catch (error) {
    if (error.code) return fail(res, error.code === 'OTP_TOO_MANY_ATTEMPTS' ? 429 : 400, error.code, error.message);
    logger.error(`Error confirming site customer email code: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  }
};

// Owner Console Customers directory (ADR-0030): the Business's Site
// Customers with their booking aggregates — the owner's own audience asset.
exports.listCustomers = async (req, res) => {
  try {
    const business = await pool.query(`select id from businesses where owner_id = $1`, [req.user.id]);
    const businessId = business.rows[0]?.id;
    if (!businessId) {
      return fail(res, 404, 'BUSINESS_NOT_FOUND', 'No business is set up for this account');
    }
    const q = String(req.query.q || '').trim();
    const values = [businessId];
    let where = `where sc.business_id = $1`;
    if (q) {
      values.push(`%${q}%`);
      where += ` and (sc.name ilike $2 or sc.email ilike $2 or sc.phone ilike $2)`;
    }
    const { rows } = await pool.query(
      `select sc.id, sc.business_id, sc.email, sc.name, sc.phone, sc.email_verified_at, sc.phone_verified_at,
              sc.created_at as joined_at,
              count(b.id)::int as booking_count,
              coalesce(sum(b.total_price), 0)::float8 as total_spend,
              max(b.start_at) as last_booking_at
       from site_customers sc
       left join bookings b on b.site_customer_id = sc.id
       ${where}
       group by sc.id
       order by max(b.start_at) desc nulls last, sc.created_at desc`,
      values
    );
    ok(res, 200, rows);
  } catch (error) {
    logger.error(`Error listing site customers: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  }
};

// Middleware: resolve the bearer token to a Site Customer; require a live
// site hostname header so a site's surface never acts outside its Business.
exports.requireSiteCustomer = async (req, res, next) => {
  const header = String(req.headers.authorization || '');
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) {
    return fail(res, 401, 'UNAUTHORIZED', 'Sign in as a site customer to continue.');
  }
  try {
    const customer = await siteCustomers.customerForToken(token);
    if (!customer) {
      return fail(res, 401, 'UNAUTHORIZED', 'Your session has expired. Sign in again.');
    }
    req.siteCustomer = customer;
    req.token = token;
    next();
  } catch (error) {
    logger.error(`Error resolving site customer session: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  }
};