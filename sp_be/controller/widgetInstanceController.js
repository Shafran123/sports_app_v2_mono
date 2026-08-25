// Owner console: Widget Instance CRUD (ADR-0028 amendment v1.5, ticket 03).
// Every handler resolves the owner's Business first, then scopes the request
// to it — an owner can only operate on instances of their own business.

const { ok, fail } = require('../utils/response');
const logger = require('../utils/logger');
const businessService = require('../services/businesses');
const widgetInstances = require('../services/widgetInstances');

async function requireBusiness(req, res) {
  const business = await businessService.getByOwnerId(req.user.id);
  if (!business) {
    fail(res, 404, 'BUSINESS_NOT_FOUND', 'No business is set up for this account');
    return null;
  }
  return business;
}

exports.list = async (req, res) => {
  try {
    const business = await requireBusiness(req, res);
    if (!business) return;
    const instances = await widgetInstances.listForBusiness(business.id);
    ok(res, 200, instances);
  } catch (error) {
    logger.error(`Error listing widget instances: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  }
};

exports.get = async (req, res) => {
  try {
    const business = await requireBusiness(req, res);
    if (!business) return;
    const detail = await widgetInstances.consoleDetail(business.id, req.params.id);
    if (!detail) {
      return fail(res, 404, 'WIDGET_INSTANCE_NOT_FOUND', 'Widget instance not found');
    }
    ok(res, 200, detail);
  } catch (error) {
    logger.error(`Error fetching widget instance: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  }
};

exports.create = async (req, res) => {
  try {
    const business = await requireBusiness(req, res);
    if (!business) return;
    const instance = await widgetInstances.create(business.id, req.body);
    ok(res, 201, instance);
  } catch (error) {
    if (error.code) {
      return fail(res, 400, error.code, error.message);
    }
    logger.error(`Error creating widget instance: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  }
};

exports.update = async (req, res) => {
  try {
    const business = await requireBusiness(req, res);
    if (!business) return;
    if (!(await widgetInstances.ownedBy(business.id, req.params.id))) {
      return fail(res, 404, 'WIDGET_INSTANCE_NOT_FOUND', 'Widget instance not found');
    }
    const updated = await widgetInstances.update(req.params.id, req.body);
    ok(res, 200, updated);
  } catch (error) {
    if (error.code) {
      return fail(res, 400, error.code, error.message);
    }
    logger.error(`Error updating widget instance: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  }
};

exports.remove = async (req, res) => {
  try {
    const business = await requireBusiness(req, res);
    if (!business) return;
    if (!(await widgetInstances.ownedBy(business.id, req.params.id))) {
      return fail(res, 404, 'WIDGET_INSTANCE_NOT_FOUND', 'Widget instance not found');
    }
    await widgetInstances.remove(req.params.id);
    ok(res, 200, { deleted: true });
  } catch (error) {
    logger.error(`Error deleting widget instance: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  }
};