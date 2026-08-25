# 09 — Collapsible opening-hours card (today-first, desktop below booking)

**What to build:** The player's venue detail page shows a full-week "Opening hours" card that takes up a lot of vertical space and pushes the "Book a slot" area far down the screen. Make it collapse: by default it shows only **today's** hours (or "Closed" if today has no opening windows), and a tap expands it to the full week. On desktop the card moves **below** the "Book a slot" section, so booking controls appear first.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] The opening-hours card shows only today's row by default; tapping it expands to the full week.
- [ ] When today has no opening windows, the collapsed card reads "Closed".
- [ ] On desktop (lg+), the card renders below the "Book a slot" section instead of above it.
- [ ] On mobile the card stays compact and does not push the booking controls out of the initial viewport.
- [ ] Multi-window days still show every window when expanded.