require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const emailService = require('../utils/emailService');

const recipient = process.env.ADMIN_EMAIL || 'devshaf@proton.me';

(async () => {
  const html = `<p>Smoke test ${new Date().toISOString()} — from no-reply@myslot.lk via Mailgun domain ${process.env.MAILGUN_DOMAIN}.</p>`;
  const result = await emailService.sendEmail({
    to: recipient,
    subject: `[smoke] MySlot.LK wiring ${Date.now()}`,
    html
  });
  console.log(JSON.stringify({ send: result }));
  if (!result.success) process.exit(1);

  if (process.env.SMOKE_SKIP_EVENTS !== '1') {
    let hits = [];
    for (let attempt = 0; attempt < 5; attempt++) {
      const url = `https://api.mailgun.net/v3/${process.env.MAILGUN_DOMAIN}/events?limit=25`;
      const res = await fetch(url, {
        headers: { Authorization: `Basic ${Buffer.from(`api:${process.env.MAILGUN_API_KEY}`).toString('base64')}` }
      });
      const body = await res.json();
      const items = body.items || [];
      hits = items.filter((e) => e.recipient === recipient && e.event === 'delivered');
      console.log(JSON.stringify({ attempt, events_status: res.status, item_count: items.length, found: hits.length }));
      if (hits.length > 0) break;
      await new Promise((r) => setTimeout(r, 3000));
    }
    const onTarget = hits.some((e) => String(e.message?.headers?.['message-id'] || '').includes('@myslot.lk'));
    console.log(JSON.stringify({ from_env: process.env.FROM_EMAIL, domain: process.env.MAILGUN_DOMAIN, seen: hits.map((e) => ({ event: e.event, id: e.message?.headers?.['message-id'], from: e.message?.headers?.from })) }));
    if (hits.length === 0 || !onTarget) process.exit(1);
  }
})().catch((err) => {
  console.log(JSON.stringify({ fatal: err.message }));
  process.exit(1);
});