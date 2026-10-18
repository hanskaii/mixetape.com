/**
 * Date arithmetic for the Publish board. Days are calendar dates as "YYYY-MM-DD" keys,
 * independent of any time zone; a post lands on a day by reading its time in the zone the
 * viewer picked (dayKey). The board shows one month at a time.
 */

const parse = (key: string) => new Date(`${key}T12:00:00Z`);
const format = (date: Date) => date.toISOString().slice(0, 10);

export function addDays(key: string, days: number) {
  const date = parse(key);
  date.setUTCDate(date.getUTCDate() + days);
  return format(date);
}

/** The first of the month the key is in. */
export const monthStart = (key: string) => `${key.slice(0, 7)}-01`;

/** The first of the month before (-1) or after (+1). */
export function shiftMonth(key: string, direction: -1 | 1) {
  const date = parse(monthStart(key));
  date.setUTCMonth(date.getUTCMonth() + direction);
  return format(date);
}

/** Every day of the month the key is in, the 1st first. */
export function monthDays(key: string): string[] {
  const days: string[] = [];
  const next = shiftMonth(key, 1);
  for (let day = monthStart(key); day < next; day = addDays(day, 1)) days.push(day);
  return days;
}

// A formatter costs far more to make than to use, and the board reads every post's day.
const dayFormats = new Map<string, Intl.DateTimeFormat>();

/** The calendar date of an instant in a time zone. */
export function dayKey(date: Date, timeZone: string) {
  let format = dayFormats.get(timeZone);
  if (!format) {
    format = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    dayFormats.set(timeZone, format);
  }
  const parts = format.formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

/** "October 2026". */
export const monthTitle = (key: string) =>
  new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "long", year: "numeric" }).format(
    parse(monthStart(key)),
  );

/** "Sunday", "Sun". */
export function weekdayName(key: string, style: "long" | "short") {
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: style }).format(parse(key));
}

/** The day of the month, "8". */
export const dayOfMonth = (key: string) => String(Number(key.slice(8, 10)));

/**
 * The instants to ask the server for: a day either side of the shown days, so whatever
 * zone the viewer picks, every post that lands on a shown day is in the answer.
 */
export function fetchRange(days: string[]) {
  return {
    from: `${addDays(days[0], -1)}T00:00:00Z`,
    to: `${addDays(days[days.length - 1], 2)}T00:00:00Z`,
  };
}
