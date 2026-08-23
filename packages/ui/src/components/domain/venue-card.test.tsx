import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { VenueCard } from "./venue-card";
import type { Venue } from "@myslot/types";

const venue: Venue = {
  id: "v1",
  name: "Smash Arena",
  status: "approved",
  description: null,
  address: "45 Galle Road",
  city: "Colombo",
  phone: null,
  photos: [],
  amenities: [],
  rules: null,
  cancellation_policy: null,
  min_price: 1500,
  max_price: 2500
};

describe("VenueCard navigation (regression: cards were non-navigable divs)", () => {
  it("renders as a link to the venue detail page", () => {
    render(<VenueCard venue={venue} />);
    const link = screen.getByRole("link", { name: /Smash Arena/ });
    expect(link).toHaveAttribute("href", "/venues/v1");
  });

  it("respects an explicit href override", () => {
    render(<VenueCard venue={venue} href="/explore?city=Colombo" />);
    const link = screen.getByRole("link", { name: /Smash Arena/ });
    expect(link).toHaveAttribute("href", "/explore?city=Colombo");
  });
});