// Shared public-venue payload builder: a venue's courts, sports, hours and
// public fields, with the owner identity and widget internals stripped. Used
// by the branded page (by-slug), the public venue detail, and the Booking
// Widget config (one venue per eligible entry).

const pool = require('../db');

async function buildVenueDetail(venue, client = pool) {
  const [courtsRes, sportsRes, hoursRes] = await Promise.all([
    client.query(
      `select c.id, c.name, c.capacity, c.price_per_slot, c.slot_duration_min,
              c.is_indoor, s.name as sport, s.slug as sport_slug
       from courts c
       left join sports s on s.id = c.sport_id
       where c.venue_id = $1 and c.is_active
       order by c.name`,
      [venue.id]
    ),
    client.query(
      `select s.name, s.slug, s.icon
       from venue_sports vs join sports s on s.id = vs.sport_id
       where vs.venue_id = $1 order by s.name`,
      [venue.id]
    ),
    client.query(
      `select day_of_week, open_time, close_time
       from venue_hours where venue_id = $1 order by day_of_week`,
      [venue.id]
    )
  ]);

  // The venue row's owner identity is never public; all other fields
  // (slug, photos, brand-less presence) render on the storefront.
  const { owner_id, ...publicVenue } = venue;
  return {
    ...publicVenue,
    courts: courtsRes.rows,
    sports: sportsRes.rows.map((s) => s.name),
    hours: hoursRes.rows
  };
}

module.exports = { buildVenueDetail };