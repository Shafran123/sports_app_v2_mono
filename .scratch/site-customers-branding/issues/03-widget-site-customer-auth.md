# 03 — Booking Widget uses Site Customer auth (ADR 0030)

**What to build:** The Booking Widget, embedded on the owner's own third-party website, signs the buyer in as that Business's **Site Customer** — the same customer base as the Dedicated Site — never the platform Player base. Cookies don't work inside a third-party iframe, so the Site Customer session travels as a bearer token (postMessage between iframe and parent, or token-in-header) with the same session middleware from ticket 01.

**Blocked by:** 01

**Status:** ready-for-agent

- [x] Widget sign-in/register uses Site Customer auth (email+password, Google)
- [x] Bearer-token transport for the site-customer session inside the iframe; validated against the Instance's Business
- [x] Widget booking gate requires Site Customer Verified Phone + Verified Email per Business
- [x] Widget's own-booking view/cancel renders for the signed-in Site Customer
- [x] Tests: widget booking as a Site Customer; two Businesses → independent customers; token rejected for another Business