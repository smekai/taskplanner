/** Current timestamp in `YYYY-MM-DD HH:MM` form used in task `Updated:` metadata. */
export function currentTimestamp(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, 16);
}

/**
 * Today as `YYYY-MM-DD` in the **local** calendar, which is what a person means by a due date.
 * Deriving it from UTC would make a task available early west of UTC and late east of it.
 */
export function currentDate(now = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

/**
 * Parse a strict `YYYY-MM-DD`, returning null for anything else. The round-trip check rejects
 * impossible dates such as `2026-99-99` and `2026-02-31`, which a regexp alone would accept.
 */
function asCalendarDate(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const roundTrips =
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  return roundTrips ? value : null;
}

/**
 * True when a task is waiting on a date that has not arrived. Both sides are validated calendar
 * dates, so the comparison is a plain lexical one on `YYYY-MM-DD` with no timezone arithmetic.
 * A task waiting until today counts as available.
 *
 * An unusable value is treated as not waiting: a typo must not silently hide work forever. That is
 * why the date is validated rather than pattern-matched — `2026-99-99` would otherwise pass the
 * shape check and suppress the task indefinitely, which is exactly what this promises not to do.
 */
export function isWaiting(waitingUntil: string | undefined, today = currentDate()): boolean {
  if (!waitingUntil) return false;

  // A trailing time is allowed because `**Updated:**` in the same files is written as
  // `YYYY-MM-DD HH:mm`, so a date with extra precision is a reasonable thing to type. Anything
  // glued directly to the date is not, and is rejected rather than silently truncated.
  const match = /^(\d{4}-\d{2}-\d{2})(?:\s.*)?$/.exec(waitingUntil.trim());
  const date = match ? asCalendarDate(match[1]) : null;
  if (date === null) return false;
  return date > today;
}
