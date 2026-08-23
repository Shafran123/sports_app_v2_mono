# 05 — Living docs: CONTEXT.md + README

**What to build:** update only the living domain/codebase docs so they describe the new brand; leave ADRs, old specs, and past ticket files as historical records.

- `CONTEXT.md` intro (line 3): "Brand name is admin-configurable (default "Spots")" → default "MySlot.LK".
- `CONTEXT.md`: add a **Brand Name** glossary term — the admin-configurable display name of the platform (default MySlot.LK), shown to players and venue owners on config-driven surfaces; distinct from the internal package namespace and the email from-address.
- `sp_be/README.md` first line: "…sports venue booking marketplace (Spots)" → "(MySlot.LK)".

**Blocked by:** —

**Status:** ready-for-human (implemented, code-level checks pass; deploy-level checks pending)

- [ ] `CONTEXT.md` intro states the MySlot.LK default; glossary gains the Brand Name term with no implementation details
- [ ] `sp_be/README.md` carries the new brand
- [ ] No ADR, old spec, or old ticket file was edited