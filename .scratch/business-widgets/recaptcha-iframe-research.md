# Research: Google reCAPTCHA inside a cross-origin iframe (booking widget)

Context: booking widget served as a cross-origin iframe (`https://platform.example/embed/<key>`) on
arbitrary third-party sites. Goal: protect in-iframe forms (login, checkout) with reCAPTCHA v3,
verified server-side with `siteverify`.

Web research only — no code was written or run. Each finding lists sources and a confidence note.

---

## 1. Does reCAPTCHA v2/v3 work inside a cross-origin iframe?

**Bottom line: it is fragile and Google's own docs describe the failure modes; it is not a
"just drop it in" feature.** Google never ships a clean one-liner "reCAPTCHA works/doesn't work in
iframes," but its documented behavior makes iframe embedding problematic:

- **Google's official "SecurityError: blocked a frame" FAQ item** is Google's own acknowledgment that
  reCAPTCHA's injected Google frames try to access the surrounding frame's window, and that this
  throws `Uncaught SecurityError: Blocked a frame with origin "https://www.google.com" from accessing
  a frame with origin "<your domain>"` in frame contexts:
  - https://developers.google.com/recaptcha/docs/faq ("I'm getting an uncaught SecurityError…")
  - https://docs.cloud.google.com/recaptcha/docs/troubleshoot-recaptcha-issues (same entry,
    reCAPTCHA Enterprise / Fraud Defense). Google's prescribed fix there is `grecaptcha.reset()` —
    not "render it in an iframe."
  - Confirmed in the wild when a widget is loaded via script tag on a cross-origin frame:
    https://stackoverflow.com/questions/77220507 (the google.com bframe throws the DOMException at
    `grecaptcha__en.js` while reading a `window.top` property).
- **Domain binding:** a key is tied to an allowed-domain list and the hostname where the widget runs
  must match. When you iframe-embed a form, you must whitelist **the iframe's own host**:
  - https://developers.google.com/recaptcha/docs/domain_validation (keys tied to domains; if you
    disable domain validation you are *required* to check the `hostname`/package field server-side
    and reject mismatches).
  - https://stackoverflow.com/questions/60719205/answer/78874531 — embed a form via iframe on a
    WordPress site → "Invalid domain for site key" until the *form host's* (iframe's) domain was
    added; the parent (WordPress) domain was already registered and did NOT fix it.
  - https://stackoverflow.com/questions/64869494 (nested iframes → "Invalid Domain"), and
    https://stackoverflow.com/questions/77285265 (reCAPTCHA **v3** → "invalid domain" when the
    document is loaded via a sandboxed/srcdoc iframe, i.e. opaque origin).
  - Google Sites forum: reCAPTCHA in an embed iframe (randomized sandboxed URL) fails with "Invalid
    domain for site key": https://support.google.com/sites/thread/164218904
- **v2 checkbox:** the widget *is* rendered (the checkbox is itself an injected iframe pointing at
  `https://www.google.com/recaptcha/api2/anchor…`), so "rendered" ≠ "reliable" — the challenge
  (bframe) does cross-frame reads of `window.top` and throws SecurityError in cross-origin/removed
  contexts (SO 77220507; Google FAQ SecurityError entry). In a sandboxed srcdoc iframe the anchor's
  `co` param even becomes `about:` (base64 `YWJvdXQ6`), i.e. the origin is null and domain checks
  fail (SO 60719205 body).
- **v3:** headless score. It loads and `execute()`s inside a normal cross-origin iframe and returns a
  token, subject to the same domain-binding and third-party-cookie constraints (SO 77285265 shows v3
  reaching the token/domain-validation stage inside an iframe). No official Google source guarantees
  score quality in an iframe.

Confidence: **High** on the documented failure modes (SecurityError, domain binding); **Medium** on
"the checkbox visibly renders" (it does, but is unreliable).

## 2. What hostname does siteverify report for an iframe-minted token?

**It reports the iframe's own origin (e.g. `platform.example`), not the top-level embedding page.**

- Google's field definition: the siteverify `hostname` is "the hostname of the site where the
  reCAPTCHA was solved":
  https://developers.google.com/recaptcha/docs/verify (response schema) — and for v3
  https://developers.google.com/recaptcha/docs/v3 (same `hostname` field).
- Google Groups (reCAPTCHA group): hostname is "the domain from which the response was acquired",
  validated against the key's whitelist:
  https://groups.google.com/g/recaptcha/c/b3Gp9q4FWZw
- Corroboration: in an iframe, the widget runs in the iframe's document, so "where it was solved" is
  the iframe's host. SO 60719205's fix (whitelist the iframe/form host, not the parent) is direct
  evidence that reCAPTCHA validates against the iframe's own hostname.

