# 02 — App shells: player top nav, business + admin sidebars, mobile bottom tabs

**What to build:** one place defines navigation for every page. Player gets an immersive sticky top nav (logo, search, links, bell, avatar) + the existing bottom tabs restyled dark; business and admin get collapsible sidebar shells (drawer on mobile). NotificationBell and TopBar move into these shells, and all pages render inside them.

**Blocked by:** 01 — Design system.

**Status:** ready-for-agent

- [ ] Player layout: top nav dark, sticky, with wordmark + lemon dot; bottom tabs restyled (lemon active state); footer on desktop
- [ ] Business + admin layouts: dark sidebar (collapsible ≤1024px), mobile slide-in drawer; nav items match existing routes
- [ ] NotificationBell restyled + placed in all three shells
- [ ] Existing pages render inside their shell without route changes; `npm run build` green