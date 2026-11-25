import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { parseTasks } from '../../src/core/parser/taskParser.js';
import { serializeBoard, serializeTask } from '../../src/core/parser/taskSerializer.js';
import { Task, Priority } from '../../src/core/model/task.js';

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: 'TASK-001',
    title: 'Implement auth',
    description: 'Body.',
    priority: Priority.P1,
    tags: [],
    ...overrides,
  };
}

const roundTripped = (overrides: Partial<Task> = {}) =>
  parseTasks(`${serializeTask(task(overrides))}\n\n---\n`).tasks;

// Everything a human put in a state file that the parser does not turn into a Task.
const MESSY = [
  '# Backlog',
  '',
  'Prose a human wrote at the top.',
  '',
  '<!-- keep this -->',
  '## TASK-001: First',
  '**Priority:** P1',
  '',
  'Body one.',
  '',
  '---',
  '',
  '<!-- a note between two tasks -->',
  '## TASK-002: Second',
  '**Priority:** P2',
  '',
  'Body two.',
  '',
  '---',
  '',
  '## task-003: lowercase, the parser refuses this',
  '**Priority:** P3',
  '',
  '---',
  '',
  'A trailing note.',
  '',
].join('\n');

describe('parsing and writing are inverses', () => {
  const BOARDS = fs
    .readdirSync(path.join(process.cwd(), '.tasks'))
    .filter((name) => name.endsWith('.md'))
    .map((name) => path.join(process.cwd(), '.tasks', name));

  it.each(BOARDS)('writing an unmodified parse of %s returns it byte for byte', (file) => {
    const original = fs.readFileSync(file, 'utf8');
    const parsed = parseTasks(original);

    expect(serializeBoard(parsed.segments, parsed.tasks)).toBe(original);
  });

  it.each([
    ['a messy board', MESSY],
    ['CRLF', MESSY.replace(/\n/g, '\r\n')],
    ['a BOM', `\uFEFF${MESSY}`],
    ['no trailing newline', '# B\n\n## TASK-001: T\n**Priority:** P1\n\n---'],
    ['an unterminated final task', '# B\n\n## TASK-001: T\n**Priority:** P1\n'],
    ['a missing middle separator', '# B\n\n## TASK-001: A\n\n## TASK-002: B\n\n---\n'],
    ['no tasks at all', '# B\n\nJust prose.\n'],
    ['empty', ''],
  ])('%s', (_name, original) => {
    const parsed = parseTasks(original);

    expect(serializeBoard(parsed.segments, parsed.tasks)).toBe(original);
  });

  it('rewrites only the task that changed', () => {
    const parsed = parseTasks(MESSY);
    const renamed = parsed.tasks.map((t) =>
      t.id === 'TASK-001' ? { ...t, title: 'First, renamed' } : t,
    );

    const out = serializeBoard(parsed.segments, renamed);

    expect(out).toContain('## TASK-001: First, renamed');
    expect(out).toContain('## TASK-002: Second\n**Priority:** P2\n\nBody two.\n\n---\n');
    expect(out).toContain('Prose a human wrote at the top.');
    expect(out).toContain('<!-- keep this -->');
    expect(out).toContain('<!-- a note between two tasks -->');
    expect(out).toContain('## task-003: lowercase, the parser refuses this');
    expect(out).toContain('A trailing note.');
  });
});

// These values are routinely model output. Serializing one must not be able to put a second task
// on someone's board, and the only check that proves it is the round trip.
describe('a serialized task cannot smuggle in a second one', () => {
  const HEADING = '\n## TASK-999: Injected';

  // oneLine() is the same path for every single-line field; title and tags cover string and array.
  it.each([
    ['title', { title: `Safe title${HEADING}` }],
    ['tags', { tags: [`ui${HEADING}`] }],
  ])('a heading smuggled through %s does not become a second task', (_field, overrides) => {
    expect(roundTripped(overrides).map((t) => t.id)).toEqual(['TASK-001']);
  });

  it('refuses a description holding a separator, because escaping it would rewrite the author', () => {
    expect(() => serializeTask(task({ description: 'Body\n\n---\n\nMore' }))).toThrow(
      /description/,
    );
  });

  it('refuses a plan holding a task heading', () => {
    expect(() => serializeTask(task({ plan: `Step one${HEADING}` }))).toThrow(/plan/);
  });

  // parseTasks needs a title after the id, so this is body text to it. Refusing it here would
  // reject a task the parser itself produced.
  it('accepts a heading-shaped line the parser does not treat as a heading', () => {
    const parsed = roundTripped({ description: 'Body.\n## TASK-999:\nMore.' });

    expect(parsed).toHaveLength(1);
    expect(parsed[0].description).toContain('## TASK-999:');
  });

  it('leaves a line that merely starts with a dash alone', () => {
    expect(roundTripped({ description: 'Body\n- a list item\n--- not a separator' })).toHaveLength(
      1,
    );
  });
});

