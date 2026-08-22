const pool = require('../db');
const logger = require('../utils/logger');
const emailService = require('../utils/emailService');

async function notifyUser(userId, type, title, body, { email = false } = {}) {
  await pool.query(
    `insert into notifications (user_id, type, title, body) values ($1, $2, $3, $4)`,
    [userId, type, title, body]
  );

  if (email) {
    const { rows } = await pool.query(`select email from users where id = $1`, [userId]);
    if (rows[0]?.email) {
      emailService.sendEmail({ to: rows[0].email, subject: title, html: `<p>${body}</p>` }).catch((err) => {
        logger.error(`Failed to send notification email: ${err.message}`);
      });
    }
  }

  if (process.env.FCM_ENABLED === '1') {
    try {
      const admin = require('firebase-admin');
      const { rows } = await pool.query(
        `select fcm_token from users where id = $1`,
        [userId]
      );
      if (rows[0]?.fcm_token) {
        await admin.messaging().send({
          token: rows[0].fcm_token,
          notification: { title, body }
        });
      }
    } catch (err) {
      logger.error(`Failed to send push notification: ${err.message}`);
    }
  }
}

module.exports = { notifyUser };
