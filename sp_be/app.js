require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const requestLogger = require('./middleware/requestLogger');
const logger = require('./utils/logger');
const venuesRoute = require('./routes/venues');
const sportsRoute = require('./routes/sports');
const authRoute = require('./routes/auth');
const adminVenuesRoute = require('./routes/adminVenues');
const adminOverviewRoute = require('./routes/adminOverview');
const adminReportsRoute = require('./routes/adminReports');
const businessRoute = require('./routes/business');
const bookingsRoute = require('./routes/bookings');
const paymentsRoute = require('./routes/payments');
const adminPaymentsRoute = require('./routes/adminPayments');
const adminPlayersRoute = require('./routes/adminPlayers');
const adminConfigRoute = require('./routes/adminConfig');
const publicConfigRoute = require('./routes/publicConfig');
const notificationsRoute = require('./routes/notifications');
const eventsRoute = require('./routes/events');
const uploadsRoute = require('./routes/uploads');
const adminLeadsRoute = require('./routes/adminLeads');
const adminOwnersRoute = require('./routes/adminOwners');
const ownerOnboardingRoute = require('./routes/ownerOnboarding');
const publicLeadsRoute = require('./routes/publicLeads');
const publicWidgetRoute = require('./routes/publicWidget');
const publicQrRoute = require('./routes/publicQr');
const publicBillRoute = require('./routes/publicBill');
const publicSiteRoute = require('./routes/publicSite');
const adminSitesRoute = require('./routes/adminSites');
const siteAuthRoute = require('./routes/siteAuth');
const { requireRole } = require('./middleware/requireRole');
const { requireOnboarded } = require('./middleware/requireOnboarded');
const { authenticate } = require('./middleware/authenticate');
const { makeRateLimiter } = require('./middleware/rateLimit');

const app = express();

// Behind a proxy on Railway. Keeps the app-level rate limiter keyed per real
// client IP instead of the proxy's, and satisfies express-rate-limit's trust
// validation when X-Forwarded-For is present.
app.set('trust proxy', 1);

app.use(helmet());
// Uploads arrive as base64 bodies (up to ~10.7MB for an 8MB image); the
// default 100KB parser would 413 every realistic photo.
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// App-level burst limiter (per IP). Targeted limits live on the routers
// (checkout, cancel, webhook, uploads); see middleware/rateLimit.js.
app.use(makeRateLimiter({ windowMs: 60 * 1000, limit: 300 }));

// Fail closed: no wildcard fallback. Missing FRONTEND_URL is a boot error
// (see config/env.js) — tests set it in setupFiles. REST CORS admits the
// platform origin plus every live Dedicated Site hostname (DB-driven,
// ADR-0029), so owner domains are trusted without a redeploy.
const { corsOrigin } = require('./utils/origins');
const corsOptions = {
  origin: corsOrigin(process.env),
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization'],
  credentials: true
};
app.use(cors(corsOptions));

app.use(requestLogger);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

const adminWriteLimiter = makeRateLimiter({ windowMs: 60 * 1000, limit: 120 });
const uploadsLimiter = makeRateLimiter({ windowMs: 60 * 1000, limit: 30 });

app.use('/api/v1/venues', venuesRoute);
app.use('/api/v1/sports', sportsRoute);
app.use('/api/v1/auth', authRoute);
app.use('/api/v1/admin/venues', authenticate, requireRole('admin'), adminWriteLimiter, adminVenuesRoute);
app.use('/api/v1/business', authenticate, requireRole('venue_owner', 'admin'), requireOnboarded, businessRoute);
app.use('/api/v1/bookings', bookingsRoute);
app.use('/api/v1/payments', paymentsRoute);
app.use('/api/v1/admin/payments', authenticate, requireRole('admin'), adminWriteLimiter, adminPaymentsRoute);
app.use('/api/v1/admin', authenticate, requireRole('admin'), adminWriteLimiter, adminOverviewRoute);
app.use('/api/v1/admin/reports', authenticate, requireRole('admin'), adminWriteLimiter, adminReportsRoute);
app.use('/api/v1/admin/players', authenticate, requireRole('admin'), adminWriteLimiter, adminPlayersRoute);
app.use('/api/v1/admin/config', authenticate, requireRole('admin'), adminWriteLimiter, adminConfigRoute);
app.use('/api/v1/admin/leads', authenticate, requireRole('admin'), adminWriteLimiter, adminLeadsRoute);
app.use('/api/v1/admin/owners', authenticate, requireRole('admin'), adminWriteLimiter, adminOwnersRoute);
app.use('/api/v1/admin/sites', authenticate, requireRole('admin'), adminWriteLimiter, adminSitesRoute);
app.use('/api/v1/owner-onboarding', authenticate, requireRole('venue_owner', 'admin'), ownerOnboardingRoute);
app.use('/api/v1/public', publicConfigRoute);
app.use('/api/v1/public/leads', makeRateLimiter({ windowMs: 60 * 1000, limit: 10 }), publicLeadsRoute);
app.use('/api/v1/public/widget', publicWidgetRoute);
app.use('/api/v1/public/site', publicSiteRoute);
app.use('/api/v1/site-auth', siteAuthRoute);
app.use('/api/v1/public', publicQrRoute);
app.use('/api/v1/public', publicBillRoute);
app.use('/api/v1/notifications', authenticate, notificationsRoute);
app.use('/api/v1/events', eventsRoute);
app.use('/api/v1/uploads', authenticate, requireRole('venue_owner', 'admin'), uploadsLimiter, uploadsRoute);

app.use((err, req, res, next) => {
  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      success: false,
      error: { code: 'PAYLOAD_TOO_LARGE', message: 'Payload too large' }
    });
  }
  logger.error(`Error: ${err.message}`);
  logger.error(err.stack);

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Something went wrong'
    }
  });
});

module.exports = app;
