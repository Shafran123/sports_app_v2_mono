import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";

dayjs.extend(utc);

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function dayName(dayOfWeek: number): string {
  return DAY_NAMES[dayOfWeek] ?? "Unknown";
}

/** Render an ISO datetime as 12-hour clock time in the given timezone ("6:30 PM"). */
export function formatTime12(iso: string, timeZone: string = "Asia/Colombo"): string {
  return new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone
  }).format(new Date(iso));
}

/** Render an ISO datetime as a long date ("Thursday, 20 August 2026"). */
export function formatDateLong(iso: string, timeZone: string = "Asia/Colombo"): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone
  }).format(new Date(iso));
}

/** Local YYYY-MM-DD key for a Date. */
export function toDateKey(d: Date): string {
  return dayjs(d).format("YYYY-MM-DD");
}

/** Add n days to a YYYY-MM-DD key, handling month/year rollover. */
export function addDaysKey(key: string, n: number): string {
  return dayjs(key, "YYYY-MM-DD").add(n, "day").format("YYYY-MM-DD");
}

export { dayjs };