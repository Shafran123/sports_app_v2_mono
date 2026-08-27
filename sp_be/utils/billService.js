const pool = require('../db');
const logger = require('./logger');
const { fmtWhen, fmtLkr } = require('./format');
const { getBrandName } = require('./featureFlags');
const notificationCatalog = require('./notificationCatalog');

// Booking Invoice (ADR-0041): a computer-generated invoice PDF generated on
// demand from DB rows (nothing but the invoice number is stored). Each bill
// carries a per-Business sequential Invoice Number, allocated once at first
// emission and never renumbered. The check-in QR is NOT part of the bill —
// confirmation/reminder emails carry it. Walk-in bookings (player row IS the
// venue owner) are printable at the venue and their phone gets a tokenized
// bill link by SMS — never emailed (no customer inbox).

// Business context rides along (brand-consolidation ticket 02) so bill emails
// carry the Business's own branding. The player's email/phone resolve from
// either the platform user or the site customer, mirroring bookingLoader.
const BOOKING_BILL_SELECT = `
  select b.*, c.name as court_name, c.slot_duration_min, s.name as sport, v.name as venue_name,
         v.address as venue_address, v.city as venue_city, v.phone as venue_phone,
         biz.id as business_id, biz.name as business_name, biz.brand as business_brand,
         (select p.status from payments p where p.booking_id = b.id order by p.created_at desc limit 1) as payment_status,
         (select p.paid_at from payments p where p.booking_id = b.id and p.status = 'paid' order by p.paid_at desc nulls last limit 1) as paid_at,
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

// ---- Invoice numbering (ADR-0041) ----

// Allocate the per-Business sequential invoice number for a booking on first
// emission. A per-business advisory lock (held to the end of the transaction)
// serializes allocators within a Business, so max+1 is a safe next number; the
// guarded update keeps the same-booking claim idempotent. Never renumbers.
async function allocateInvoiceNumber(bookingId) {
  const client = await pool.connect();
  try {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await client.query('begin');
      const { rows } = await client.query(
        `select b.id, b.invoice_number, v.business_id
         from bookings b
         join courts c on c.id = b.court_id
         join venues v on v.id = c.venue_id
         where b.id = $1
         for update of b`,
        [bookingId]
      );
      const booking = rows[0];
      if (!booking || !booking.business_id) {
        await client.query('rollback');
        return null;
      }
      if (booking.invoice_number) {
        await client.query('commit');
        return booking.invoice_number;
      }
      // Serialize per Business: only one allocator in a Business at a time.
      await client.query(
        `select pg_advisory_xact_lock(hashtextextended($1, 0))`,
        [`booking-invoice:${booking.business_id}`]
      );
      const { rows: nextRows } = await client.query(
        `select coalesce(max(b2.invoice_number), 0) + 1 as next_no
         from bookings b2
         join courts c2 on c2.id = b2.court_id
         join venues v2 on v2.id = c2.venue_id
         where v2.business_id = $1 and b2.invoice_number is not null`,
        [booking.business_id]
      );
      const next = nextRows[0].next_no;
      const { rowCount } = await client.query(
        `update bookings set invoice_number = $2
         where id = $1 and invoice_number is null`,
        [bookingId, next]
      );
      await client.query('commit');
      if (rowCount === 1) return next;
      // Claim lost to a concurrent allocator — retry with a fresh read.
    }
    logger.error(`Invoice number allocation failed after retries for ${bookingId}`);
    return null;
  } catch (err) {
    await client.query('rollback').catch(() => {});
    logger.error(`Invoice number allocation error for ${bookingId}: ${err.message}`);
    return null;
  } finally {
    client.release();
  }
}

async function ensureInvoiceNumber(bookingId) {
  try {
    return await allocateInvoiceNumber(bookingId);
  } catch (err) {
    logger.error(`Invoice number allocation error for ${bookingId}: ${err.message}`);
    return null;
  }
}

// ---- Logo / brand assets ----

// Fetch a business logo (an absolute URL) to embed in the PDF. Falls back to
// null so the header renders the business name in its primary color instead.
async function fetchLogo(url) {
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0 || buf.length > 2 * 1024 * 1024) return null;
    return buf;
  } catch (err) {
    logger.warn(`Invoice logo fetch failed: ${err.message}`);
    return null;
  }
}

// Business brand tokens for the invoice header (falls back to the platform).
function pdfHeaderOptions(booking) {
  if (!booking?.business_name) return {};
  const brand = booking.business_brand || {};
  return {
    brandName: booking.business_name,
    primary: brand.colors?.primary || '#000',
    logoUrl: brand.logo_url || ''
  };
}

// Business contact block (ADR-0031) for the "From" section; venue fields are
// the fallback when the owner set no brand contact.
function contactLines(booking) {
  const brand = booking?.business_brand || {};
  const contact = brand.contact || {};
  const out = [];
  const push = (v) => { if (v) out.push(String(v)); };
  push(booking?.business_name);
  push(contact.address || [booking.venue_address, booking.venue_city].filter(Boolean).join(', '));
  push(contact.phone || booking.venue_phone);
  push(contact.email);
  push(contact.hours);
  return out;
}

// ---- Bordered money table ----

function moneyTable(doc, rows, opts = {}) {
  const { margin, width, amountX, primary } = opts;
  const labelWidth = amountX - margin - 16;
  const startY = doc.y + 6;
  let y = startY;

  const drawLine = (yy) => {
    doc.moveTo(margin, yy).lineTo(margin + width, yy).lineWidth(0.75).strokeColor('#d8d6cf').stroke();
    doc.strokeColor('#000');
  };

  // Header band.
  doc.rect(margin, y, width, 22).fillColor(primary || '#111').fill();
  doc.fillColor('#fff').font('Helvetica-Bold').fontSize(9);
  doc.text('Item', margin + 8, y + 7, { width: labelWidth, align: 'left' });
  doc.text('Amount', amountX, y + 7, { width: margin + width - amountX, align: 'right' });
  doc.fillColor('#000');
  y += 22;
  drawLine(y);

  for (const row of rows) {
    const label = String(row.label);
    const value = String(row.value);
    const rowHeight = Math.max(
      18,
      doc.font('Helvetica').fontSize(9.5).heightOfString(label, { width: labelWidth }) + 8
    );
    const font = row.bold ? 'Helvetica-Bold' : 'Helvetica';
    doc.font(font).fontSize(9.5);
    doc.text(label, margin + 8, y + 4, { width: labelWidth, align: 'left' });
    doc.text(value, amountX, y + 4, { width: margin + width - amountX, align: 'right' });
    y += rowHeight;
    drawLine(y);
  }

  // Outer border.
  doc.rect(margin, startY, width, y - startY).lineWidth(1).strokeColor('#d8d6cf').stroke();
  doc.strokeColor('#000');
  doc.moveDown(0.6);
}

// ---- PDF rendering ----

// Invoice header: business logo (or name in primary color), name, title,
// invoice number + issued date.
async function renderInvoiceHeader(doc, booking, opts = {}) {
  const { brandName, primary } = opts;
  const name = brandName || (await getBrandName());
  const logo = await fetchLogo(opts.logoUrl);

  if (logo) {
    const maxW = 120;
    const maxH = 36;
    doc.image(logo, doc.page.margins.left, doc.y, { fit: [maxW, maxH], align: 'left' });
    doc.moveDown(2.2);
  } else {
    doc.font('Helvetica-Bold').fontSize(20).fillColor(primary || '#000').text(`${name}`, { align: 'left' });
    doc.moveDown(0.6);
  }
  doc.fillColor('#000');
  doc.font('Helvetica').fontSize(12).text('Invoice', { align: 'left' });
  doc.moveDown(0.4);
  const invoiceNo = booking.invoice_number ? `INV-${String(booking.invoice_number).padStart(4, '0')}` : '—';
  doc.font('Helvetica').fontSize(9).fillColor('#666').text(
    `Invoice No: ${invoiceNo}   •   Booking ID: ${booking.id}   •   Issued: ${new Date().toLocaleString('en-GB', { timeZone: 'Asia/Colombo' })}`,
    { align: 'left' }
  );
  doc.fillColor('#000');
  doc.moveDown(1);
}

// Simple shared header for the (unchanged) event registration bill.
async function renderHeader(doc, title, id, opts = {}) {
  const { brandName, primary } = opts;
  const name = brandName || (await getBrandName());
  doc.font('Helvetica-Bold').fontSize(20).fillColor(primary || '#000').text(`${name}`, { align: 'center' });
  doc.fillColor('#000');
  doc.font('Helvetica').fontSize(12).text(title, { align: 'center' });
  doc.moveDown(1);
  doc.font('Helvetica').fontSize(9).fillColor('#666').text(`ID: ${id}   •   Issued: ${new Date().toLocaleString('en-GB', { timeZone: 'Asia/Colombo' })}`, { align: 'center' });
  doc.fillColor('#000');
  doc.moveDown(1);
}

function taxLines(rate, tax, venueRate, venueTax) {
  const lines = [];
  if (rate > 0) lines.push({ label: `Platform tax (${rate}%)`, value: fmtLkr(tax) });
  else lines.push({ label: 'Platform tax', value: 'Not applicable' });
  if (venueRate > 0) lines.push({ label: `Venue tax (${venueRate}%)`, value: fmtLkr(venueTax) });
  else lines.push({ label: 'Venue tax', value: 'Not applicable' });
  return lines;
}

// Per-slot item lines when the court price is uniform over the booking
// (Q8): slotCount = duration / slot_duration_min; a single item line otherwise.
function bookingSubtotal(booking) {
  const base = Number(booking.total_price || 0) - Number(booking.tax_amount || 0) - Number(booking.venue_tax_amount || 0);
  const discount = Number(booking.discount_amount || 0);
  return Number(booking.subtotal_amount || 0) || base + discount;
}

function itemRows(booking) {
  const subtotal = bookingSubtotal(booking);
  const start = new Date(booking.start_at);
  const end = new Date(booking.end_at);
  const durationMin = (end.getTime() - start.getTime()) / 60000;
  const slotDur = Number(booking.slot_duration_min || 0);
  const count = slotDur > 0 && durationMin > 0 ? Math.round(durationMin / slotDur) : 0;
  const unit = count > 0 ? subtotal / count : 0;
  const uniform = count > 0 && count <= 12 && Math.abs(unit * count - subtotal) <= 1;

  const courtLabel = [booking.court_name, booking.sport ? `(${booking.sport})` : ''].filter(Boolean).join(' ');

  if (!uniform) {
    return [{ label: `${courtLabel} — ${fmtWhen(booking.start_at)}${booking.end_at ? ` – ${fmtWhen(booking.end_at)}` : ''}`, value: fmtLkr(subtotal) }];
  }

  const rows = [];
  for (let i = 0; i < count; i += 1) {
    const s = new Date(start.getTime() + i * slotDur * 60000);
    const e = new Date(s.getTime() + slotDur * 60000);
    rows.push({ label: `${i === 0 ? `${courtLabel} — ` : ''}${fmtWhen(s.toISOString())}${e ? ` – ${fmtWhen(e.toISOString())}` : ''}`, value: fmtLkr(unit) });
  }
  return rows;
}

async function renderBookingPdf(booking) {
  const doc = pdfDoc();
  await renderInvoiceHeader(doc, booking, pdfHeaderOptions(booking));

  // From / Bill-to block.
  const from = contactLines(booking);
  doc.font('Helvetica').fontSize(10);
  doc.text(from.length ? from.join('\n') : booking.business_name || '', { lineGap: 2 });
  doc.moveDown(0.8);

  doc.font('Helvetica').fontSize(10);
  doc.text(`Venue: ${booking.venue_name || ''}${booking.venue_city ? `, ${booking.venue_city}` : ''}`);
  doc.text(`Court: ${booking.court_name || ''}${booking.sport ? ` (${booking.sport})` : ''}`);
  doc.text(`When: ${fmtWhen(booking.start_at)}${booking.end_at ? ` — ${fmtWhen(booking.end_at)}` : ''}`);
  doc.text(`Player: ${booking.player_name || ''}${booking.player_phone ? `  •  ${booking.player_phone}` : ''}`);
  const paymentLabel = booking.payment_method === 'cash'
    ? (booking.payment_status === 'paid' || booking.paid_at ? 'Cash — Paid' : 'Cash — Due')
    : 'Paid online';
  doc.text(`Payment: ${paymentLabel}  •  Status: ${booking.status}`);
  if (booking.payment_method === 'cash' && booking.paid_at) {
    doc.text(`Paid: ${fmtWhen(booking.paid_at)}`);
  }

  doc.moveDown(1.2);

  // Money table.
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const amountX = doc.page.margins.left + Math.max(180, pageWidth / 2);
  const rows = itemRows(booking);
  const discount = Number(booking.discount_amount || 0);
  const tableRows = [...rows];
  tableRows.push({ label: 'Subtotal', value: fmtLkr(bookingSubtotal(booking)) });
  if (discount > 0) {
    tableRows.push({ label: 'Offer discount', value: `− ${fmtLkr(discount)}` });
  }
  for (const line of taxLines(booking.tax_rate || 0, booking.tax_amount || 0, booking.venue_tax_rate || 0, booking.venue_tax_amount || 0)) {
    tableRows.push(line);
  }
  tableRows.push({ label: 'Total', value: fmtLkr(booking.total_price), bold: true });

  moneyTable(doc, tableRows, {
    margin: doc.page.margins.left,
    width: pageWidth,
    amountX,
    primary: pdfHeaderOptions(booking).primary
  });

  doc.moveDown(0.5);
  doc.fontSize(8.5).fill('#999').text('Thank you for playing.', { align: 'left' });
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
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const amountX = doc.page.margins.left + Math.max(180, pageWidth / 2);
  const tableRows = [
    { label: 'Base', value: fmtLkr(base) },
    ...taxLines(reg.tax_rate || 0, reg.tax_amount || 0, reg.venue_tax_rate || 0, reg.venue_tax_amount || 0),
    { label: 'Total', value: fmtLkr(amount), bold: true }
  ];
  moneyTable(doc, tableRows, {
    margin: doc.page.margins.left,
    width: pageWidth,
    amountX,
    primary: '#000'
  });
  doc.moveDown(1);

  return collectPdf(doc);
}

// Returns a raw PDF buffer for a booking, or null when the booking is gone.
// The invoice number is allocated on first render (first emission).
async function bookingBillPdf(bookingId, statusOverride) {
  const booking = await loadBookingForBill(bookingId);
  if (!booking) return null;
  await ensureInvoiceNumber(bookingId);
  if (statusOverride) booking.status = statusOverride;
  const allocated = await loadBookingForBill(bookingId);
  return renderBookingPdf(allocated || booking);
}

async function registrationBillPdf(registrationId, statusOverride) {
  const reg = await loadRegistrationForBill(registrationId);
  if (!reg) return null;
  if (statusOverride) reg.status = statusOverride;
  return renderRegistrationPdf(reg);
}

// Email the bill after a payment is confirmed. Fire-and-forget; walk-ins
// (booking whose player row IS the venue owner) are skipped — print-only,
// their bill link goes out by SMS at quick-book.
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
  emailBillForRegistration,
  ensureInvoiceNumber,
  allocateInvoiceNumber
};
