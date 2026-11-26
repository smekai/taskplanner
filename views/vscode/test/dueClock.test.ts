import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DUE_CHECK_INTERVAL_MS, watchDueFlags } from '../src/views/webview/dueClock.js';
import { Priority, Task } from '../../../src/core/model/task.js';

const hourly: Task = {
  id: 'TASK-001',
  title: 'Hourly check',
  description: '',
  priority: Priority.P2,
  tags: [],
  repeats: '@hourly',
};

// An open panel computes `due` once per render; this clock is what re-renders it when a schedule fires.
describe('watchDueFlags', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-25T10:58:30Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('re-renders once the next fire passes, with no board change', () => {
    // Arrange
    const rerender = vi.fn();
    const watch = watchDueFlags(() => [hourly], rerender);

    // Act
    vi.advanceTimersByTime(2 * DUE_CHECK_INTERVAL_MS);

    // Assert
    expect(rerender).toHaveBeenCalledTimes(1);
    watch.dispose();
  });

  it('leaves the panel alone while no schedule has fired', () => {
    // Arrange
    const rerender = vi.fn();
    const watch = watchDueFlags(() => [hourly], rerender);

    // Act
    vi.advanceTimersByTime(DUE_CHECK_INTERVAL_MS);

    // Assert
    expect(rerender).not.toHaveBeenCalled();
    watch.dispose();
  });
});
