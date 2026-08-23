/**
 * CSS-composed placeholder "screenshots" for each feature slot. These render
 * inside the DeviceFrame until a real screenshot is swapped in (see
 * lib/screenshots.ts). Pure Tailwind — no images, no deps.
 */

export function MockBookings() {
  return (
    <div className="space-y-3 rounded-2xl border border-border bg-surface p-4">
      <p className="text-xs font-semibold text-ink-2">Court 1 — Badminton</p>
      <div className="grid grid-cols-4 gap-2">
        {["09:00", "10:00", "11:00", "12:00"].map((t, i) => (
          <span
            key={t}
            className={`rounded-full px-2 py-1.5 text-[10px] font-medium ${
              i === 1 ? "bg-ink-2 text-ink-3 line-through" : "bg-primary-light text-primary"
            }`}
          >
            {t}
          </span>
        ))}
      </div>
      <div className="rounded-full bg-primary px-3 py-1.5 text-center text-[11px] font-semibold text-white">
        3 players have booked this slot
      </div>
    </div>
  );
}

export function MockFrontDesk() {
  return (
    <div className="space-y-3 rounded-2xl border border-border bg-surface p-3">
      <p className="text-[11px] font-semibold text-ink-2">Walk-in quick book</p>
      <div className="rounded-xl bg-paper p-3 text-center">
        <div aria-hidden="true" className="mx-auto grid h-14 w-14 grid-cols-5 grid-rows-5 gap-0.5 border border-ink-3">
          {Array.from({ length: 25 }, (_, i) => (
            <span key={i} className="bg-ink/70" />
          ))}
        </div>
        <p className="mt-2 text-[11px] text-ink-2">BK-1042 · Court 1</p>
      </div>
      <div className="rounded-full bg-primary px-3 py-1.5 text-center text-[11px] font-semibold text-white">
        Check in walk-in guest
      </div>
    </div>
  );
}

export function MockPayments() {
  return (
    <div className="space-y-2.5 rounded-2xl border border-border bg-surface p-3">
      {[
        { who: "Nethmi P.", what: "Court 2 — Tennis", amount: "LKR 1,200", state: "bg-success" },
        { who: "Cash", what: "Court 1 — Badminton", amount: "LKR 800", state: "bg-warning" },
        { who: "Dineth K.", what: "Event — Saturday League", amount: "LKR 3,000", state: "bg-success" }
      ].map((row) => (
        <div key={row.who} className="flex items-center gap-2">
          <span aria-hidden="true" className={`h-2 w-2 rounded-full ${row.state}`} />
          <p className="min-w-0 flex-1 truncate text-[11px] text-ink">{row.who}</p>
          <p className="text-[11px] text-ink-2">{row.amount}</p>
        </div>
      ))}
    </div>
  );
}

export function MockEvents() {
  return (
    <div className="space-y-3 rounded-2xl border border-border bg-surface p-3">
      <p className="text-[11px] font-semibold text-ink-2">Upcoming events</p>
      <div className="rounded-xl bg-primary-light p-2.5">
        <p className="text-[11px] font-semibold text-ink">Saturday League</p>
        <p className="text-[10px] text-ink-2">Jul 12 · 6:00 PM · LKR 1,500</p>
        <div className="mt-1 rounded-full bg-primary px-3 py-1 text-center text-[10px] font-semibold text-white">
          Register
        </div>
      </div>
    </div>
  );
}

export function MockDashboard() {
  return (
    <div className="space-y-2.5 rounded-2xl border border-border bg-surface p-3">
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Booked", value: "24" },
          { label: "Checked in", value: "18" },
          { label: "Revenue", value: "LKR 42k" }
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl bg-paper p-2">
            <p className="text-[10px] text-ink-3">{stat.label}</p>
            <p className="font-display text-sm font-extrabold text-ink">{stat.value}</p>
          </div>
        ))}
      </div>
      <p className="text-[11px] font-semibold text-ink-2">Next up — 6:00 PM</p>
      <div className="rounded-xl bg-paper p-2.5">
        <p className="text-[11px] text-ink">Court 1 · Smash Squad</p>
        <p className="text-[10px] text-ink-2">8 players · paid online</p>
      </div>
    </div>
  );
}

export function MockExplore() {
  return (
    <div className="space-y-3 rounded-2xl border border-border bg-surface p-3">
      <div className="rounded-full bg-paper px-3 py-1.5 text-[10px] text-ink-3">Search courts, venues…</div>
      {[
        { name: "Smash Arena", meta: "2.1 km · 3 courts" },
        { name: "Green Yard", meta: "3.4 km · 2 courts" }
      ].map((venue) => (
        <div key={venue.name} className="rounded-xl bg-primary-light p-2.5">
          <p className="text-[11px] font-semibold text-ink">{venue.name}</p>
          <p className="text-[10px] text-ink-2">{venue.meta}</p>
        </div>
      ))}
    </div>
  );
}

export function MockVenueDetail() {
  return (
    <div className="space-y-3 rounded-2xl border border-border bg-surface p-3">
      <div className="rounded-xl bg-paper p-2.5">
        <p className="text-[11px] font-semibold text-ink">Smash Arena</p>
        <p className="text-[10px] text-ink-2">Badminton · 2.1 km</p>
      </div>
      <div className="flex gap-1.5">
        {["Today", "Thu", "Fri"].map((d, i) => (
          <span
            key={d}
            className={`flex-1 rounded-full py-1.5 text-center text-[10px] font-medium ${
              i === 0 ? "bg-primary text-white" : "bg-paper text-ink-3"
            }`}
          >
            {d}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {["09:00", "10:00", "11:00"].map((t, i) => (
          <span
            key={t}
            className={`rounded-xl py-1.5 text-center text-[10px] font-semibold ${
              i === 2 ? "bg-ink-2 text-ink-3 line-through" : "bg-primary-light text-primary"
            }`}
          >
            {t}
          </span>
        ))}
      </div>
      <div className="rounded-full bg-primary px-3 py-1.5 text-center text-[11px] font-semibold text-white">
        Book Court 1 · LKR 1,200/hr
      </div>
    </div>
  );
}

export function MockConfirmation() {
  return (
    <div className="space-y-3 rounded-2xl border border-border bg-surface p-3">
      <div className="rounded-xl bg-primary-light p-2.5">
        <p className="text-[11px] font-semibold text-ink">Booking confirmed</p>
        <p className="text-[10px] text-ink-2">Smash Arena · Court 1 · Today 10:00</p>
      </div>
      <div aria-hidden="true" className="mx-auto grid h-16 w-16 grid-cols-5 grid-rows-5 gap-0.5 border border-ink-3">
        {Array.from({ length: 25 }, (_, i) => (
          <span key={i} className="bg-ink/70" />
        ))}
      </div>
      <div className="rounded-xl bg-paper p-2.5 text-center">
        <p className="text-[11px] font-semibold text-ink">BK-1042</p>
        <p className="text-[10px] text-ink-2">Show this QR at the front desk</p>
      </div>
      <div className="rounded-full bg-success-light px-3 py-1.5 text-center text-[11px] font-semibold text-success">
        Paid · LKR 1,200
      </div>
    </div>
  );
}