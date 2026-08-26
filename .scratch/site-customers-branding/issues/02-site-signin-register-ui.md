# 02 — Site sign-in / register UI on the Dedicated Site (ADR 0030)

**What to build:** The white-label site's auth screens — sign-in and register as a Site Customer of this Business (email+password, Google, and the details step: name, per-Business Verified Phone + Verified Email). Full **Site Brand** chrome, never the marketplace shell or "MySlot" wordmark. Sign-in state is scoped to the Business: signing in on ABC's site never touches ABC-in-the-marketplace or XYZ sessions.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Register/sign-in screens in site chrome with Site Customer auth wired
- [ ] Details + verification step (phone/email OTP) per Business, using site brand colors
- [ ] A signed-in Site Customer's booking/session state is isolated to this Business (no cross-host session bleed)
- [ ] Unauthenticated booking flow redirects to site sign-in like today's app flow
- [ ] Widget-compatible: same token works via bearer transport (see 03)
- [ ] Tests: register→verify→book on site host; sign-in state does not leak across hosts/businesses