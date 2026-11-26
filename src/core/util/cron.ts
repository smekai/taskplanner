import { parseTimestamp } from './time.js';

export interface CronSchedule {
  minutes: boolean[];
  hours: boolean[];
  daysOfMonth: boolean[];
  months: boolean[];
  daysOfWeek: boolean[];
  dayOfMonthRestricted: boolean;
  dayOfWeekRestricted: boolean;
}

interface FieldSpec {
  min: number;
  max: number;
  names?: readonly string[];
}

const MINUTE: FieldSpec = { min: 0, max: 59 };
const HOUR: FieldSpec = { min: 0, max: 23 };
const DAY_OF_MONTH: FieldSpec = { min: 1, max: 31 };
const MONTH: FieldSpec = {
  min: 1,
  max: 12,
  names: ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'],
};
const DAY_OF_WEEK: FieldSpec = {
  min: 0,
  max: 7,
  names: ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'],
};

const MACROS: Record<string, string> = {
  '@yearly': '0 0 1 1 *',
  '@annually': '0 0 1 1 *',
  '@monthly': '0 0 1 * *',
  '@weekly': '0 0 * * 0',
  '@daily': '0 0 * * *',
  '@midnight': '0 0 * * *',
  '@hourly': '0 * * * *',
};

// WHY: some schedules fire rarely (29 February skips 2100; a `*/n` day field ANDed with a weekday can skip decades), so the search spans the 28-year calendar cycle.
const SEARCH_DAYS = 366 * 29;
const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 86_400_000;

function valueOf(token: string, spec: FieldSpec): number | undefined {
  if (/^\d+$/.test(token)) {
    const value = Number(token);
    return value >= spec.min && value <= spec.max ? value : undefined;
  }
  const index = spec.names?.indexOf(token.toUpperCase()) ?? -1;
  return index >= 0 ? index + (spec === MONTH ? 1 : 0) : undefined;
}

function parseField(field: string, spec: FieldSpec): boolean[] | undefined {
  const allowed = new Array<boolean>(spec.max + 1).fill(false);
  for (const item of field.split(',')) {
    const match = /^([^/]+)(?:\/(\d+))?$/.exec(item);
    if (!match) return undefined;
    const [, range, stepText] = match;
    if (range === undefined) return undefined;
    const step = stepText === undefined ? 1 : Number(stepText);
    if (step < 1) return undefined;

    let from: number | undefined;
    let to: number | undefined;
    if (range === '*') {
      from = spec.min;
      to = spec.max;
    } else {
      const [low = '', high, ...extra] = range.split('-');
      if (extra.length > 0) return undefined;
      from = valueOf(low, spec);
      to = high !== undefined ? valueOf(high, spec) : stepText ? spec.max : from;
    }
    if (from === undefined || to === undefined || from > to) return undefined;

    for (let value = from; value <= to; value += step) allowed[value] = true;
  }
  return allowed;
}

export function parseCron(expression: string | undefined): CronSchedule | undefined {
  const trimmed = expression?.trim() ?? '';
  const source = MACROS[trimmed.toLowerCase()] ?? trimmed;
  const [minuteField, hourField, dayField, monthField, weekdayField, ...extra] =
    source.split(/\s+/);
  if (weekdayField === undefined || extra.length > 0) return undefined;

  const minutes = parseField(minuteField ?? '', MINUTE);
  const hours = parseField(hourField ?? '', HOUR);
  const daysOfMonth = parseField(dayField ?? '', DAY_OF_MONTH);
  const months = parseField(monthField ?? '', MONTH);
  const daysOfWeek = parseField(weekdayField, DAY_OF_WEEK);
  if (!minutes || !hours || !daysOfMonth || !months || !daysOfWeek) return undefined;

  if (daysOfWeek[7]) daysOfWeek[0] = true;
  return {
    minutes,
    hours,
    daysOfMonth,
    months,
    daysOfWeek,
    dayOfMonthRestricted: !dayField?.startsWith('*'),
    dayOfWeekRestricted: !weekdayField.startsWith('*'),
  };
}

export function isValidCron(expression: string | undefined): boolean {
  return parseCron(expression) !== undefined;
}

function dayMatches(schedule: CronSchedule, day: Date): boolean {
  if (!schedule.months[day.getUTCMonth() + 1]) return false;
  const byMonthDay = schedule.daysOfMonth[day.getUTCDate()] === true;
  const byWeekDay = schedule.daysOfWeek[day.getUTCDay()] === true;
  // WHY: cron's rule; when both day fields are restricted a day matching either one fires.
  if (schedule.dayOfMonthRestricted && schedule.dayOfWeekRestricted) return byMonthDay || byWeekDay;
  return byMonthDay && byWeekDay;
}

function lastAllowedAtOrBelow(allowed: boolean[], limit: number): number | undefined {
  for (let value = limit; value >= 0; value--) {
    if (allowed[value]) return value;
  }
  return undefined;
}

export function previousFire(schedule: CronSchedule, now: Date): Date | undefined {
  const flooredNow = Math.floor(now.getTime() / MS_PER_MINUTE) * MS_PER_MINUTE;
  const startOfToday = Math.floor(flooredNow / MS_PER_DAY) * MS_PER_DAY;

  for (let back = 0; back <= SEARCH_DAYS; back++) {
    const dayStart = startOfToday - back * MS_PER_DAY;
    if (!dayMatches(schedule, new Date(dayStart))) continue;

    const today = back === 0;
    const limit = new Date(flooredNow);
    let hour = lastAllowedAtOrBelow(schedule.hours, today ? limit.getUTCHours() : 23);
    while (hour !== undefined) {
      const minuteLimit = today && hour === limit.getUTCHours() ? limit.getUTCMinutes() : 59;
      const minute = lastAllowedAtOrBelow(schedule.minutes, minuteLimit);
      if (minute !== undefined) {
        return new Date(dayStart + hour * 3_600_000 + minute * MS_PER_MINUTE);
      }
      hour = lastAllowedAtOrBelow(schedule.hours, hour - 1);
    }
  }
  return undefined;
}

export function scheduleFiredSince(
  tasks: Iterable<{ repeats?: string }>,
  since: Date,
  now: Date,
): boolean {
  for (const task of tasks) {
    const schedule = parseCron(task.repeats);
    const fired = schedule ? previousFire(schedule, now) : undefined;
    if (fired !== undefined && fired.getTime() > since.getTime()) return true;
  }
  return false;
}

export function isDue(
  repeats: string | undefined,
  lastRun: string | undefined,
  now = new Date(),
): boolean {
  const schedule = parseCron(repeats);
  if (!schedule) return false;
  const fired = previousFire(schedule, now);
  if (!fired) return false;
  const last = parseTimestamp(lastRun);
  return last === null || fired.getTime() > last.getTime();
}
