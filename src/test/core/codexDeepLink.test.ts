import { describe, expect, it } from 'vitest';
import { buildCodexDeepLink } from '../../core/ai/codexDeepLink.js';

describe('buildCodexDeepLink', () => {
  it('prefills Plan mode, the TaskPlanner plugin, prompt, and workspace path', () => {
    const link = buildCodexDeepLink(
      'Implement TASK-038: support spaces & Unicode — ready',
      'C:\\Development\\My Project',
      { planMode: true },
    );
    const url = new URL(link);
    const prompt = url.searchParams.get('prompt');

    expect(url.protocol).toBe('codex:');
    expect(url.hostname).toBe('new');
    expect(url.searchParams.get('path')).toBe('C:\\Development\\My Project');
    expect(prompt).toMatch(/^\/plan /);
    expect(prompt).toContain('[@TaskPlanner](plugin://taskplanner@refined-taskplanner)');
    expect(prompt).toContain('spaces & Unicode — ready');
  });

  it('omits Plan mode when planning is disabled', () => {
    const link = buildCodexDeepLink('Implement TASK-038', 'C:\\Development\\Project');
    const prompt = new URL(link).searchParams.get('prompt');

    expect(prompt).not.toMatch(/^\/plan /);
    expect(prompt).toMatch(/^\[@TaskPlanner\]\(plugin:\/\/taskplanner@refined-taskplanner\) /);
  });
});
