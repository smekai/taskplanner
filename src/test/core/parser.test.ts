import { describe, it, expect } from 'vitest';
import {
  parseTasks,
  findTaskLineNumber,
  countTaskHeadings,
  maxTaskIdNumber,
} from '../../core/parser/taskParser.js';
import { serializeTask } from '../../core/parser/taskSerializer.js';
import {
  isWaiting,
  currentDate,
  currentTimestamp,
  parseTimestamp,
  daysSince,
} from '../../core/util/time.js';
import { Priority } from '../../core/model/task.js';

describe('parseTasks', () => {
  it('parses a single task', () => {
    const content = `# Backlog

## TASK-001: Implement auth
**Priority:** P1
**Tags:** auth, backend

Build OAuth2 authentication.

---
`;
    const { tasks } = parseTasks(content);
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toEqual({
      id: 'TASK-001',
      title: 'Implement auth',
      priority: Priority.P1,
      tags: ['auth', 'backend'],
      epic: undefined,
      description: 'Build OAuth2 authentication.',
    });
    expect(parseTasks(content).warnings).toHaveLength(0);
  });

  it('parses multiple tasks', () => {
    const content = `# Backlog

## TASK-001: First task
**Priority:** P1
**Tags:** tag1

Description one.

---

## TASK-002: Second task
**Priority:** P3
**Tag:** tag2

Description two.

---
`;
    const { tasks } = parseTasks(content);
    expect(tasks).toHaveLength(2);
    expect(tasks[0].id).toBe('TASK-001');
    expect(tasks[1].id).toBe('TASK-002');
    expect(tasks[1].tags).toEqual(['tag2']);
  });

  it('parses task with no tags', () => {
    const content = `# Backlog

## TASK-010: Simple task
**Priority:** P4

Just a simple task.

---
`;
    const { tasks } = parseTasks(content);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].tags).toEqual([]);
    expect(tasks[0].priority).toBe(Priority.P4);
  });

  it('parses task with no description', () => {
    const content = `# Backlog

## TASK-001: No description
**Priority:** P2

---
`;
    const { tasks } = parseTasks(content);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].description).toBe('');
  });

  // Every field is readable on its own line and inside the grouped line; these used to be six
  // separate tests, one per field per layout.
  const FIELDS = [
    ['Tags', 'a, b', 'tags', ['a', 'b']],
    ['Tag', 'solo', 'tags', ['solo']],
    ['Epic', 'infrastructure', 'epic', 'infrastructure'],
    ['Assignee', 'alice', 'assignee', 'alice'],
    ['Updated', '2026-03-22 19:14', 'updatedAt', '2026-03-22 19:14'],
    ['Waiting until', '2026-12-01', 'waitingUntil', '2026-12-01'],
  ] as const;

  it.each(FIELDS)('**%s:** on its own line', (label, raw, field, expected) => {
    const { tasks } = parseTasks(
      `## TASK-001: T\n**Priority:** P1\n**${label}:** ${raw}\n\nBody.\n\n---\n`,
    );

    expect(tasks[0][field]).toEqual(expected);
  });

  it.each(FIELDS)('**%s:** inside the grouped line', (label, raw, field, expected) => {
    const { tasks } = parseTasks(
      `## TASK-001: T\n**Priority:** P1 | **${label}:** ${raw}\n\nBody.\n\n---\n`,
    );

    expect(tasks[0].priority).toBe(Priority.P1);
    expect(tasks[0][field]).toEqual(expected);
  });

  it('handles an empty board', () => {
    for (const content of ['# Backlog\n', '']) {
      const { tasks, warnings } = parseTasks(content);
      expect(tasks).toHaveLength(0);
      expect(warnings).toHaveLength(0);
    }
  });

  it('handles task without separator at end of file', () => {
    const content = `# Backlog

## TASK-001: Last task
**Priority:** P1

Description without trailing separator.
`;
    const { tasks } = parseTasks(content);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].description).toBe('Description without trailing separator.');
  });

  it('parses task with plan subsection', () => {
    const content = `## TASK-001: Feature X
**Priority:** P1

Description of the task.

### Plan

- Step 1: Do A
- Step 2: Do B

---
`;
    const { tasks } = parseTasks(content);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].description).toBe('Description of the task.');
    expect(tasks[0].plan).toBe('- Step 1: Do A\n- Step 2: Do B');
  });

  it('parses task without plan subsection', () => {
    const content = `## TASK-001: No plan
**Priority:** P2

Just a description.

---
`;
    const { tasks } = parseTasks(content);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].description).toBe('Just a description.');
    expect(tasks[0].plan).toBeUndefined();
  });

  it('parses multiline description', () => {
    const content = `## TASK-001: Multiline
**Priority:** P2

Line one.

Line two with **bold**.

- List item

---
`;
    const { tasks } = parseTasks(content);
    expect(tasks[0].description).toContain('Line one.');
    expect(tasks[0].description).toContain('Line two with **bold**.');
    expect(tasks[0].description).toContain('- List item');
  });

  it('duplicate **Priority:** lines — last value wins', () => {
    const content = `## TASK-001: Dup priority
**Priority:** P1
**Priority:** P3

---

`;
    const { tasks } = parseTasks(content);
    expect(tasks[0].priority).toBe(Priority.P3);
  });

  it('parses two consecutive headings without intermediate body (both tasks)', () => {
    const content = `## TASK-001: First
## TASK-002: Second
**Priority:** P1

Only second has metadata block.

---
`;
    const { tasks } = parseTasks(content);
    expect(tasks).toHaveLength(2);
    expect(tasks[0]).toMatchObject({ id: 'TASK-001', title: 'First', priority: Priority.P4 });
    expect(tasks[1]).toMatchObject({ id: 'TASK-002', title: 'Second', priority: Priority.P1 });
  });

  // Git for Windows checks out CRLF by default. `.` excludes a carriage return and
  // `$` does not forgive one, so an unnormalized heading never matched and the board
  // read back empty — indistinguishable from a board with no tasks on it.
  describe('CRLF boards', () => {
    const LF_BOARD = `# Backlog

## TASK-001: Implement auth
**Priority:** P1 | **Tags:** auth, backend | **Assignee:** owner
**Waiting until:** 2026-12-01

Build OAuth2 authentication.

---
`;
    const crlf = (content: string) => content.replace(/\n/g, '\r\n');

    it('reads the same tasks as LF, with no warnings and no trailing carriage returns', () => {
      const { tasks, warnings } = parseTasks(crlf(LF_BOARD));

      expect(tasks).toEqual(parseTasks(LF_BOARD).tasks);
      expect(warnings).toEqual([]);
      expect(tasks[0].title).toBe('Implement auth');
      expect(tasks[0].tags).toEqual(['auth', 'backend']);
      expect(tasks[0].assignee).toBe('owner');
      expect(tasks[0].waitingUntil).toBe('2026-12-01');
    });

    it('finds a task line number in a CRLF board', () => {
      expect(findTaskLineNumber(crlf(LF_BOARD), 'TASK-001')).toBe(
        findTaskLineNumber(LF_BOARD, 'TASK-001'),
      );
    });

    it('counts task headings in a CRLF board', () => {
      expect(countTaskHeadings(crlf(LF_BOARD))).toBe(1);
    });

    it('reads the highest task id from a CRLF board', () => {
      expect(maxTaskIdNumber(crlf(LF_BOARD), 'TASK')).toBe(1);
    });
  });
});

