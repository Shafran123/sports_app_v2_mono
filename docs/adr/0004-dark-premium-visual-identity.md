# Dark premium visual identity (SmashZone-derived)

The player-facing UI shipped with a light "court green + lime" theme that fell far below the product's design expectation. We adopted the palette of the user's reference shot (SmashZone badminton booking app by Farhan Ahmed Jibon): near-black `#10170C` base, deep green `#314632`, lemon `#F9DC13` primary accent, ice-blue `#ADD2FE` secondary, off-white `#EEF5EC` text — applied as a strict dark identity across player, business, and admin surfaces. Web stays responsive web (no mobile-app column emulation); the theme and richness carry through, not the app shell.

**Considered options**: the old light court-green scheme (rejected — user reported it as "shit"); a light luxury variant (rejected — the reference is unambiguously dark); app-shell emulation on desktop (rejected — user wants genuine responsive web).

**Consequences**: all `court-*`/`lime` tokens are replaced by the new token set; this ADR supersedes the design-direction note in the booking-mvp spec; screenshots of the reference cannot be consulted directly (no image input), so the contract is captured in hex/type figures.