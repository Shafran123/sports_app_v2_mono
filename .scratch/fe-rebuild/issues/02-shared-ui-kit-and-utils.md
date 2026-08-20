# 02 — Shared UI kit and utils

**What to build:** the reusable component system both apps render with — the design system becomes real as shadcn-based components in the new identity, plus shared formatting/date helpers.

**Blocked by:** 01 — Scaffold the rebuild monorepo.

**Status:** ready-for-agent

- [ ] A shared UI package exports the full primitive set in the light-premium identity: Button, Input, Select, Textarea, Checkbox, Switch, Badge, StatusPill, Card, Dialog/Modal, Drawer/Sheet, Tabs, Table (sort/filter/pagination), StatCard, Skeleton, EmptyState, ErrorState, Toast, Avatar, Dropdown, Tooltip
- [ ] Domain components: VenueCard, SlotGrid, CourtRow, BookingCard, ActivityCard, CountdownPill
- [ ] A shared utils package: Rs currency formatting (en-LK "Rs 1,250"), day names, dayjs date/time helpers (12-hour "6:30 PM"), and a `cn` class merge
- [ ] Component tests for interactive primitives (Button variants, Tabs, Dialog open/close, StatusPill status→tone mappings)
- [ ] A style-guide route in each app proves the system renders on the new tokens