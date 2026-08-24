const pool = require('../db');
const notificationCatalog = require('../utils/notificationCatalog');
const logger = require('../utils/logger');

const INTERVAL_MINUTES = 60;
const WINDOW_HOURS = 24;

// Scans for confirmed bookings starting roughly a day out and emails a
// reminder. Marking reminder_sent_at on success keeps the job idempotent.
async function runReminderJob() {
  try {
    const { rows } = await pool.query(
      `select b.*, c.name as court_name, v.name as venue_name,
              v.address as venue_address, v.city as venue_city, v.phone as venue_phone,
              u.email as user_email
       from bookings b
       join courts c on c.id = b.court_id
       join venues v on v.id = c.venue_id
       left join users u on u.id = b.user_id
       where b.status = 'confirmed'
         and b.start_at > now() + interval '22 hours'
         and b.start_at < now() + interval '26 hours'
         and b.reminder_sent_at is null
       limit 50`
    );

    for (const booking of rows) {
      if (!booking.user_email) continue;
      const results = await notificationCatalog.dispatch('booking.reminder', { booking }, { awaitTransports: true });
      const emailOk = results.some((r) => r.channel === 'email' && r.status === 'sent');
      if (!emailOk) continue;
      await pool.query(`update bookings set reminder_sent_at = now() where id = $1`, [booking.id]).catch(() => {});
    }
  } catch (error) {
    logger.error(`Reminder job error: ${error.message}`);
  }
}

function startReminderJob() {
  setInterval(runReminderJob, INTERVAL_MINUTES * 60 * 1000);
  runReminderJob();
}

module.exports = { startReminderJob, runReminderJob };