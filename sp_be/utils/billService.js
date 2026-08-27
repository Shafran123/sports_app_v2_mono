const pool = require('../db');
const logger = require('./logger');
const { fmtWhen, fmtLkr } = require('./format');
const { getBrandName } = require('./featureFlags');
const notificationCatalog = require('./notificationCatalog');

// Stateless Booking Bill: a PDF invoice generated on demand from DB rows
// (nothing is stored). Doubles as the check-in pass via the QR token.
// Walk-in bookings (player row IS the venue owner) are printable at the
// venue but never emailed — there is no customer inbox to send to.

// Business context rides along (brand-consolidation ticket 02) so bill emails
// can carry the Business's own branding. The player's email/phone resolve from
// either the platform user or the site customer, mirroring bookingLoader.
const BOOKING_BILL_SELECT = `
  select b.*, c.name as court_name, s.name as sport, v.name as venue_name,
         v.address as venue_address, v.city as venue_city, v.phone as venue_phone,
         biz.id as business_id, biz.name as business_name, biz.brand as business_brand,
         coalesce(u.email, sc.email) as user_email,
         coalesce(u.phone, sc.phone) as user_phone,
         v.owner_id as venue_owner_id
  from bookings b
  join courts c on c.id = b.court_id
  join venues v on v.id = c.venue_id
  join businesses biz on biz.id = v.business_id
  left join sports s on s.id = c.sport_id
  left join users u on u.id = b.user_id
  left join site_customers sc on sc.id = b.site_customer_id
  where b.id = $1`;

const REGISTRATION_BILL_SELECT = `
  select r.id, r.tax_rate, r.tax_amount, r.venue_tax_rate, r.venue_tax_amount, r.status, e.name as event_name,
         e.start_at as event_start, e.end_at as event_end, e.city as event_city,
         biz.id as business_id, biz.name as business_name, biz.brand as business_brand,
         u.name as player_name, u.email as player_email, u.phone as player_phone,
         (select p.amount from payments p where p.event_registration_id = r.id order by p.created_at desc limit 1) as amount
  from event_registrations r
  join events e on e.id = r.event_id
  left join venues v on v.id = e.venue_id
  left join businesses biz on biz.id = v.business_id
  join users u on u.id = r.user_id
  where r.id = $1`;

async function loadBookingForBill(bookingId) {
  const { rows } = await pool.query(BOOKING_BILL_SELECT, [bookingId]);
  return rows[0] || null;
}

async function loadRegistrationForBill(registrationId) {
  const { rows } = await pool.query(REGISTRATION_BILL_SELECT, [registrationId]);
  return rows[0] || null;
}

function pdfDoc() {
  const PDFDocument = require('pdfkit');
  return new PDFDocument({ size: 'A4', margin: 48 });
}

function collectPdf(doc) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });
}

function taxLines(rate, tax, venueRate, venueTax) {
  const lines = [];
  if (rate > 0) lines.push({ label: 'Platform tax', value: fmtLkr(tax) });
  else lines.push({ label: 'Platform tax', value: 'Not applicable' });
  if (venueRate > 0) lines.push({ label: 'Venue tax', value: fmtLkr(venueTax) });
  else lines.push({ label: 'Venue tax', value: 'Not applicable' });
  return lines;
}

function tableRow(doc, left, right, bold = false, width = null) {
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const rightColumnX = doc.page.margins.left + Math.max(180, pageWidth / 2);
  doc.font('Helvetica' + (bold ? '-Bold' : '')).fontSize(width);
  doc.text(left, doc.page.margins.left, doc.y, { width: rightColumnX - doc.page.margins.left - 12, align: 'left' });
  doc.text(right, rightColumnX, doc.y, { width: pageWidth - (rightColumnX - doc.page.margins.left), align: 'right' });
  doc.moveDown(0.4);
}

async function renderHeader(doc, title, id) {
  const brand = await getBrandName();
  doc.font('Helvetica-Bold').fontSize(20).text(`${brand}`, { align: 'center' });
  doc.font('Helvetica').fontSize(12).text(title, { align: 'center' });
  doc.moveDown(1);
  doc.font('Helvetica').fontSize(9).fillColor('#666').text(`ID: ${id}   •   Issued: ${new Date().toLocaleString('en-GB', { timeZone: 'Asia/Colombo' })}`, { align: 'center' });
  doc.fillColor('#000');
  doc.moveDown(1);
}

async function embedQr(doc, token) {
  if (!token) return;
  try {
    const QRCode = require('qrcode');
    const png = await QRCode.toBuffer(token, { width: 140, margin: 1 });
    const tableX = doc.page.margins.left + doc.page.width - doc.page.margins.right - 140;
    doc.image(png, tableX - 60, doc.y, { width: 140, height: 140 });
    doc.moveDown(140 / 72 + 1);
  } catch (err) {
    logger.error(`QR render failed: ${err.message}`);
  }
}

