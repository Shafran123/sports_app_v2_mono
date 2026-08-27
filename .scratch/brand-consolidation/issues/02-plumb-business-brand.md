# 02 — Plumb Business brand into message dispatch

**What to build:** Booking, event, and site dispatches carry the Business's identity (id, name) and brand tokens into the transactional message dispatch context, so the email/SMS builders can read them. Dispatches without a Business context continue to fall back to the platform brand, so no existing message changes appearance yet.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [x] Loader join extended so booking/event dispatches resolve the Business and its brand
- [x] Dispatch context carries Business id, name, and brand object for Business-scoped messages; platform brand is the fallback when absent
- [x] Notification catalog tests assert the context carries Business brand when present and falls back otherwise
- [x] Render-emails preview harness gains a fixture Business with brand tokens for review
