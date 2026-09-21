import { describe, it, expect } from 'vitest';
import { splitSections } from '../../core/parser/fileSections.js';

describe('file section boundaries', () => {
  it('an unterminated task ends where the next one begins', () => {
    const sections = splitSections('# B\n\n## TASK-001: A\nbody\n\n## TASK-002: B\n\n---\n');
    const tasks = sections.filter((s) => s.kind === 'task');

    expect(tasks.map((s) => s.id)).toEqual(['TASK-001', 'TASK-002']);
    expect(tasks[0].raw).not.toContain('TASK-002');
  });

  it('a heading the format refuses is text, not a task', () => {
    const sections = splitSections('# B\n\n## task-002: lowercase\n\n---\n');

    expect(sections.every((s) => s.kind === 'text')).toBe(true);
  });

  it('reports the line each section starts on', () => {
    const sections = splitSections('# B\n\nProse.\n\n## TASK-001: A\n\n---\n');

    expect(sections.map((s) => ({ kind: s.kind, line: s.line }))).toEqual([
      { kind: 'text', line: 1 },
      { kind: 'task', line: 5 },
    ]);
  });

  it('reports the line of text that follows a closed section', () => {
    const sections = splitSections('## TASK-001: A\n\n---\n\nTail.\n');

    expect(sections.map((s) => ({ kind: s.kind, line: s.line }))).toEqual([
      { kind: 'task', line: 1 },
      { kind: 'text', line: 4 },
    ]);
  });

  it('keeps the separator with the task it closes', () => {
    const [task] = splitSections('## TASK-001: A\n**Priority:** P1\n\n---\n').filter(
      (s) => s.kind === 'task',
    );

    expect(task.raw.endsWith('---\n')).toBe(true);
  });

  it('consecutive separators stay as text sections', () => {
    const sections = splitSections('# B\n\n---\n---\n\n## TASK-001: A\n\n---\n');

    expect(sections.filter((s) => s.kind === 'task')).toHaveLength(1);
    expect(sections.some((s) => s.kind === 'text' && s.raw.includes('---'))).toBe(true);
  });
});