describe('parseTasks malformed input', () => {
  // Text outside a task used to be a warning, which fired on every file heading and on any
  // prose a human wrote. It is preserved now, so there is nothing to report; the two tests
  // that asserted those warnings were deleted rather than rewritten.
  it('says nothing about prose it cannot read as a task', () => {
    const { tasks, errors, warnings } = parseTasks('# Backlog\n\nProse a human wrote.\n');

    expect(tasks).toHaveLength(0);
    expect(errors).toHaveLength(0);
    expect(warnings).toHaveLength(0);
  });

  it('keeps prose between two tasks without reporting it', () => {
    const content = [
      '## TASK-001: A',
      '**Priority:** P1',
      '',
      '---',
      '',
      'this is orphaned',
      '',
      '## TASK-002: B',
      '**Priority:** P2',
      '',
      '---',
      '',
    ].join('\n');

    const { tasks, errors, warnings } = parseTasks(content);

    expect(tasks.map((t) => t.id)).toEqual(['TASK-001', 'TASK-002']);
    expect(errors).toHaveLength(0);
    expect(warnings).toHaveLength(0);
  });

  // A line a human reads as a task but the format refuses is an error, not a warning: a whole
  // section is being dropped, and the raw text is handed back so a caller can repair it.
  it.each([
    ['a missing colon', '## TASK-001 Missing colon syntax'],
    ['a lowercase prefix', '## task-001: lower'],
    ['a space where the dash belongs', '## TASK 001: spaced'],
    ['a title that is only whitespace', '## TASK-001:     '],
  ])('reports %s as an error', (_name, heading) => {
    const { tasks, errors } = parseTasks(`${heading}\n**Priority:** P1\n\nBody.\n`);

    expect(tasks).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0].line).toBe(1);
    expect(errors[0].raw).toContain(heading.trim());
    expect(errors[0].raw).toContain('Body.');
  });

  it('reads the good tasks around a broken heading and reports only the broken one', () => {
    const content = [
      '## TASK-001: Good',
      '**Priority:** P1',
      '',
      '---',
      '',
      '## not a valid task heading',
      '',
      '## TASK-002: Also good',
      '**Priority:** P2',
      '',
      '---',
      '',
    ].join('\n');

    const { tasks, errors } = parseTasks(content);

    expect(tasks.map((t) => t.id)).toEqual(['TASK-001', 'TASK-002']);
    expect(errors).toHaveLength(1);
    expect(errors[0].raw).toContain('## not a valid task heading');
  });

  it('allows file with only separators and no tasks', () => {
    const { tasks, warnings } = parseTasks('---\n\n---\n');
    expect(tasks).toHaveLength(0);
    expect(warnings).toHaveLength(0);
  });

  it('strips BOM and parses normally', () => {
    const content = `\uFEFF# Backlog

## TASK-001: BOM
**Priority:** P1

---

`;
    const { tasks, warnings } = parseTasks(content);
    expect(warnings).toHaveLength(0);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].id).toBe('TASK-001');
  });
});

