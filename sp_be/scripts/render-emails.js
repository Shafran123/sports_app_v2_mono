// Render every transactional email to .scratch/emails-preview/*.html so they
// can be eyeballed in a real mail client. Not a test — a design review tool.
// Usage: node sp_be/scripts/render-emails.js
const fs = require('fs');
const path = require('path');
const emailTemplates = require('../utils/emailTemplates');

const OUT = path.join(__dirname, '..', '..', '.scratch', 'emails-preview');
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

const booking = {
  id: '11111111-1111-1111-1111-111111111111',
  user_id: 'demo-player-uid',
  user_email: 'player@mySlot.lk',
  player_name: 'Kasun Perera',
  player_phone: '0771234567',
  venue_name: 'Smash Arena',
  court_name: 'Court 1',
  venue_address: '45 Galle Road, Colombo 03',
  venue_city: 'Colombo',
  venue_phone: '0112223344',
  start_at: '2026-09-01T04:30:00.000Z',
  end_at: '2026-09-01T05:30:00.000Z',
  total_price: 1500,
  tax_amount: 0,
  venue_tax_amount: 0,
  payment_method: 'cash',
  status: 'confirmed'
};

const reg = {
  id: '22222222-2222-2222-2222-222222222222',
  event_id: 'bbbbbbbb-0000-0000-0000-000000000001',
  event_name: 'Friday Night Badminton Social',
  event_start: '2026-09-01T04:30:00.000Z',
  event_end: '2026-09-01T07:30:00.000Z',
  venue_name: 'Smash Arena',
  player_name: 'Kasun Perera',
  player_email: 'player@mySlot.lk',
  player_phone: '0771234567',
  amount: 1500,
  status: 'paid'
};

const event = { id: reg.event_id, name: reg.event_name, start_at: reg.event_start };
const venue = { name: 'Smash Arena' };
const owner = { name: 'Nimal Silva', email: 'owner@mySlot.lk' };
const plan = { name: '6 months free', price_lkr: 0, start_date: '2026-09-01', end_date: '2027-03-01' };
const bankDetails = { bank: 'Commercial Bank', account_name: 'MySlot Pte', account_number: '12345678', branch: 'Colombo 03' };
const lead = { name: 'Kasun Perera', email: 'kasun@example.com', venue_name: 'Kasun Courts' };

const brand = process.env.BRAND || 'MySlot.LK';

async function renderAll() {
  fs.mkdirSync(OUT, { recursive: true });
  const index = [];
  const save = async (slug, builder, args) => {
    const built = await builder(...args);
    const qrOpts = built.attachment ? { qr: { cid: 'booking-qr.png' } } : {};
    let html = built.html;
    let files = [];
    if (built.attachment?.inline) {
      files.push({ filename: 'booking-qr.png', content: await emailTemplates.qrPng(booking.id) });
      html = html.replace(/cid:booking-qr\.png/g, `data:image/png;base64,${files[0].content.toString('base64')}`);
    }
    const file = path.join(OUT, `${slug}.html`);
    fs.writeFileSync(file, html);
    index.push(`<li><a href="${slug}.html">${slug.replace(/-/g, ' ')}</a></li>`);
  };

  await save('booking-confirmed', emailTemplates.buildBookingHtml, [booking, brand, qrOptsArg()]);
  await save('booking-reminder', emailTemplates.buildReminderHtml, [booking, brand, qrOptsArg()]);
  await save('booking-bill', emailTemplates.buildBillHtml, [booking, brand, qrOptsArg()]);
  await save('booking-cancelled-player', emailTemplates.buildPlayerCancelledHtml, [booking, { refund_amount: 1500 }, brand]);
  await save('booking-cancelled-owner', emailTemplates.buildOwnerBookingCancelledHtml, [booking, brand]);
  await save('booking-cancelled-venue', emailTemplates.buildVenueCancelledHtml, [booking, brand]);
  await save('owner-new-booking', emailTemplates.buildOwnerBookingHtml, [booking, brand]);
  await save('owner-welcome', emailTemplates.buildOwnerWelcomeHtml, [owner, 'temp-pass-123', plan, bankDetails, brand]);
  await save('owner-renewal', emailTemplates.buildOwnerRenewalHtml, [owner, plan, bankDetails, brand]);
  await save('owner-nudge', emailTemplates.buildOwnerNudgeHtml, [owner, plan, bankDetails, brand]);
  await save('venue-approved', emailTemplates.buildVenueApprovedHtml, [venue, brand]);
  await save('venue-rejected', emailTemplates.buildVenueRejectedHtml, [venue, 'Address could not be verified', brand]);
  await save('event-registered', emailTemplates.buildEventRegisteredHtml, [reg, brand]);
  await save('event-cancelled', emailTemplates.buildEventCancelledHtml, [reg, brand]);
  await save('event-cancelled-owner', emailTemplates.buildEventCancelledOwnerHtml, [event, brand]);
  await save('welcome', emailTemplates.buildWelcomeHtml, [brand]);

  fs.writeFileSync(path.join(OUT, 'index.html'), `<html><body><h1>MySlot email previews</h1><ul>${index.join('\n')}</ul></body></html>`);
  console.log(`Wrote ${index.length} previews to ${OUT}`);
}

function qrOptsArg() {
  return { qr: { cid: 'booking-qr.png' } };
}

renderAll().catch((err) => {
  console.error(err);
  process.exit(1);
});