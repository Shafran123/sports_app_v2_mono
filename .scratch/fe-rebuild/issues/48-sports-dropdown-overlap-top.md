# 48 — Sports dropdown overlaps the content above it (header collision)

## What happened
- The sport/"Select a sport" dropdown in the console overlaps the content above it — the open list appears to be clipped/overlapped from the top (reported against the admin/owner app).

## Root cause (found)
- Console pages sit flush under the sticky top header (`sticky top-0 z-30`): the shell's top padding is dead (see 45/46), so the first form row — including `SelectSheet` triggers used for sports (venue form, events manager, quick book) — touches the header's bottom border. On narrow screens the native select popup / the sheet opens under the header edge and appears overlapped from the top.

## Fix
1. Apply the 45/46 shell fix (real `pt-5` top padding) so no form control ever sits under the header.
2. Harden `SelectSheet`'s mobile sheet: ensure the sheet content never renders above the viewport top when content is taller than the screen (`max-h-[90dvh] overflow-y-auto` on the sheet body, options list scrolls internally).

## Acceptance
- [ ] Opening any sports dropdown on console shows the list fully below/open cleanly, nothing overlapped by the header
- [ ] Sheet body scrolls internally when longer than the viewport; no content above the top edge
- [ ] Works at 640px–sm and desktop widths