/**
 * All helpers here treat dates/times as UTC-instant-but-timezone-naive values,
 * matching the Postgres `date`/`time` columns (which store no timezone at all).
 * Never use local-timezone Date methods (getHours, toLocaleString, etc.) on
 * values that came from or are going to these fields.
 */

/** "YYYY-MM-DD" -> Date at UTC midnight of that day. */
export function parseUTCDateOnly(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

/** Date -> "YYYY-MM-DD", read using UTC fields. */
export function formatUTCDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** "HH:MM" -> Date on the 1970-01-01 epoch day, at that UTC time. */
export function timeStringToUTCDate(timeStr: string): Date {
  return new Date(`1970-01-01T${timeStr}:00.000Z`);
}

/** Date -> "HH:MM", read using UTC fields. */
export function formatUTCTime(date: Date): string {
  return date.toISOString().slice(11, 16);
}

/**
 * Monday 00:00:00 UTC (inclusive) through the following Monday (exclusive)
 * for the ISO week containing `date`.
 */
export function getIsoWeekRangeUTC(date: Date): { start: Date; end: Date } {
  const day = date.getUTCDay(); // 0 = Sunday .. 6 = Saturday
  const diffToMonday = (day + 6) % 7; // days since the most recent Monday
  const start = new Date(date);
  start.setUTCDate(date.getUTCDate() - diffToMonday);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 7);
  return { start, end };
}
