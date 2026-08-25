# 11 — Remove date-picker helper text

**What to build:** The player's date picker shows a right-hand helper caption ("Book any future date" when the venue has no advance limit, or "Book up to …" when it has one). This text is clutter — especially the "any future date" case. Remove the caption; the date input keeps its min/max bounds so the browser still enforces the venue's horizon.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] No helper text renders beside the date input.
- [ ] The date input still disables past dates (min = today) and dates beyond the venue's advance horizon (max).
- [ ] The `advance_days` value is still honoured even though the caption is gone.