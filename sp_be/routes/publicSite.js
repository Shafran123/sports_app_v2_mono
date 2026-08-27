// Public Dedicated Site resolution (ADR-0029): the user app asks "is THIS
// hostname a live Dedicated Site?" and gets back the Business brand + every
// approved venue to render the site chrome and the portfolio root. Unauthenticated
// by design (the site serves anonymous visitors, same as the widget config).

const express = require('express');
const { ok, fail } = require('../utils/response');
const logger = require('../utils/logger');
const pool = require('../db');
const siteDomains = require('../services/siteDomains');

const router = express.Router();

// Approved venues of the Business with their sport names inlined (the venues
// table carries no sports column; they live in venue_sports).
async function siteVenues(businessId) {
  const { rows } = await pool.query(
    `select v.id, v.name, v.slug, v.city, v.address, v.photos, v.visibility, v.lat, v.lng,
            coalesce(court_stats.min_price, null) as min_price,
            coalesce((
              select jsonb_agg(jsonb_build_object('day_of_week', h.day_of_week, 'open_time', h.open_time, 'close_time', h.close_time) order by h.day_of_week, h.open_time)
              from venue_hours h where h.venue_id = v.id
            ), '[]'::jsonb) as hours,
coalesce((
              select jsonb_agg(jsonb_build_object('name', s.name, 'icon', s.icon) order by vs.sport_id)
              from venue_sports vs join sports s on s.id = vs.sport_id
              where vs.venue_id = v.id
            ), '[]'::jsonb) as sports
     from venues v
     left join (
       select venue_id, min(price_per_slot) as min_price
       from courts where is_active
       group by venue_id
     ) court_stats on court_stats.venue_id = v.id
     where v.business_id = $1 and v.status = 'approved'
     order by v.created_at`,
    [businessId]
  );
  return rows;
}

router.get('/by-hostname', async (req, res) => {
  try {
    const host = String(req.query.host || '').trim();
    if (!host) {
      return fail(res, 400, 'SITE_HOST_REQUIRED', 'A host query parameter is required');
    }
    const requestRow = await siteDomains.liveByHostname(host);
    if (!requestRow) {
      return fail(res, 404, 'SITE_NOT_LIVE', 'This hostname is not a live dedicated site');
    }
    const venues = await siteVenues(requestRow.business_id);
    ok(res, 200, {
      business: {
        id: requestRow.business_id,
        name: requestRow.business_name,
        brand: requestRow.business_brand
      },
      // Private Venues included: the site is a storefront, not the marketplace
      // (ADR-0029: a Business's own site sells everything it owns).
      venues
    });
  } catch (error) {
    logger.error(`Error resolving site hostname: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  }
});

module.exports = router;