async function renderBookingPdf(booking) {
  const doc = pdfDoc();
  await renderHeader(doc, 'Booking Bill', booking.venue_name || '');

  doc.font('Helvetica').fontSize(11);
  doc.text(`Venue: ${booking.venue_name || ''}`);
  doc.text(`Court: ${booking.court_name || ''}${booking.sport ? ` (${booking.sport})` : ''}`);
  doc.text(`Address: ${booking.venue_address || ''}, ${booking.venue_city || ''}`);
  doc.text(`When: ${fmtWhen(booking.start_at)} — ${fmtWhen(booking.end_at)}`);
  doc.text(`Player: ${booking.player_name || ''}${booking.player_phone ? `  •  ${booking.player_phone}` : ''}`);
  doc.text(`Payment: ${booking.payment_method === 'cash' ? 'Pay at venue' : 'Paid online'}  •  Status: ${booking.status}`);

  doc.moveDown(1.5);

  // With offers (ADR-0026): Subtotal = sum of rule-priced slots, then the
  // offer discount, then the inclusive taxes carve out of the paid total.
  const discount = Number(booking.discount_amount || 0);
  const base = Number(booking.total_price || 0) - Number(booking.tax_amount || 0) - Number(booking.venue_tax_amount || 0);
  const subtotal = Number(booking.subtotal_amount || 0) || base + discount;
  tableRow(doc, 'Subtotal', fmtLkr(subtotal));
  if (discount > 0) {
    tableRow(doc, 'Offer discount', `− ${fmtLkr(discount)}`);
  }
  for (const line of taxLines(booking.tax_rate || 0, booking.tax_amount || 0, booking.venue_tax_rate || 0, booking.venue_tax_amount || 0)) {
    tableRow(doc, line.label, line.value);
  }
  tableRow(doc, 'Total', fmtLkr(booking.total_price), true);
  doc.moveDown(2);

  await embedQr(doc, booking.qr_token);
  doc.moveDown(1);
  doc.fontSize(9).fill('#999').text('Show the QR code at the venue to check in.', { align: 'center' });
  doc.fill('#000');

  return collectPdf(doc);
}

async function renderRegistrationPdf(reg) {
  const doc = pdfDoc();
  await renderHeader(doc, 'Event Registration Bill', reg.event_name || '');

  doc.font('Helvetica').fontSize(11);
  doc.text(`Event: ${reg.event_name || ''}`);
  doc.text(`When: ${fmtWhen(reg.event_start)}${reg.event_end ? ` — ${fmtWhen(reg.event_end)}` : ''}`);
  doc.text(`City: ${reg.event_city || ''}`);
  doc.text(`Player: ${reg.player_name || ''}${reg.player_phone ? `  •  ${reg.player_phone}` : ''}`);
  doc.text(`Status: ${reg.status}`);

  doc.moveDown(1.5);

  const amount = Number(reg.amount || 0);
  const base = amount - Number(reg.tax_amount || 0) - Number(reg.venue_tax_amount || 0);
  tableRow(doc, 'Base', fmtLkr(base));
  for (const line of taxLines(reg.tax_rate || 0, reg.tax_amount || 0, reg.venue_tax_rate || 0, reg.venue_tax_amount || 0)) {
    tableRow(doc, line.label, line.value);
  }
  tableRow(doc, 'Total', fmtLkr(amount), true);
  doc.moveDown(1);

  return collectPdf(doc);
}

// Returns a raw PDF buffer for a booking, or null when the booking is gone.
async function bookingBillPdf(bookingId, statusOverride) {
  const booking = await loadBookingForBill(bookingId);
  if (!booking) return null;
  if (statusOverride) booking.status = statusOverride;
  return renderBookingPdf(booking);
}

async function registrationBillPdf(registrationId, statusOverride) {
  const reg = await loadRegistrationForBill(registrationId);
  if (!reg) return null;
  if (statusOverride) reg.status = statusOverride;
  return renderRegistrationPdf(reg);
}

// Email the bill after a payment is confirmed. Fire-and-forget; walk-ins
// (booking whose player row IS the venue owner) are skipped — print-only.
async function emailBillForBooking(bookingId) {
  try {
    await notificationCatalog.dispatch('booking.bill', { bookingId }, { awaitTransports: true });
  } catch (error) {
    logger.error(`Failed to email bill for booking ${bookingId}: ${error.message}`);
  }
}

async function emailBillForRegistration(registrationId) {
  try {
    await notificationCatalog.dispatch('event.bill', { registrationId }, { awaitTransports: true });
  } catch (error) {
    logger.error(`Bill email failed for registration ${registrationId}: ${error.message}`);
  }
}

module.exports = {
  loadBookingForBill,
  loadRegistrationForBill,
  bookingBillPdf,
  registrationBillPdf,
  emailBillForBooking,
  emailBillForRegistration
};