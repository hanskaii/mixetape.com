/**
 * Calendar arithmetic for the Publish calendar. Days are calendar dates as "YYYY-MM-DD" keys,
 * independent of any time zone; a post lands on a day by reading its time in the zone the
 * viewer picked (dayKey). Weeks start on Sunday.
 */

/** Month: the whole month in weeks. Week: Sunday to Saturday. Days: three days on a phone. */
export type CalendarMode = "month" | "week" | "days";

/** Days shown at once in "days" mode. */
export const PHONE_DAYS = 3;

const parse = (key: string) => new Date(`${key}T12:00:00Z`);
const format = (date: Date) => date.toISOString().slice(0, 10);

export function addDays(key: string, days: number) {
  const date = parse(key);
  date.setUTCDate(date.getUTCDate() + days);
  return format(date);
}

/** 0 for Sunday … 6 for Saturday. */
export const weekday = (key: string) => parse(key).getUTCDay();

/** The first of the month the key is in. */
export const monthStart = (key: string) => `${key.slice(0, 7)}-01`;

function addMonths(key: string, months: number) {
  const date = parse(monthStart(key));
  date.setUTCMonth(date.getUTCMonth() + months);
  return format(date);
}

/** The calendar date of an instant in a time zone. */
export function dayKey(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

/** The hour (0–23) of an instant in a time zone. */
export function hourOf(date: Date, timeZone: string) {
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    hourCycle: "h23",
  }).format(date);
  return Number(hour) % 24;
}

/** The days a mode shows around `anchor`, in order. */
export function visibleDays(mode: CalendarMode, anchor: string): string[] {
  if (mode === "days") return Array.from({ length: PHONE_DAYS }, (_, i) => addDays(anchor, i));
  const first =
    mode === "week"
      ? addDays(anchor, -weekday(anchor))
      : addDays(monthStart(anchor), -weekday(monthStart(anchor)));
  if (mode === "week") return Array.from({ length: 7 }, (_, i) => addDays(first, i));
  const lastOfMonth = addDays(addMonths(anchor, 1), -1);
  const last = addDays(lastOfMonth, 6 - weekday(lastOfMonth));
  const days: string[] = [];
  for (let day = first; day <= last; day = addDays(day, 1)) days.push(day);
  return days;
}

/** The anchor one step back (-1) or forward (+1): a month, a week, or three days. */
export function shiftAnchor(mode: CalendarMode, anchor: string, direction: -1 | 1) {
  if (mode === "month") return addMonths(anchor, direction);
  return addDays(anchor, direction * (mode === "week" ? 7 : PHONE_DAYS));
}

/** "October 2026" for a month or week; "October 8" for the phone's three days. */
export function calendarTitle(mode: CalendarMode, anchor: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "long",
    ...(mode === "days" ? { day: "numeric" } : { year: "numeric" }),
  }).format(parse(mode === "month" ? monthStart(anchor) : anchor));
}

/** "Sunday", "Sun". */
export function weekdayName(key: string, style: "long" | "short") {
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: style }).format(parse(key));
}

/** The day of the month, "8". */
export const dayOfMonth = (key: string) => String(Number(key.slice(8, 10)));

/**
 * The instants to ask the server for: a day either side of the visible days, so whatever
 * zone the viewer picks, every post that lands on a visible day is in the answer.
 */
export function fetchRange(days: string[]) {
  return {
    from: `${addDays(days[0], -1)}T00:00:00Z`,
    to: `${addDays(days[days.length - 1], 2)}T00:00:00Z`,
  };
}
