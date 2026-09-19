import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { segmentBoard } from '../../core/parser/boardSegments.js';

// The one invariant everything else rests on: segmenting covers every byte and nothing else.
// If concatenating the segments does not give the file back, no write path built on them can
// be lossless either.
function coversEveryByte(content: string): boolean {
  return segmentBoard(content).reduce((acc, segment) => acc + segment.raw, '') === content;
}

const BOARDS = fs
  .readdirSync(path.join(process.cwd(), '.tasks'))
  .filter((name) => name.endsWith('.md'))
  .map((name) => path.join(process.cwd(), '.tasks', name));

describe('segmentBoard covers every byte', () => {
  it.each(BOARDS)('%s round-trips', (file) => {
    expect(coversEveryByte(fs.readFileSync(file, 'utf8'))).toBe(true);
  });

  it.each([
    ['empty file', ''],
    ['heading only', '# Backlog\n'],
    ['no trailing newline', '# Backlog\n\n## TASK-001: T\n**Priority:** P1\n\n---'],
    ['CRLF board', '# Backlog\r\n\r\n## TASK-001: T\r\n**Priority:** P1\r\n\r\n---\r\n'],
    ['unterminated final task', '# Backlog\n\n## TASK-001: T\n**Priority:** P1\n'],
    ['missing middle separator', '# B\n\n## TASK-001: A\n\n## TASK-002: B\n\n---\n'],
    ['prose and comments', '# B\n\nProse.\n\n<!-- keep -->\n## TASK-001: A\n\n---\n\nTail.\n'],
    ['section the parser refuses', '# B\n\n## task-002: lowercase\n**Priority:** P2\n\n---\n'],
    ['no tasks at all', '# B\n\nJust prose.\n'],
  ])('%s', (_name, content) => {
    expect(coversEveryByte(content)).toBe(true);
  });
});

describe('segmentBoard boundaries', () => {
  it('keeps an unterminated task out of its neighbour', () => {
    const segments = segmentBoard('# B\n\n## TASK-001: A\nbody\n\n## TASK-002: B\n\n---\n');
    const tasks = segments.filter((s) => s.kind === 'task');

    expect(tasks.map((s) => s.id)).toEqual(['TASK-001', 'TASK-002']);
    expect(tasks[0].raw).not.toContain('TASK-002');
  });

  it('treats a heading the parser refuses as text, not a task', () => {
    const segments = segmentBoard('# B\n\n## task-002: lowercase\n\n---\n');

    expect(segments.every((s) => s.kind === 'text')).toBe(true);
  });
});
