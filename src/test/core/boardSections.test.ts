import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { splitSections } from '../../core/parser/boardSections.js';

// The invariant every later layer rests on. If the sections do not concatenate back to the file,
// no write path built on them can be lossless, and no amount of testing above it would say so.
const coversEveryByte = (content: string) =>
  splitSections(content).reduce((acc, section) => acc + section.raw, '') === content;

const BOARDS = fs
  .readdirSync(path.join(process.cwd(), '.tasks'))
  .filter((name) => name.endsWith('.md'))
  .map((name) => path.join(process.cwd(), '.tasks', name));

describe('splitSections covers every byte', () => {
  it.each(BOARDS)('%s', (file) => {
    expect(coversEveryByte(fs.readFileSync(file, 'utf8'))).toBe(true);
  });

  it.each([
    ['empty file', ''],
    ['heading only', '# Backlog\n'],
    ['no trailing newline', '# B\n\n## TASK-001: T\n**Priority:** P1\n\n---'],
    ['CRLF', '# B\r\n\r\n## TASK-001: T\r\n**Priority:** P1\r\n\r\n---\r\n'],
    ['BOM', '﻿# B\n\n## TASK-001: T\n\n---\n'],
    ['unterminated final task', '# B\n\n## TASK-001: T\n**Priority:** P1\n'],
    ['missing middle separator', '# B\n\n## TASK-001: A\n\n## TASK-002: B\n\n---\n'],
    ['prose and comments', '# B\n\nProse.\n\n<!-- keep -->\n## TASK-001: A\n\n---\n\nTail.\n'],
    ['a section the parser refuses', '# B\n\n## task-002: lowercase\n**Priority:** P2\n\n---\n'],
    ['no tasks at all', '# B\n\nJust prose.\n'],
    ['consecutive separators', '# B\n\n---\n---\n\n## TASK-001: A\n\n---\n'],
  ])('%s', (_name, content) => {
    expect(coversEveryByte(content)).toBe(true);
  });
});

describe('section boundaries', () => {
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
});
