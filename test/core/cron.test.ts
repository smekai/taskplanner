import { describe, it, expect } from 'vitest';
import {
  isDue,
  isValidCron,
  parseCron,
  previousFire,
  scheduleFiredSince,
} from '../../src/core/util/cron.js';

const at = (iso: string) => new Date(`${iso}Z`);
const prev = (expression: string, now: string) => {
  const schedule = parseCron(expression);
  if (!schedule) throw new Error(`invalid in test: ${expression}`);
  return previousFire(schedule, at(now))?.toISOString().slice(0, 16);
};

describe('parseCron', () => {
  it.each([
    '0 7 * * *',
    '*/15 * * * *',
    '0 9-17/2 * * 1-5',
    '30 6 1,15 * *',
    '0 0 * JAN,jul sun',
    '0 0 * * 7',
    '5/10 * * * *',
    '@daily',
    '  @Weekly  ',
  ])('accepts %s', (expression) => {
    expect(isValidCron(expression)).toBe(true);
  });

  it.each([
    '',
    undefined,
    'daily',
    '0 7 * *',
    '0 7 * * * *',
    '60 * * * *',
    '* 24 * * *',
    '* * 0 * *',
    '* * * 13 *',
    '* * * * 8',
    '*/0 * * * *',
    '10-5 * * * *',
    '1-2-3 * * * *',
    '* * * FOO *',
    '@reboot',
  ])('rejects %s', (expression) => {
    expect(isValidCron(expression)).toBe(false);
  });
});

describe('previousFire', () => {
  it('finds today when the time has passed, yesterday when it has not', () => {
    expect(prev('0 7 * * *', '2026-11-25T07:30')).toBe('2026-11-25T07:00');
    expect(prev('0 7 * * *', '2026-11-25T06:59')).toBe('2026-11-24T07:00');
  });

  it('counts the current minute as fired', () => {
    expect(prev('0 7 * * *', '2026-11-25T07:00:45')).toBe('2026-11-25T07:00');
  });

  it('steps through hours and minutes', () => {
    expect(prev('*/15 * * * *', '2026-11-25T10:44')).toBe('2026-11-25T10:30');
    expect(prev('0 9-17/2 * * *', '2026-11-25T12:00')).toBe('2026-11-25T11:00');
    expect(prev('5/10 * * * *', '2026-11-25T10:04')).toBe('2026-11-25T09:55');
  });

  it('honours weekdays, Sunday as 0 or 7', () => {
    // 2026-11-25 is a Wednesday.
    expect(prev('0 9 * * 1-5', '2026-11-29T12:00')).toBe('2026-11-27T09:00');
    expect(prev('0 9 * * 7', '2026-11-25T12:00')).toBe('2026-11-22T09:00');
    expect(prev('0 9 * * sun', '2026-11-25T12:00')).toBe('2026-11-22T09:00');
  });

  it('crosses month and year boundaries', () => {
    expect(prev('0 0 1 * *', '2026-11-25T00:00')).toBe('2026-11-01T00:00');
    expect(prev('@yearly', '2026-11-25T00:00')).toBe('2026-01-01T00:00');
    expect(prev('0 0 31 * *', '2026-11-25T00:00')).toBe('2026-10-31T00:00');
  });

  it('fires on either day field when both are restricted, as cron does', () => {
    // The 1st of the month or any Monday: 2026-11-23 is the Monday before the 25th.
    expect(prev('0 0 1 * 1', '2026-11-25T12:00')).toBe('2026-11-23T00:00');
  });

  it('requires both when one day field starts with *', () => {
    expect(prev('0 0 */2 * 1', '2026-11-25T12:00')).toBe('2026-11-23T00:00');
    expect(prev('0 0 */2 * 1', '2026-11-22T12:00')).toBe('2026-11-09T00:00');
  });

  it('reaches back years for 29 February', () => {
    expect(prev('0 0 29 2 *', '2026-11-25T00:00')).toBe('2024-02-29T00:00');
  });

  it('gives nothing for a date that never exists', () => {
    expect(prev('0 0 31 2 *', '2026-11-25T00:00')).toBeUndefined();
  });
});

describe('isDue', () => {
  const NOW = at('2026-11-25T09:00');

  it('is due when the schedule fired after the last run', () => {
    expect(isDue('0 7 * * *', '2026-11-24 07:05', NOW)).toBe(true);
  });

  it('is not due when the last run came at or after the latest fire', () => {
    expect(isDue('0 7 * * *', '2026-11-25 07:00', NOW)).toBe(false);
    expect(isDue('0 7 * * *', '2026-11-25 07:12', NOW)).toBe(false);
  });

  it('is due when it has never run', () => {
    expect(isDue('0 7 * * *', undefined, NOW)).toBe(true);
    expect(isDue('0 7 * * *', 'not a date', NOW)).toBe(true);
  });

  it('is never due without a usable schedule', () => {
    expect(isDue(undefined, undefined, NOW)).toBe(false);
    expect(isDue('every morning', undefined, NOW)).toBe(false);
    expect(isDue('0 0 31 2 *', undefined, NOW)).toBe(false);
  });

  it('reads a date-only last run as midnight UTC', () => {
    expect(isDue('0 7 * * *', '2026-11-25', NOW)).toBe(true);
  });
});

// Views re-render when a schedule fires even though no board file changed.
describe('scheduleFiredSince', () => {
  const BUILT_AT = at('2026-11-25T10:30');
  const HOURLY = [{ repeats: '@hourly' }];

  it('is true once the clock passes the next fire', () => {
    expect(scheduleFiredSince(HOURLY, BUILT_AT, at('2026-11-25T11:00:30'))).toBe(true);
  });

  it('is false while no schedule has fired since', () => {
    expect(scheduleFiredSince(HOURLY, BUILT_AT, at('2026-11-25T10:59'))).toBe(false);
  });

  it('ignores tasks without a usable schedule', () => {
    const tasks = [{}, { repeats: 'every morning' }];

    expect(scheduleFiredSince(tasks, BUILT_AT, at('2026-11-26T00:00'))).toBe(false);
  });
});