describe('attributes', () => {
  it('an unrecognised field survives a round trip', () => {
    const parsed = roundTripped({ attributes: { Source: 'milestone m1 / feature f1' } });

    expect(parsed[0].attributes).toEqual({ Source: 'milestone m1 / feature f1' });
  });

  it('is read from the grouped line as well as its own', () => {
    const grouped = parseTasks(
      '## TASK-001: T\n**Priority:** P1 | **Source:** agent\n\n---\n',
    ).tasks;

    expect(grouped[0].attributes).toEqual({ Source: 'agent' });
    expect(grouped[0].priority).toBe(Priority.P1);
  });

  it('does not become the first line of the description', () => {
    const parsed = parseTasks(
      '## TASK-001: T\n**Priority:** P1\n**Source:** agent\n\nReal body.\n\n---\n',
    ).tasks;

    expect(parsed[0].description).toBe('Real body.');
    expect(parsed[0].attributes).toEqual({ Source: 'agent' });
  });

  // A bare pipe used to truncate the value, because every pipe was a field separator.
  it('keeps a bare pipe in its value', () => {
    const parsed = roundTripped({ attributes: { Source: 'a | b' } });

    expect(parsed[0].attributes).toEqual({ Source: 'a | b' });
  });

  it.each([
    'Priority',
    'Tags',
    'Tag',
    'Epic',
    'Assignee',
    'Updated',
    'Waiting until',
    'Repeats',
    'Last run',
  ])('refuses %s, which would overwrite the built-in field', (reserved) => {
    expect(() => serializeTask(task({ attributes: { [reserved]: 'x' } }))).toThrow(
      new RegExp(reserved),
    );
  });

  it('refuses a name the attribute line cannot represent', () => {
    expect(() => serializeTask(task({ attributes: { 'Own:** field': 'x' } }))).toThrow();
    expect(() => serializeTask(task({ attributes: { 'a|b': 'x' } }))).toThrow();
    expect(() => serializeTask(task({ attributes: { '  ': 'x' } }))).toThrow(/empty/);
  });
});

describe('priority diagnostics', () => {
  const priorityOf = (line: string) => parseTasks(`## TASK-001: T\n${line}\n\n---\n`);

  // Happy-path spellings live in grammar.test.ts; this checks the diagnostics path.
  it('accepts a lower-case priority with no diagnostics', () => {
    const { tasks, errors, warnings } = priorityOf('**Priority:** p0');

    expect(tasks[0].priority).toBe(Priority.P0);
    expect(errors).toHaveLength(0);
    expect(warnings).toHaveLength(0);
  });

  // This used to become P4 in silence, so a task an agent was told to prioritise became one it
  // would never pick up.
  it('reports an unrecognised value as an error', () => {
    const { tasks, errors } = priorityOf('**Priority:** Critical');

    expect(tasks).toHaveLength(1);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('Critical');
    expect(errors[0].line).toBe(2);
  });

  it('reports a missing line as a warning, not an error', () => {
    const { tasks, errors, warnings } = parseTasks('## TASK-001: T\n\nBody.\n\n---\n');

    expect(tasks[0].priority).toBe(Priority.P4);
    expect(errors).toHaveLength(0);
    expect(warnings).toHaveLength(1);
  });

  it('reports an empty value as an error', () => {
    expect(priorityOf('**Priority:**').errors).toHaveLength(1);
  });
});

