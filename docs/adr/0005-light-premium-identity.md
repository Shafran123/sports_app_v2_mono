# Light-premium marketplace identity (supersedes ADR-0004)

The previous buyer-facing UI shipped the dark SmashZone-derived identity (near-black `#10170C` base, lemon accents) after the zero-to-100 revamp. A full rebuild review concluded the product — now positioned as a serious two-sided booking marketplace with an operator console — needs a trust-forward, light-premium identity closer to the Pitchbooking reference: a neutral paper base, ink text, and a single strong primary brand color, with venue photography carrying the premium weight.

**Why a light identity now**: the user asked for a "new production-grade" identity for the rebuild (grill sessions Q5/Q14/Q17); dark premium was deemed a re-skin of the previous direction rather than a fresh direction; light surfaces read as more trustworthy for payments and operator dashboards, and photographs pop on light.

**Decided tokens** (CSS variables in `packages/ui/src/globals.css`):

- Base `paper` `#fafaf7` · Surface `#ffffff` · Surface-2 `#f4f4f0`
- Text `ink` `#0e1512` · secondary `ink-2` `#4b5563` · muted `ink-3` `#9ca3af`
- Border `#e7eae5` · border-strong `#d3d8d1`
- Primary (court green) `#16a34a` · hover `#15803d` · light `#dcfce7`
- Accent (blue) `#2563eb` · light `#dbeafe`
- Success/warning/error = `#16a34a` / `#d97706` / `#dc2626` families
- Type: Plus Jakarta Sans body, Sora (extrabold) display/numerals
- Geometry: cards `rounded-3xl`, inputs `rounded-2xl`, buttons/pills `rounded-full`, soft shadows

**Consequences**: ADR-0004's dark token set is superseded — the new tokens replace it in the rebuilt apps; `sp_fe` (legacy) keeps the old identity until decommissioned; both surfaces in the new monorepo (player + console) share this identity through the `@spots/ui` theme.