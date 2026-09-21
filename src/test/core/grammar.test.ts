import { describe, it, expect } from 'vitest';
import {
  attributeOf,
  builtInFieldOf,
  isReservedAttributeKey,
  isSectionSeparatorLine,
  looksLikeTaskHeading,
  parsePriority,
  splitFieldGroup,
  taskHeadingOf,
} from '../../core/parser/grammar.js';
import { Priority } from '../../core/model/task.js';

describe('task headings', () => {
  it.each([
    ['## TASK-001: Title', 'TASK-001', 'Title'],
    ['## ABC-42: Trailing spaces   ', 'ABC-42', 'Trailing spaces'],
  ])('%s', (line, id, title) => {
    expect(taskHeadingOf(line)).toEqual({ id, title });
  });

  it.each([
    ['## TASK-001:', 'no title, so it is body text'],
    ['## task-001: lowercase prefix', 'the format is uppercase'],
    ['## TASK 001: space instead of a dash', 'a typo, not an id'],
    ['### TASK-001: Title', 'a level-three heading'],
    ['Some prose', 'not a heading at all'],
  ])('%s is not a task heading (%s)', (line) => {
    expect(taskHeadingOf(line)).toBeUndefined();
  });

  // The typo cases above still look like a task to a human, which is why they earn an error
  // rather than silence: a section is being dropped.
  it.each(['## TASK 001: space instead of a dash', '## task-001: lowercase', '## TASK-001:'])(
    'but %s does look like one',
    (line) => {
      expect(looksLikeTaskHeading(line)).toBe(true);
    },
  );

  it('a plan heading does not look like a task heading', () => {
    expect(looksLikeTaskHeading('### Plan')).toBe(false);
  });
});

describe('separators', () => {
  it.each(['---', '---   '])('%s ends a section', (line) => {
    expect(isSectionSeparatorLine(line)).toBe(true);
  });

  it.each(['----', '- - -', 'a---'])('%s does not', (line) => {
    expect(isSectionSeparatorLine(line)).toBe(false);
  });
});

describe('priority', () => {
  it.each([
    ['P0', Priority.P0],
    ['p0', Priority.P0],
    ['  P3  ', Priority.P3],
    ['p4', Priority.P4],
  ])('%s reads as %s', (raw, expected) => {
    expect(parsePriority(raw)).toBe(expected);
  });

  it.each(['Critical', 'P9', '', 'high'])('%s is not a priority', (raw) => {
    expect(parsePriority(raw)).toBeUndefined();
  });
});

describe('field groups', () => {
  it('splits a grouped metadata line', () => {
    expect(splitFieldGroup('**Priority:** P1 | **Tags:** ui | **Epic:** 2.3.x')).toEqual([
      '**Priority:** P1',
      '**Tags:** ui',
      '**Epic:** 2.3.x',
    ]);
  });

  // Splitting on every pipe is what truncated a value at its first one.
  it('leaves a bare pipe inside a value alone', () => {
    expect(splitFieldGroup('**Source:** a | b')).toEqual(['**Source:** a | b']);
  });

  it('reads a field from its own line', () => {
    expect(builtInFieldOf('**Assignee:** owner')).toEqual({ field: 'assignee', value: 'owner' });
  });
});

describe('attributes', () => {
  it('an unrecognised key is an attribute', () => {
    expect(attributeOf('**Source:** milestone m1')).toEqual({
      key: 'Source',
      value: 'milestone m1',
    });
  });

  it.each(['Priority', 'Tags', 'Tag', 'Epic', 'Assignee', 'Updated', 'Waiting until'])(
    '%s is reserved',
    (key) => {
      expect(isReservedAttributeKey(key)).toBe(true);
    },
  );

  it.each(['Source', 'Isotopy source', 'Owner'])('%s is not reserved', (key) => {
    expect(isReservedAttributeKey(key)).toBe(false);
  });

  it('a value that merely looks like a field is not one', () => {
    expect(builtInFieldOf('**Source:** **Priority:** P0')).toBeUndefined();
  });
});

describe('priority is one token', () => {
  // The value has always been read as a single token. Reading to end of line would turn
  // "**Priority:** P1 | a note" — which parses today — into an unrecognised value.
  it('stops at the first token', () => {
    expect(builtInFieldOf('**Priority:** P1 | a note')).toEqual({
      field: 'priority',
      value: 'P1',
    });
  });

  it('reports an empty value as empty rather than guessing', () => {
    expect(builtInFieldOf('**Priority:**')).toEqual({ field: 'priority', value: '' });
  });
});
