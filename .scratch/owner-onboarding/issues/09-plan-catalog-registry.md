# 09 — Plan catalog & registry

**What to build:** the commercial terms admin. A plan-template catalog (name, term, price — zero is a free term) with create/edit/archive; applying a template creates an owner Plan instance with start (admin-set) and end (start + term). An "Owners" registry lists every owner with their plan window, filters by "expiring in N days", and offers renew / nudge actions.

**Blocked by:** 08 — Create owner account

**Status:** ready-for-agent

- [ ] Admin can create, edit, and archive plan templates; archived templates aren't selectable for new owners
- [ ] Applying a template creates an owner Plan instance with start + end
- [ ] Editing a template never rewrites past owner Plan instances
- [ ] Owners view lists owners with plan start/end and an "expiring in N days" filter
- [ ] Renew / nudge actions exist (renew drafts a new agreement per ticket 10)