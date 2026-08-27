// Public bill download (ADR-0041). A walk-in customer has no inbox and no app,
// so their bill reaches them by SMS as a tokenized download link. The URL holds
// the secret QR token — a bearer credential — so the PDF is only ever
// reachable by the phone number that received the SMS; unknown booking ids or
// mismatched tokens read as not found.

const express = require('express');
const pool = require('../db');
const { fail } = require('../utils/response');
const billService = require('../utils/billService');

const router = express.Router();

router.get('/bill/:bookingId', async (req, res) => {
  try {
    const { bookingId } = req.params;
    const token = String(req.query.t || '').trim();
    if (!/^[0-9a-f]{32}$/.test(token) || !/^[0-9a-f-]{36}$/.test(bookingId)) {
      return fail(res, 404, 'BILL_NOT_FOUND', 'Bill not found');
    }

    const { rows } = await pool.query(
      `select qr_token from bookings where id = $1`,
      [bookingId]
    );
    if (rows.length === 0 || !rows[0].qr_token) {
      return fail(res, 404, 'BILL_NOT_FOUND', 'Bill not found');
    }

    // Timing-safe compare: the token is a secret; the URL is its disclosure.
    const a = Buffer.from(rows[0].qr_token, 'hex');
    const b = Buffer.from(token, 'hex');
    const match = a.length === b.length && require('node:crypto').timingSafeEqual(a, b);

    if (!match) {
      return fail(res, 404, 'BILL_NOT_FOUND', 'Bill not found');
    }

    const pdf = await billService.bookingBillPdf(bookingId);
    if (!pdf) {
      return fail(res, 404, 'BILL_NOT_FOUND', 'Bill not found');
    }
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="spots-bill-${bookingId.slice(0, 8)}.pdf"`,
      'Cache-Control': 'private, no-store'
    });
    res.send(pdf);
  } catch (error) {
    fail(res, 404, 'BILL_NOT_FOUND', 'Bill not found');
  }
});

module.exports = router;
