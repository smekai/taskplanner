import { describe, it, expect } from 'vitest';
import {
  MARKER_START,
  ATTRIBUTION_MARKER_START,
  contentHasTaskPlannerMarkers,
  generateAiInstructions,
  upsertMcpServerConfig,
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

  it('says nothing about a Plan when aiPlanRequired is false', () => {
    const config = { ...createDefaultConfig(), aiPlanRequired: false };
    const { claudeMd } = generateAiInstructions(config);
    expect(claudeMd).not.toContain('### Plan');
    expect(claudeMd).not.toContain('Planning Requirement');
    // The checklist bullet used to survive the flag by deferring to the config file.
    expect(claudeMd).not.toContain('aiPlanRequired');
  });

  it('keeps the Plan requirement when aiPlanRequired is true', () => {
    const config = { ...createDefaultConfig(), aiPlanRequired: true };
    const { claudeMd } = generateAiInstructions(config);
    expect(claudeMd).toContain('### Planning Requirement');
    expect(claudeMd).toContain('- **Plan:** The `### Plan` block must exist');
    expect(claudeMd).toContain('trim `### Plan` to a done-summary');
  });

  it('names the MCP tools and prefers them over hand-editing', () => {
    const { claudeMd } = generateAiInstructions(createDefaultConfig());
    for (const tool of [
      'taskplanner_list',
      'taskplanner_board',
      'taskplanner_get',
      'taskplanner_create',
      'taskplanner_move',
      'taskplanner_update',
    ]) {
      expect(claudeMd).toContain(tool);
    }
    expect(claudeMd).toContain('do not hand-edit these files');
  });

  it('still requires the task to move, with hand-editing as the fallback', () => {
    const { claudeMd } = generateAiInstructions(createDefaultConfig());
    expect(claudeMd).toContain('must actually **move**');
    expect(claudeMd).toContain('otherwise cut the section');
    // The old wording made cut-and-paste the method rather than the fallback.
    expect(claudeMd).not.toContain('by cutting it from the source file and pasting it');
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

describe('upsertMcpServerConfig', () => {
  it('creates a config when there is no file yet', () => {
    const result = upsertMcpServerConfig('');
    expect(result).not.toBeNull();
    const parsed = JSON.parse(result!);
    expect(parsed.mcpServers.taskplanner).toEqual({
      command: 'npx',
      args: ['-y', '@smekai/taskplanner'],
    });
  });

  it('carries no absolute path, since the file is committed and shared', () => {
    const result = upsertMcpServerConfig('')!;
    expect(result).not.toMatch(/[A-Za-z]:\\|\/Users\/|\/home\//);
  });

  it('preserves other servers and unknown top-level fields', () => {
    const existing = JSON.stringify({
      $schema: 'https://example.invalid/schema.json',
      mcpServers: { other: { command: 'node', args: ['other.js'] } },
    });
    const parsed = JSON.parse(upsertMcpServerConfig(existing)!);
    expect(parsed.mcpServers.other).toEqual({ command: 'node', args: ['other.js'] });
    expect(parsed.mcpServers.taskplanner).toBeDefined();
    expect(parsed.$schema).toBe('https://example.invalid/schema.json');
  });

  it('is idempotent', () => {
    const once = upsertMcpServerConfig('')!;
    expect(upsertMcpServerConfig(once)).toBe(once);
  });

  it('refuses to touch a file it cannot parse', () => {
    expect(upsertMcpServerConfig('{ not json')).toBeNull();
    expect(upsertMcpServerConfig('[1,2,3]')).toBeNull();
  });
});
