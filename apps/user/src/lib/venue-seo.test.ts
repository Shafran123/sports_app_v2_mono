import { describe, expect, it } from "vitest";
import { jsonLdString, prettyCity, venueDescription, venueJsonLd } from "./venue-seo";

const venue = {
  name: "Galle Cricket Club",
  description: null,
  address: "12 Beach Rd",
  city: "galle",
  phone: "+94771234567",
  photos: ["/p/1.jpg", "https://cdn.example/2.jpg"],
  sports: ["cricket"],
  courts: [],
  hours: [{ day_of_week: 1, open_time: "06:00:00", close_time: "22:00:00" }],
  lat: 6.03,
  lng: 80.21,
  min_price: 2000,
  max_price: 4000,
  amenities: ["Parking"]
};

describe("venue seo", () => {
  it("capitalises owner-typed city names", () => {
    expect(prettyCity("galle")).toBe("Galle");
    expect(prettyCity(null)).toBe("");
  });

  it("builds a description from the venue's own data, not the business tagline", () => {
    expect(venueDescription(venue, "Business about")).toBe(
      "Book Cricket courts at Galle Cricket Club in Galle. Real-time availability, instant confirmation."
    );
  });

  it("prefers the venue's own description and truncates it", () => {
    const long = "x".repeat(200);
    expect(venueDescription({ ...venue, description: long })).toHaveLength(160);
    expect(venueDescription({ ...venue, description: "Floodlit nets." })).toBe("Floodlit nets.");
  });

  it("emits SportsActivityLocation with hours, geo and absolute images", () => {
    const ld = venueJsonLd(venue, { origin: "https://x.lk", path: "/galle-cricket-club", businessName: "GCC" });
    expect(ld["@type"]).toBe("SportsActivityLocation");
    expect(ld.url).toBe("https://x.lk/galle-cricket-club");
    expect(ld.image).toEqual(["https://x.lk/p/1.jpg", "https://cdn.example/2.jpg"]);
    expect(ld.openingHoursSpecification?.[0]).toMatchObject({ dayOfWeek: "Monday", opens: "06:00", closes: "22:00" });
    expect(ld.geo).toMatchObject({ latitude: 6.03, longitude: 80.21 });
    expect(ld.address.addressLocality).toBe("Galle");
  });

  it("omits fields the venue does not have", () => {
    const ld = venueJsonLd({ ...venue, photos: [], hours: [], lat: null, lng: null, phone: null, amenities: [] }, { origin: "https://x.lk", path: "/v" });
    expect(ld).not.toHaveProperty("image");
    expect(ld).not.toHaveProperty("openingHoursSpecification");
    expect(ld).not.toHaveProperty("geo");
    expect(ld).not.toHaveProperty("telephone");
  });

  it("escapes < so venue text cannot break out of the script tag", () => {
    expect(jsonLdString({ a: "</script><b>" })).not.toContain("</script>");
  });
});
