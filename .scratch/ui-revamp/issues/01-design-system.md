# 01 — Design system: tokens, type, and primitives

**What to build:** the theme becomes real. New palette tokens replace the old court-green/lime set, Sora joins Geist, and the primitive components (Button, Chip, Card, Input, Select, Modal, BottomSheet, Badge, EmptyState, ErrorState, Skeleton, icons, motion file) exist in a single place ready for every other ticket to consume.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] `globals.css` uses the ADR-0004 palette (ink/lemon/ice/mist tokens); old `court-*`/`lime` usages removed or remapped; `npm run build` green
- [ ] Sora (extra-bold) + Geist loaded via next/font; a `display` utility class exists
- [ ] All primitives exported from a single barrel (e.g. `components/ui/index.js`), styled per the geometry contract (rounded-3xl cards, pill buttons, soft focus rings)
- [ ] Icons as inline SVG set; shimmer skeleton; press-scale + fade/slide motion helpers in one file; no new deps
- [ ] Contrast floor: text on `#10170C` ≥4.5:1 (off-white passes; muted `#A4AFB5` only for secondary)
- [ ] Sample pages (home hero, one form, one list) restyled with primitives to prove the system