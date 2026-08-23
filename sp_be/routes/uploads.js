const express = require('express');
const crypto = require('crypto');
const path = require('path');
const { ok, fail } = require('../utils/response');
const logger = require('../utils/logger');
const storage = require('../utils/storage');

const router = express.Router();

const ALLOWED = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };
const MAX_BYTES = 8 * 1024 * 1024;

function hasMagicBytes(ext, buf) {
  if (ext === '.png') {
    return buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
      buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a;
  }
  if (ext === '.jpg' || ext === '.jpeg') {
    return buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  }
  if (ext === '.webp') {
    return buf.length > 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP';
  }
  return false;
}

router.post('/', async (req, res) => {
  try {
    const { filename, data } = req.body || {};
    if (!filename || !data) {
      return fail(res, 400, 'UPLOAD_VALIDATION', 'filename and base64 data are required');
    }

    const ext = path.extname(String(filename)).toLowerCase();
    if (!ALLOWED[ext]) {
      return fail(res, 400, 'UPLOAD_INVALID_TYPE', 'Only PNG, JPG and WebP images are allowed');
    }

    let buffer;
    try {
      buffer = Buffer.from(String(data), 'base64');
    } catch {
      return fail(res, 400, 'UPLOAD_INVALID_DATA', 'Invalid base64 payload');
    }
    if (buffer.length === 0 || buffer.length > MAX_BYTES) {
      return fail(res, 400, 'UPLOAD_INVALID_DATA', 'Image is empty or exceeds 8MB');
    }
    if (!hasMagicBytes(ext, buffer)) {
      return fail(res, 400, 'UPLOAD_INVALID_IMAGE', 'File content does not match the image type');
    }

    const name = `${crypto.randomUUID()}${ext}`;
    const url = await storage.uploadObject(name, buffer, ALLOWED[ext]);

    ok(res, 201, { url });
  } catch (error) {
    logger.error(`Error handling upload: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  }
});

module.exports = router;