describe('recurring fields', () => {
  const RECURRING = [
    '# Recurring',
    '',
    '## TASK-009: Daily store-status watch',
    '**Priority:** P1 | **Tags:** ci',
    '**Updated:** 2026-11-25 07:12',
    '**Repeats:** 0 7 * * *',
    '**Last run:** 2026-11-25 07:12',
    '',
    'Check every store.',
    '',
    '### Plan',
    '',
    'Run the watch skill.',
    '',
    '### Runs',
    '',
    '- 2026-11-25 07:12 — all stores on 3.0.28',
    '- 2026-11-24 07:05 — Open VSX behind',
    '',
    '---',
    '',
  ].join('\n');

  it('reads the schedule, the last run and the run history', () => {
    const [parsed] = parseTasks(RECURRING).tasks;

    expect(parsed.repeats).toBe('0 7 * * *');
    expect(parsed.lastRun).toBe('2026-11-25 07:12');
    expect(parsed.description).toBe('Check every store.');
    expect(parsed.plan).toBe('Run the watch skill.');
    expect(parsed.runs).toEqual([
      '2026-11-25 07:12 — all stores on 3.0.28',
      '2026-11-24 07:05 — Open VSX behind',
    ]);
    expect(parsed.attributes).toBeUndefined();
  });

  it('writes them back byte for byte when nothing changed', () => {
    const { tasks, segments } = parseTasks(RECURRING);

    expect(serializeBoard(segments, tasks)).toBe(RECURRING);
  });

  it('writes a freshly built recurring task the way it reads it', () => {
    const fresh = task({
      repeats: '0 7 * * *',
      lastRun: '2026-11-25 07:12',
      runs: ['2026-11-25 07:12 — ok', '2026-11-24 07:05 — late'],
    });

    expect(roundTripped(fresh)[0]).toEqual(expect.objectContaining(fresh));
  });

  it('reads a run history without a plan, right after the description', () => {
    const [parsed] = parseTasks(
      '## TASK-001: T\n**Priority:** P1\n**Repeats:** @daily\n\nBody.\n\n### Runs\n\n- one\n\n---\n',
    ).tasks;

    expect(parsed.description).toBe('Body.');
    expect(parsed.runs).toEqual(['one']);
  });

  it('a changed run history rewrites only that task', () => {
    const { tasks, segments } = parseTasks(RECURRING);
    const changed = [{ ...tasks[0], runs: ['2026-11-26 07:01 — ok', ...(tasks[0].runs ?? [])] }];

    const written = serializeBoard(segments, changed);

    expect(written).toContain('### Runs\n\n- 2026-11-26 07:01 — ok\n- 2026-11-25 07:12');
    expect(parseTasks(written).tasks[0].runs).toHaveLength(3);
  });

  // In a recurring task the heading would come back as run history and its text would be lost.
  it.each(['description', 'plan'] as const)(
    'refuses a ### Runs heading inside the %s of a recurring task',
    (field) => {
      expect(() =>
        serializeTask(task({ repeats: '@daily', [field]: 'Text.\n\n### Runs\n\n- fake' })),
      ).toThrow(/### Runs/);
    },
  );
});

// Boards written before 3.1 may use "### Runs" as an ordinary heading; only Repeats makes it run history.
// A schedule that was removed leaves Last run behind, and that line keeps the history readable.
describe('run history after the schedule is removed', () => {
  const PAUSED = {
    lastRun: '2026-11-25 07:12',
    runs: ['2026-11-25 07:12 — ok'],
  };

  it('reads back as run history, not as description text', () => {
    const [parsed] = roundTripped({ ...PAUSED, description: 'Check the stores.' });

    expect(parsed.runs).toEqual(PAUSED.runs);
    expect(parsed.description).toBe('Check the stores.');
  });

  it('lets the schedule be set again', () => {
    const [paused] = roundTripped(PAUSED);

    expect(() => serializeTask({ ...paused, repeats: '0 7 * * *' })).not.toThrow();
  });

  it('refuses a ### Runs heading in the description, which would be read as history', () => {
    expect(() =>
      serializeTask(task({ ...PAUSED, description: 'Text.\n\n### Runs\n\n- fake' })),
    ).toThrow(/### Runs/);
  });

  it('refuses run history with neither Repeats nor Last run, which would come back as text', () => {
    expect(() => serializeTask(task({ runs: ['2026-11-25 07:12 — ok'] }))).toThrow(/Last run/);
  });
});

describe('### Runs in a task that does not repeat', () => {
  const EXISTING = [
    '# Backlog',
    '',
    '## TASK-004: Benchmark the parser',
    '**Priority:** P2',
    '',
    'Measure it.',
    '',
    '### Runs',
    '',
    '- cold start on CI',
    '  with the cache disabled',
    '',
    '---',
    '',
  ].join('\n');

  it('stays part of the description', () => {
    const [parsed] = parseTasks(EXISTING).tasks;

    expect(parsed.runs).toBeUndefined();
    expect(parsed.description).toBe(
      'Measure it.\n\n### Runs\n\n- cold start on CI\n  with the cache disabled',
    );
  });

  it('survives an edit to another field unchanged', () => {
    const { tasks, segments } = parseTasks(EXISTING);

    const written = serializeBoard(segments, [{ ...tasks[0], priority: Priority.P1 }]);

    expect(written).toBe(EXISTING.replace('**Priority:** P2', '**Priority:** P1'));
  });

  it('is accepted on write', () => {
    expect(() =>
      serializeTask(task({ description: 'Text.\n\n### Runs\n\n- notes' })),
    ).not.toThrow();
  });
});
