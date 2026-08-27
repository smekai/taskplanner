/** Current timestamp in `YYYY-MM-DD HH:MM` form used in task `Updated:` metadata. */
export function currentTimestamp(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, 16);
}

/** Today as `YYYY-MM-DD`, the granularity `Waiting until:` is compared at. */
export function currentDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * True when a task is waiting on a date that has not arrived. Comparison is date-only and string
 * based, which is safe for `YYYY-MM-DD` and avoids timezone drift from parsing into a Date.
 * A task waiting until today counts as available.
 *
 * An unparseable value is treated as not waiting: a typo should not silently hide work forever.
 */
export function isWaiting(waitingUntil: string | undefined, today = currentDate()): boolean {
  if (!waitingUntil) return false;
  const date = waitingUntil.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  return date > today;
}
