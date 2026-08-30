# 01 — Consent banner + gating on landing app

**What to build:** A first-time visitor to the landing site sees a consent banner that blocks until they choose Accept or Reject. The choice is recorded per origin in local storage with a version; analytics (GA4) initializes only after an explicit Accept and never before; the visitor can withdraw or change the choice afterwards. A change to the consent version re-prompts visitors who chose under an older version. No cookie is read or written.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [x] Banner appears on first visit, blocking, before any analytics initialize
- [x] Accept → GA4 loads; Reject → GA4 never loads
- [x] Choice persisted per origin in local storage, withdraw/change path available
- [x] Consent record carries a version; bumping it re-shows the banner
- [x] Copy is PDPA-primary, GDPR-compatible; links the privacy policy
- [x] Tests cover first-visit, accept, reject, withdraw, and version bump