**Implication for your hostname validation:** if you whitelist `platform.example` and check
`hostname == platform.example` on siteverify, iframe tokens PASS. The hostname will NOT be the
business site's domain — so any hostname check that expected the embedding site's hostname would
reject legit iframe tokens. (You cannot derive the embedding site from the reCAPTCHA hostname field.)

Confidence: **Medium–High** — inferred from Google's field definition plus multiple corroborating
reports; no single Google page states the iframe case verbatim.

## 3. Canonical alternative / what Google actually documents for embedded widgets

- Google's documented model is **domain-bound rendering**: the key must match the hostname where the
  widget runs (domain_validation doc above). The supported pattern for a widget embedded on other
  sites is therefore to run reCAPTCHA **on the page whose domain owns the key** — i.e. the top-level
  page — and pass the resulting token into the iframe (e.g. `postMessage`), rather than executing
  reCAPTCHA inside the cross-origin iframe. Google does not document a supported "render reCAPTCHA
  inside a cross-origin iframe" flow; the CSP doc's `frame-src https://www.google.com/recaptcha/,
  https://recaptcha.google.com/recaptcha/` is about allowing Google's own frames, not about your
  iframe embedding (https://developers.google.com/recaptcha/docs/faq, CSP section).
- If the target is a server API rather than a browser form, Google's documented options are
  reCAPTCHA Enterprise / **reCAPTCHA Express** (token verified server-side via
  `recaptchaenterprise.createAssessment`, no in-page widget):
  https://docs.cloud.google.com/recaptcha/docs/express-standalone and
  https://docs.cloud.google.com/recaptcha/docs/create-assessment-website
- **Non-Google (factual note):** Cloudflare Turnstile is explicitly designed to run in cross-origin
  iframes without relying on third-party cookies:
  https://developers.cloudflare.com/turnstile/ ("can be embedded into any website… works without
  showing visitors a CAPTCHA"). Google does not endorse Turnstile; it's presented only as an
  alternative that exists in the market.

Confidence: **Medium** — the "render in the top-level page / own domain" pattern is inference from
Google's domain-binding docs plus the documented iframe failure modes; there is no Google doc that
says "use X for iframes" explicitly.

## 4. `_GRECAPTCHA` cookie in an iframe — first- or third-party?

**It is a third-party cookie in your stack, and therefore subject to third-party-cookie blocking.**

- Google FAQ (current and archived): "reCAPTCHA sets a necessary cookie (`_GRECAPTCHA`) when executed
  for the purpose of providing its risk analysis. If you prefer to not use the www.google.com domain
  which may have other cookies set, you can use www.recaptcha.net instead":
  https://developers.google.com/recaptcha/docs/faq ("Does reCAPTCHA use cookies?")
  (also in the 2021 snapshot: http://web.archive.org/web/20210101205147/https://developers.google.com/recaptcha/docs/faq)
- Cookie semantics: a cookie is *third-party* when its domain differs from the site shown in the
  address bar; cookies set by content embedded in an `<iframe>` from another origin are third-party:
  https://developer.mozilla.org/en-US/docs/Web/Privacy/Guides/Third-party_cookies
- In your stack (business-site top page → `platform.example` iframe → Google's injected recaptcha
  iframe on `google.com`/`recaptcha.net`), Google's domain is third-party relative to the top-level
  business site. So `_GRECAPTCHA` is set as a third-party cookie and is blocked/degraded where
  third-party cookies are blocked: Safari ITP (default), Firefox Total Cookie Protection (default),
  and Chrome/Edge when 3P cookies are blocked (MDN page above, "How do browsers handle third-party
  cookies?").

Confidence: **High** that the cookie exists and is on Google's domain; **High** that it is a
third-party cookie in that frame stack (by definition); the real-world impact on reCAPTCHA
(risk signal loss / breakage) is widely reported but not stated in Google's docs, so that last step
is **Medium–High**.

---

## Explicit contradictions to "just drop reCAPTCHA into the iframe"

1. **The token's hostname is the iframe origin, not the parent.** Whitelist and validate against
   `platform.example`. You cannot obtain/validate the embedding site's hostname from reCAPTCHA's
   `hostname` field.
2. **It is not simply "works."** Sandboxed iframes (common for third-party widgets), srcdoc iframes,
   and nested iframes fail outright with "Invalid domain for site key"; cross-origin frame access
   triggers Google's own documented `SecurityError` (google.com frame blocked from accessing your
   frame); and Safari/Firefox third-party-cookie blocking can break or degrade the risk analysis.
3. **"Google says reCAPTCHA is not designed for iframes" — not verified verbatim.** The widely
   repeated quote could not be found in Google's official docs during this research. The verifiable
   official statements are: (a) the SecurityError FAQ/troubleshooting entry acknowledging Google's
   frames hit cross-frame access errors, and (b) the domain-binding model that ties keys to the
   hostname where the widget runs. Treat "not designed for iframes" as an accurate summary of
   documented behavior rather than a quotable Google sentence.
