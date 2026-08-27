/**
 * CSS-composed placeholder "screenshots" for each feature slot. These render
 * inside the DeviceFrame until a real screenshot is swapped in (see
 * lib/screenshots.ts). Pure Tailwind — no images, no deps.
 */

export function MockDedicatedSite() {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-xl bg-surface px-3 py-2">
        <div className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-3 w-3 rounded-full bg-primary" />
          <p className="text-[11px] font-bold text-ink">Smash Arena</p>
        </div>
        <span aria-hidden="true" className="h-2 w-2 rounded-full bg-primary-light" />
      </div>
      <div className="rounded-xl bg-primary-light px-3 py-4 text-center">
        <p className="text-[12px] font-extrabold text-ink">Book a court in seconds</p>
        <p className="mt-0.5 text-[10px] text-ink-2">Badminton · Tennis · Football turf</p>
      </div>
      <div className="flex gap-1.5">
        {["Today", "Thu", "Fri"].map((d, i) => (
          <span
            key={d}
            className={`flex-1 rounded-full py-1.5 text-center text-[10px] font-semibold ${
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
      <p className="text-center text-[9px] text-ink-3">Powered by MySlot.LK</p>
    </div>
  );
}

export function MockAdminBookings() {
  const rows = [
    { t: "06:00", courts: ["Booked", "Open", "Booked"] },
    { t: "07:00", courts: ["Booked", "Booked", "Open"] },
    { t: "08:00", courts: ["Open", "Booked", "Open"] }
  ];
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-extrabold text-ink">Today's bookings</p>
        <span className="rounded-full bg-primary-light px-2.5 py-0.5 text-[10px] font-bold text-primary">Live</span>
      </div>
      <div className="overflow-hidden rounded-xl border border-border">
        <div className="grid grid-cols-[1fr_repeat(3,1fr)] gap-px bg-border text-center">
          <span className="bg-surface py-1.5 text-[9px] font-semibold uppercase tracking-wide text-ink-3">Time</span>
          {["Court 1", "Court 2", "Court 3"].map((c) => (
            <span key={c} className="bg-surface py-1.5 text-[9px] font-semibold uppercase tracking-wide text-ink-3">
              {c}
            </span>
          ))}
          {rows.flatMap((row) => [
            <span key={`${row.t}-t`} className="bg-paper py-2 text-[10px] font-semibold text-ink-2">
              {row.t}
            </span>,
            ...row.courts.map((state, i) => (
              <span
                key={`${row.t}-${i}`}
                className={`py-2 text-[9px] font-semibold ${
                  state === "Booked" ? "bg-ink text-white" : "bg-primary-light text-primary"
                }`}
              >
                {state}
              </span>
            ))
          ])}
        </div>
      </div>
      <div className="rounded-full bg-primary px-3 py-1.5 text-center text-[11px] font-semibold text-white">
        18 bookings · LKR 21,600 today
      </div>
    </div>
  );
}

export function MockAdminDashboard() {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-extrabold text-ink">Venue Dashboard</p>
        <span className="rounded-full bg-primary-light px-2.5 py-0.5 text-[10px] font-bold text-primary">Today</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Booked", value: "24" },
          { label: "Checked in", value: "18" },
          { label: "Revenue", value: "LKR 42k" }
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl bg-paper p-2.5">
            <p className="text-[9px] text-ink-3">{stat.label}</p>
            <p className="font-display text-sm font-extrabold text-ink">{stat.value}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-[1fr_1.2fr] gap-2">
        <div className="rounded-xl bg-paper p-2.5">
          <p className="text-[9px] font-semibold text-ink-2">Next up — 06:00 PM</p>
          <p className="mt-1 text-[10px] text-ink">Court 1 · Smash Squad</p>
          <p className="text-[9px] text-ink-3">8 players · paid online</p>
        </div>
        <div className="flex items-end gap-1 rounded-xl bg-paper p-2.5">
          {[40, 65, 50, 80, 60, 90, 70].map((h, i) => (
            <span
              key={i}
              aria-hidden="true"
              className={`flex-1 rounded-t ${i === 5 ? "bg-primary" : "bg-primary-light"}`}
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
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