describe('countTaskHeadings', () => {
  it('counts lines matching task heading pattern', () => {
    const raw = `# Done

## TASK-001: A
**Priority:** P1

---

## TASK-002: B
**Priority:** P2

---
`;
    expect(countTaskHeadings(raw)).toBe(2);
  });

  it('returns 0 when there are no task sections', () => {
    expect(countTaskHeadings('# Title only\n')).toBe(0);
  });
});

describe('maxTaskIdNumber', () => {
  it('returns 0 when no task headings are present', () => {
    expect(maxTaskIdNumber('# Empty\n', 'TASK')).toBe(0);
    expect(maxTaskIdNumber('', 'TASK')).toBe(0);
  });

  it('returns the highest numeric suffix for the prefix', () => {
    const raw = `# Backlog

## TASK-003: C
**Priority:** P1

---

## TASK-041: A
**Priority:** P1

---

## TASK-012: B
**Priority:** P1

---
`;
    expect(maxTaskIdNumber(raw, 'TASK')).toBe(41);
  });

  it('ignores task IDs that use a different prefix', () => {
    const raw = `## BUG-999: noise
## TASK-005: real
`;
    expect(maxTaskIdNumber(raw, 'TASK')).toBe(5);
  });

  it('handles BOM at the start of the file', () => {
    const raw = `\uFEFF## TASK-007: x\n`;
    expect(maxTaskIdNumber(raw, 'TASK')).toBe(7);
  });
});

describe('findTaskLineNumber', () => {
  it('finds the correct line', () => {
    const content = `# Backlog

## TASK-001: First
**Priority:** P1

---

## TASK-002: Second
**Priority:** P2

---
`;
    expect(findTaskLineNumber(content, 'TASK-001')).toBe(3);
    expect(findTaskLineNumber(content, 'TASK-002')).toBe(8);
  });

  it('returns 1 for not found', () => {
    expect(findTaskLineNumber('# Empty\n', 'TASK-999')).toBe(1);
  });
});

describe('Waiting until', () => {
  // Field parse for both layouts is in FIELDS above; this locks the serialize hop.
  it('survives a round-trip through the serializer', () => {
    const markdown = [
      '# Next',
      '',
      '## TASK-001: Blocked on an external quota',
      '**Priority:** P0',
      '**Waiting until:** 2026-09-03',
      '',
      'Cannot start before the quota resets.',
      '',
      '---',
      '',
    ].join('\n');

    const task = parseTasks(markdown).tasks[0];
    const reparsed = parseTasks(`# Next\n\n${serializeTask(task)}\n\n---\n`).tasks[0];
    expect(reparsed.waitingUntil).toBe('2026-09-03');
    expect(reparsed.priority).toBe(task.priority);
  });
});

