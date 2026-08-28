import { describe, it, expect } from 'vitest';
import {
  parseTasks,
  findTaskLineNumber,
  countTaskHeadings,
  maxTaskIdNumber,
} from '../../core/parser/taskParser.js';
import { serializeStateFile, serializeTask } from '../../core/parser/taskSerializer.js';
import {
  isWaiting,
  currentDate,
  currentTimestamp,
  parseTimestamp,
  daysSince,
} from '../../core/util/time.js';
import { Priority } from '../../core/model/task.js';
import type { Task } from '../../core/model/task.js';

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

  it('parses task with epic', () => {
    const content = `# Next

## TASK-005: Setup CI
**Priority:** P2
**Tags:** devops
**Epic:** infrastructure

Configure GitHub Actions.

---
`;
    const { tasks } = parseTasks(content);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].epic).toBe('infrastructure');
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

  it('parses pipe-separated metadata on one line', () => {
    const content = `# Backlog

## TASK-001: Implement auth
**Priority:** P1 | **Tags:** auth, backend

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
  });

  it('parses pipe-separated metadata with epic', () => {
    const content = `## TASK-003: Setup CI
**Priority:** P2 | **Tag:** devops | **Epic:** infrastructure

Configure GitHub Actions.

---
`;
    const { tasks } = parseTasks(content);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].priority).toBe(Priority.P2);
    expect(tasks[0].tags).toEqual(['devops']);
    expect(tasks[0].epic).toBe('infrastructure');
  });

  it('handles empty file', () => {
    const { tasks, warnings } = parseTasks('# Backlog\n');
    expect(tasks).toHaveLength(0);
    expect(warnings).toHaveLength(0);
  });

  it('handles empty string', () => {
    const { tasks, warnings } = parseTasks('');
    expect(tasks).toHaveLength(0);
    expect(warnings).toHaveLength(0);
  });

  it('defaults to P4 for unknown priority', () => {
    const content = `## TASK-001: Bad priority
**Priority:** CRITICAL

Some description.
`;
    const { tasks } = parseTasks(content);
    expect(tasks[0].priority).toBe(Priority.P4);
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

  it('parses **Assignee:**', () => {
    const content = `## TASK-001: Owned
**Priority:** P1
**Assignee:** alice

Work.

---
`;
    const { tasks } = parseTasks(content);
    expect(tasks[0].assignee).toBe('alice');
  });

  it('parses **Updated:**', () => {
    const content = `## TASK-001: Recent
**Priority:** P2
**Updated:** 2026-03-22 19:14

Done.

---
`;
    const { tasks } = parseTasks(content);
    expect(tasks[0].updatedAt).toBe('2026-03-22 19:14');
  });

  it('parses all metadata fields together', () => {
    const content = `## TASK-001: Full meta
**Priority:** P1
**Tags:** a, b
**Epic:** epic1
**Assignee:** bob
**Updated:** 2026-01-01 12:00

Body.

---
`;
    const { tasks } = parseTasks(content);
    expect(tasks[0]).toMatchObject({
      id: 'TASK-001',
      title: 'Full meta',
      priority: Priority.P1,
      tags: ['a', 'b'],
      epic: 'epic1',
      assignee: 'bob',
      updatedAt: '2026-01-01 12:00',
      description: 'Body.',
    });
  });

  it('parses pipe-separated line with assignee and updated', () => {
    const content = `## TASK-001: Pipe
**Priority:** P2 | **Assignee:** carol | **Updated:** 2026-02-02

Text.

---
`;
    const { tasks } = parseTasks(content);
    expect(tasks[0].assignee).toBe('carol');
    expect(tasks[0].updatedAt).toBe('2026-02-02');
  });

  it('round-trips serializeStateFile then parseTasks', () => {
    const original: Task[] = [
      {
        id: 'TASK-001',
        title: 'Round trip',
        description: 'Desc line.',
        priority: Priority.P2,
        tags: ['x'],
        epic: 'My Epic',
        assignee: 'dev',
        updatedAt: '2026-03-01 10:00',
        plan: '- Step one',
      },
    ];
    const md = serializeStateFile('Backlog', original);
    const { tasks, warnings } = parseTasks(md);
    expect(warnings).toHaveLength(0);
    expect(tasks).toEqual(original);
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

  it('very long single-line description produces no warnings', () => {
    const long = 'x'.repeat(8000);
    const content = `## TASK-001: Long
**Priority:** P1

${long}
`;
    const { tasks, warnings } = parseTasks(content);
    expect(warnings).toHaveLength(0);
    expect(tasks[0].description).toBe(long);
  });
});

describe('parseTasks malformed input', () => {
  it('warns on random text without task headings', () => {
    const { tasks, warnings } = parseTasks('not a task\nstill garbage\n');
    expect(tasks).toHaveLength(0);
    expect(warnings.length).toBeGreaterThanOrEqual(2);
    expect(warnings[0].line).toBe(1);
  });

  it('warns on ## line that is not a valid task heading', () => {
    const { tasks, warnings } = parseTasks('## TASK-001 Missing colon syntax\n');
    expect(tasks).toHaveLength(0);
    expect(warnings.some((w) => w.message.includes('Invalid task heading'))).toBe(true);
  });

  it('warns on lowercase id prefix', () => {
    const { tasks, warnings } = parseTasks('## task-001: lower\n');
    expect(tasks).toHaveLength(0);
    expect(warnings.some((w) => w.message.includes('Invalid task heading'))).toBe(true);
  });

  it('warns on task heading with only whitespace as title', () => {
    const { tasks, warnings } = parseTasks('## TASK-001:     \n');
    expect(tasks).toHaveLength(0);
    expect(warnings.some((w) => w.message.includes('no title'))).toBe(true);
  });

  it('warns on orphaned content between tasks', () => {
    const content = `## TASK-001: A
**Priority:** P1

---

this is orphaned

## TASK-002: B
**Priority:** P2

---

`;
    const { tasks, warnings } = parseTasks(content);
    expect(tasks).toHaveLength(2);
    expect(warnings.some((w) => w.message.includes('not part of any task'))).toBe(true);
  });

  it('parses valid tasks and warns on invalid heading in between', () => {
    const content = `## TASK-001: Good
**Priority:** P1

---

## not a valid task heading

## TASK-002: Also good
**Priority:** P2

---

`;
    const { tasks, warnings } = parseTasks(content);
    expect(tasks).toHaveLength(2);
    expect(
      warnings.some(
        (w) =>
          w.message.includes('Invalid task heading') || w.message.includes('not part of any task'),
      ),
    ).toBe(true);
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
  it('parses the field and survives a round-trip through the serializer', () => {
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
    expect(task.waitingUntil).toBe('2026-09-03');

    const reparsed = parseTasks(`# Next\n\n${serializeTask(task)}\n\n---\n`).tasks[0];
    expect(reparsed.waitingUntil).toBe('2026-09-03');
    expect(reparsed.priority).toBe(task.priority);
  });

  it('leaves the field undefined when absent', () => {
    const markdown = '# Next\n\n## TASK-002: Ordinary\n**Priority:** P2\n\nx\n\n---\n';
    expect(parseTasks(markdown).tasks[0].waitingUntil).toBeUndefined();
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
    // A typo must not hide work forever.
    expect(isWaiting(undefined, AUG_27)).toBe(false);
    expect(isWaiting('next tuesday', AUG_27)).toBe(false);
    expect(isWaiting('', AUG_27)).toBe(false);
  });

  it('accepts a time suffix but not text glued to the date', () => {
    expect(isWaiting('2026-09-03 10:00', AUG_27)).toBe(true);
    expect(isWaiting('2026-09-03xyz', AUG_27)).toBe(false);
  });

  it('rejects impossible calendar dates', () => {
    // A regexp alone accepts these, and a task would then be suppressed forever — the exact
    // failure this function promises not to cause.
    expect(isWaiting('2026-99-99', AUG_27)).toBe(false);
    expect(isWaiting('2026-02-31', AUG_27)).toBe(false);
    expect(isWaiting('2026-13-01', AUG_27)).toBe(false);
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
