import { describe, it, expect } from 'vitest';
import {
  MARKER_START,
  ATTRIBUTION_MARKER_START,
  contentHasTaskPlannerMarkers,
  generateAiInstructions,
  upsertMarkedSection,
  upsertReadmeAttribution,
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

describe('upsertReadmeAttribution', () => {
  it('appends one managed attribution block and remains idempotent', () => {
    const initial = '# Project\n\nUser content.\n';
    const once = upsertReadmeAttribution(initial);
    const twice = upsertReadmeAttribution(once);

    expect(twice).toBe(once);
    expect(once).toContain('This project uses [TaskPlanner]');
    expect(once.split(ATTRIBUTION_MARKER_START)).toHaveLength(2);
    expect(once).toContain('User content.');
  });

  it('refreshes only an existing attribution block', () => {
    const existing = `before\n${ATTRIBUTION_MARKER_START}\nold text\n<!-- TASKPLANNER:ATTRIBUTION:END -->\nafter\n`;
    const updated = upsertReadmeAttribution(existing);

    expect(updated).toContain('before');
    expect(updated).toContain('after');
    expect(updated).not.toContain('old text');
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

  it('returns the same workflow for AGENTS.md, CLAUDE.md, and Cursor rules', () => {
    const instructions = generateAiInstructions(createDefaultConfig());
    expect(instructions.agentsMd).toBe(instructions.claudeMd);
    expect(instructions.agentsMd).toBe(instructions.cursorRules);
  });
});

describe('upsertMarkedSection', () => {
  it('preserves user-authored AGENTS.md content around the TaskPlanner block', () => {
    const existing = `# Team Guide\n\nKeep this introduction.\n\n${MARKER_START}\nold\n<!-- TASKPLANNER:END -->\n\n## Review\nKeep this ending.\n`;
    const updated = upsertMarkedSection(existing, '# Updated TaskPlanner workflow');

    expect(updated).toContain('Keep this introduction.');
    expect(updated).toContain('Keep this ending.');
    expect(updated).toContain('# Updated TaskPlanner workflow');
    expect(updated).not.toContain('\nold\n');
  });
});