describe('isWaiting', () => {
  const AUG_27 = new Date('2026-08-27T00:00:00Z');

  it('is true only before the date arrives', () => {
    expect(isWaiting('2026-09-03', AUG_27)).toBe(true);
    expect(isWaiting('2026-09-03', new Date('2026-09-03T00:00:00Z'))).toBe(false);
    expect(isWaiting('2026-09-03', new Date('2026-09-04T00:00:00Z'))).toBe(false);
  });

  it('treats absent or unparseable values as not waiting', () => {
    // Impossible dates are rejected by parseTimestamp; isWaiting only wraps it.
    expect(isWaiting(undefined, AUG_27)).toBe(false);
    expect(isWaiting('next tuesday', AUG_27)).toBe(false);
    expect(isWaiting('', AUG_27)).toBe(false);
  });

  it('accepts a time suffix but not text glued to the date', () => {
    expect(isWaiting('2026-09-03 10:00', AUG_27)).toBe(true);
    expect(isWaiting('2026-09-03xyz', AUG_27)).toBe(false);
  });
});

describe('parseTimestamp', () => {
  it('accepts the two forms the board writes', () => {
    expect(parseTimestamp('2026-08-27')?.toISOString()).toBe('2026-08-27T00:00:00.000Z');
    expect(parseTimestamp('2026-08-27 14:30')?.toISOString()).toBe('2026-08-27T14:30:00.000Z');
    expect(parseTimestamp('  2026-08-27  ')?.toISOString()).toBe('2026-08-27T00:00:00.000Z');
  });

  it('rejects dates that Date.UTC would silently roll over', () => {
    expect(parseTimestamp('2026-02-31')).toBeNull();
    expect(parseTimestamp('2026-13-01')).toBeNull();
    expect(parseTimestamp('2026-99-99')).toBeNull();
  });

  it('rejects an out-of-range time instead of rolling it into the next hour', () => {
    // Reported on PR #8: `12:99` used to come back as 13:39, so malformed metadata could
    // silently change which archive bucket a task landed in.
    expect(parseTimestamp('2026-08-27 12:99')).toBeNull();
    expect(parseTimestamp('2026-08-27 25:00')).toBeNull();
    expect(parseTimestamp('2026-08-27 23:59')?.toISOString()).toBe('2026-08-27T23:59:00.000Z');
  });

  it('rejects two-digit years that Date.UTC remaps into the 1900s', () => {
    // Date.UTC(50, ...) is 1950, so `0050-01-01` would have parsed as a date 76 years off.
    expect(parseTimestamp('0050-01-01')).toBeNull();
    expect(parseTimestamp('0099-12-31')).toBeNull();
    expect(parseTimestamp('0100-01-01')?.toISOString()).toBe('0100-01-01T00:00:00.000Z');
  });

  it('rejects anything that is not one of the two forms', () => {
    expect(parseTimestamp(undefined)).toBeNull();
    expect(parseTimestamp('')).toBeNull();
    expect(parseTimestamp('27/08/2026')).toBeNull();
    expect(parseTimestamp('2026-08-27T14:30:00.000Z')).toBeNull();
  });
});

describe('currentDate and currentTimestamp', () => {
  it('both format the same instant in UTC', () => {
    // The bug this guards: currentTimestamp was UTC while currentDate was local, so the two
    // disagreed about the day for anyone not on UTC.
    const instant = new Date('2026-08-27T23:30:00Z');
    expect(currentDate(instant)).toBe('2026-08-27');
    expect(currentTimestamp(instant)).toBe('2026-08-27 23:30');
  });
});

describe('daysSince', () => {
  const NOW = new Date('2026-08-27T00:00:00Z');

  it('measures whole and fractional days back', () => {
    expect(daysSince('2026-08-20', NOW)).toBe(7);
    expect(daysSince('2026-08-26 12:00', NOW)).toBe(0.5);
  });

  it('is null when there is no usable date', () => {
    expect(daysSince(undefined, NOW)).toBeNull();
    expect(daysSince('whenever', NOW)).toBeNull();
  });
});
