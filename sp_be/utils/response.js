function ok(res, status, data, meta) {
  const body = { success: true, data };
  if (meta) body.meta = meta;
  res.status(status).json(body);
}

function fail(res, status, code, message) {
  res.status(status).json({
    success: false,
    error: { code, message }
  });
}

module.exports = { ok, fail };
