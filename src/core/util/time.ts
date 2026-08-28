const TIMESTAMP_RE = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?$/;

const MS_PER_DAY = 86_400_000;

export function parseTimestamp(value: string | undefined): Date | null {
  const match = TIMESTAMP_RE.exec(value?.trim() ?? '');
  if (!match) return null;

  const [year, month, day, hour, minute] = match.slice(1).map((part) => Number(part ?? 0));
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute));

  const survivesRoundTrip =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day &&
    date.getUTCHours() === hour &&
    date.getUTCMinutes() === minute;

  return survivesRoundTrip ? date : null;
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
