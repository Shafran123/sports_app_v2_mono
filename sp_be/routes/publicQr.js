// Public QR image delivery (ADR-0028). A widget player may never open the
// player app, so the booking confirmation SMS carries a link to the check-in
// QR. The URL holds the secret QR Token — a bearer credential — so the image
// is only ever reachable by the player who received the SMS; unknown booking
// ids or mismatched tokens read as not found.

const express = require('express');
const pool = require('../db');
const { fail } = require('../utils/response');
const emailTemplates = require('../utils/emailTemplates');

const router = express.Router();

router.get('/qr/:bookingId', async (req, res) => {
  try {
    const { bookingId } = req.params;
    const token = String(req.query.t || '').trim();
    if (!/^[0-9a-f]{32}$/.test(token) || !/^[0-9a-f-]{36}$/.test(bookingId)) {
      return fail(res, 404, 'QR_NOT_FOUND', 'QR not found');
    }

    const { rows } = await pool.query(
      `select qr_token from bookings where id = $1`,
      [bookingId]
    );
    if (rows.length === 0 || !rows[0].qr_token) {
      return fail(res, 404, 'QR_NOT_FOUND', 'QR not found');
    }

    // Timing-safe compare: the token is a secret; the URL is its disclosure.
    const a = Buffer.from(rows[0].qr_token, 'hex');
    const b = Buffer.from(token, 'hex');
    const match = a.length === b.length && require('node:crypto').timingSafeEqual(a, b);

    if (!match) {
      return fail(res, 404, 'QR_NOT_FOUND', 'QR not found');
    }

    const png = await emailTemplates.qrPng(rows[0].qr_token);
    res.set({ 'Content-Type': 'image/png', 'Cache-Control': 'private, no-store' });
    res.send(png);
  } catch (error) {
    fail(res, 404, 'QR_NOT_FOUND', 'QR not found');
  }
});

module.exports = router;