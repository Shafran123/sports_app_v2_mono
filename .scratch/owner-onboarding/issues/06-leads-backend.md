# 06 — Leads backend

**What to build:** the public "list your place" interest form gets a home. A new `owner_leads` table stores name, email, phone, venue name, city, message, and status (new → contacted → converted / closed). A public endpoint accepts submissions; admin endpoints list, mark contacted, convert, and close. Duplicate emails and duplicate venue names are flagged, and admins are notified when a new lead lands.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Migration creates `owner_leads`; public submit endpoint stores a new lead
- [ ] Admin can list leads and filter by status
- [ ] Admin can mark contacted, convert, and close a lead
- [ ] Duplicate email / duplicate venue name is flagged on the lead list
- [ ] New lead notifies admins (in-app + email)