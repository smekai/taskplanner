import { describe, expect, it } from 'vitest';
import { buildCodexDeepLink } from '../../core/ai/codexDeepLink.js';

describe('buildCodexDeepLink', () => {
  it('prefills the TaskPlanner plugin, prompt, and absolute workspace path', () => {
    const link = buildCodexDeepLink(
      'Implement TASK-038: support spaces & Unicode — ready',
      'C:\\Development\\My Project',
    );
    const url = new URL(link);

    expect(url.protocol).toBe('codex:');
    expect(url.hostname).toBe('new');
    expect(url.searchParams.get('path')).toBe('C:\\Development\\My Project');
    expect(url.searchParams.get('prompt')).toContain(
      '[@TaskPlanner](plugin://taskplanner@refined-taskplanner)',
    );
    expect(url.searchParams.get('prompt')).toContain('spaces & Unicode — ready');
  });
});
