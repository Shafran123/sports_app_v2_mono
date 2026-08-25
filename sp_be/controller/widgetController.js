// Public Booking Widget endpoints (ADR-0028). The widget lives in an iframe on
// a business's own website; these endpoints power the embed config fetch and
// the public QR delivery path.
//
// Scope (ADR-0028 amendment v1.5): the embed key now resolves a Widget
// Instance of a Business, not a venue. The config returns the business brand,
// the instance's defaults (default venue + venue-choice toggle), and the
// eligible venues (all approved venues of the business, Private included).
// The allowlist is per instance; origin enforcement is unchanged.
//
// Identity (cutover): the widget signs the buyer in with the app's standard
// email/Google Player auth — there is no widget-specific OTP identity here.
// The Verified Phone challenge lives in the authenticated /auth/verify-phone
// endpoints; this controller only serves config.

const { ok, fail } = require('../utils/response');
const logger = require('../utils/logger');
const { isHostAllowed } = require('../utils/widget');
const { instanceByEmbedKey, effectiveScope } = require('../services/widgetInstances');
const { eligibleVenueRows } = require('../services/businesses');
const { buildVenueDetail } = require('../services/venuePayload');

// Public config for the embed page: business + instance defaults + every
// eligible venue (with its courts, hours, brand-less public fields). The
// origin allowlist is per instance. Effective scope degrades server-side:
// a default venue that is no longer eligible reads as no-preselect and free
// choice, so a stale default never dead-ends the embed.
exports.getWidgetConfig = async (req, res) => {
  try {
    const { key } = req.params;
    const instance = await instanceByEmbedKey(key);
    if (!instance) {
      return fail(res, 404, 'WIDGET_NOT_FOUND', 'This booking widget is not available');
    }

    const origin = String(req.query.origin || '').trim();
    if (origin && !isHostAllowed(instance, origin)) {
      return fail(res, 403, 'WIDGET_DOMAIN_NOT_ALLOWED', 'This widget is not authorized on this website');
    }

    const eligible = await eligibleVenueRows(instance.business_id);
    const scope = effectiveScope(instance, eligible.map((v) => v.id));
    const venues = (await Promise.all(eligible.map((v) => buildVenueDetail(v)))).map(
      // The business id is noise inside each venue when the response already
      // carries it at the top level; strip it per venue.
      ({ business_id, ...venue }) => venue
    );

    ok(res, 200, {
      business: {
        id: instance.business_id,
        name: instance.business_name,
        brand: instance.business_brand || {}
      },
      instance: {
        id: instance.id,
        name: instance.name,
        default_venue_id: scope.default_venue_id,
        allow_venue_choice: scope.allow_venue_choice
      },
      venues
    });
  } catch (error) {
    logger.error(`Error fetching widget config: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  }
};

