const pool = require('../db');
const { ok, fail } = require('../utils/response');
const logger = require('../utils/logger');
const { listFlagStates, getTaxRate, getBrandName, getBankDetails, getSmsEvents, setConfig } = require('../utils/featureFlags');

exports.getConfigForAdmin = async (req, res) => {
  try {
    const [flags, taxRate, brandName, bankDetails, smsEvents] = await Promise.all([listFlagStates(), getTaxRate(), getBrandName(), getBankDetails(), getSmsEvents()]);
    ok(res, 200, { flags, tax_rate: taxRate, brand_name: brandName, bank_details: bankDetails, sms_events: smsEvents });
  } catch (error) {
    logger.error(`Error fetching platform config: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  }
}

exports.setFlag = async (req, res) => {
  try {
    const value = req.body?.value;
    const updated = await setConfig(req.params.name, value, req.user.id);
    ok(res, 200, { name: req.params.name, value: updated });
  } catch (error) {
    if (error.code === 'UNKNOWN_CONFIG' || error.code === 'INVALID_VALUE') {
      return fail(res, 400, error.code, error.message);
    }
    logger.error(`Error setting flag ${req.params.name}: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  }
}

exports.listAudit = async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const { rows } = await pool.query(
      `select a.id, a.key, a.old_value, a.new_value, a.changed_at,
              u.name as admin_name, u.email as admin_email
       from flag_audits a
       left join users u on u.id = a.admin_id
       order by a.changed_at desc
       limit $1`,
      [limit]
    );
    ok(res, 200, rows);
  } catch (error) {
    logger.error(`Error listing config audit: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  }
}

