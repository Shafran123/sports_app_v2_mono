require('dotenv').config();

const { validate } = require('./config/env');
validate();

const app = require('./app');
const logger = require('./utils/logger');
const { realtime } = require('./realtime');
const { startReminderJob } = require('./jobs/reminders');
const { startDigestJob } = require('./jobs/dailyDigest');

const http = require('http');

const port = process.env.PORT || 2400;

const server = http.createServer(app);
realtime.attach(server);
startReminderJob();
startDigestJob();

function warnMissingConfig() {
  if (!process.env.MAILGUN_API_KEY || !process.env.MAILGUN_DOMAIN) {
    logger.warn('MAILGUN_API_KEY / MAILGUN_DOMAIN not set — transactional emails (signup, booking confirmation, reminders, venue approval) will be SKIPPED.');
  }
  if (!process.env.SMSGO_API_KEY) {
    logger.warn('SMSGO_API_KEY not set — booking confirmation / admin-cancellation SMS will be SKIPPED.');
  }
}
warnMissingConfig();

server.listen(port, function () {
  logger.info(`Server started and listening on port ${port}`);
  console.log(`Sports Arena BE listening on port ${port}!`);
});
