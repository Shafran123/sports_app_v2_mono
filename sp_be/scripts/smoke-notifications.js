require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const emailService = require('../utils/emailService');
const smsService = require('../utils/smsService');

const emailRecipient = process.env.SMOKE_EMAIL_TO || process.env.ADMIN_EMAIL || 'devshaf@proton.me';
const smsRecipient = process.env.SMOKE_SMS_TO;

(async () => {
  const email = await emailService.sendEmail({
    to: emailRecipient,
    subject: `[smoke] MySlot.LK wiring ${Date.now()}`,
    html: `<p>Smoke test ${new Date().toISOString()} — from no-reply@myslot.lk via Mailgun domain ${process.env.MAILGUN_DOMAIN}.</p>`
  });
  console.log(JSON.stringify({ email: email }));

  if (smsRecipient) {
    const sms = await smsService.sendSms({
      to: smsRecipient,
      message: `MySlot.LK smoke test ${new Date().toISOString()}`
    });
    console.log(JSON.stringify({ sms: sms }));
    if (!email.success || !sms.success) process.exit(1);
  } else if (!email.success) {
    process.exit(1);
  }
})().catch((err) => {
  console.log(JSON.stringify({ fatal: err.message }));
  process.exit(1);
});