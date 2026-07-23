import { describe, expect, it } from 'vitest';
import { shouldAutomateCursorPlanMode } from '../../core/ai/planMode.js';

describe('shouldAutomateCursorPlanMode', () => {
  it('enables Cursor automation only when planning and automation are enabled', () => {
    expect(shouldAutomateCursorPlanMode(true, true)).toBe(true);
    expect(shouldAutomateCursorPlanMode(false, true)).toBe(false);
    expect(shouldAutomateCursorPlanMode(true, false)).toBe(false);
    expect(shouldAutomateCursorPlanMode(false, false)).toBe(false);
  });
});
