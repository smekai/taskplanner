const TIMESTAMP_RE = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?$/;

const MS_PER_DAY = 86_400_000;

/** Rejects impossible dates such as 2026-02-31, which Date.UTC would silently roll over. */
function isRealDate(date: Date, month: number, day: number): boolean {
  return date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** Parses `YYYY-MM-DD` or `YYYY-MM-DD HH:MM` as UTC. Returns null for anything else. */
export function parseTimestamp(value: string | undefined): Date | null {
  const match = TIMESTAMP_RE.exec(value?.trim() ?? '');
  if (!match) return null;

  const [, year, month, day, hour = '0', minute = '0'] = match;
  const date = new Date(Date.UTC(+year, +month - 1, +day, +hour, +minute));
  return isRealDate(date, +month, +day) ? date : null;
}

export function currentTimestamp(now = new Date()): string {
  return now.toISOString().replace('T', ' ').slice(0, 16);
}

export function currentDate(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function isWaiting(waitingUntil: string | undefined, now = new Date()): boolean {
  const until = parseTimestamp(waitingUntil);
  return until !== null && currentDate(until) > currentDate(now);
}

export function daysSince(value: string | undefined, now = new Date()): number | null {
  const then = parseTimestamp(value);
  return then === null ? null : (now.getTime() - then.getTime()) / MS_PER_DAY;
}
