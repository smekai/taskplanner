import type { Task } from '../../../../../src/core/model/task.js';
import { scheduleFiredSince } from '../../../../../src/core/util/cron.js';

export const DUE_CHECK_INTERVAL_MS = 60_000;

export function watchDueFlags(
  tasks: () => Iterable<Task>,
  rerender: () => void,
): { dispose: () => void } {
  let checkedAt = new Date();
  const timer = setInterval(() => {
    const now = new Date();
    if (scheduleFiredSince(tasks(), checkedAt, now)) rerender();
    checkedAt = now;
  }, DUE_CHECK_INTERVAL_MS);
  return { dispose: () => clearInterval(timer) };
}
