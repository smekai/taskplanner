import { describe, it, expect } from 'vitest';
import {
  MARKER_START,
  contentHasTaskPlannerMarkers,
  generateAiInstructions,
} from '../../core/ai/aiInstructions.js';
import { createDefaultConfig } from '../../core/model/config.js';

describe('contentHasTaskPlannerMarkers', () => {
  it('returns false for empty or unrelated content', () => {
    expect(contentHasTaskPlannerMarkers('')).toBe(false);
    expect(contentHasTaskPlannerMarkers('# Hello')).toBe(false);
  });

  it('returns true when marker start is present', () => {
    expect(contentHasTaskPlannerMarkers(`x\n${MARKER_START}\ny`)).toBe(true);
  });
});

describe('generateAiInstructions', () => {
  it('includes WORK_LOG.md in structure and mandatory checklist', () => {
    const config = createDefaultConfig();
    config.aiPlanRequired = true;
    const { cursorRules } = generateAiInstructions(config);
    expect(cursorRules).toContain('WORK_LOG.md');
    expect(cursorRules).toContain('### Work Log');
    expect(cursorRules).toContain('**Work log:**');
  });
});
