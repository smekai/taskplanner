import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { parseTasks } from '../../core/parser/taskParser.js';
import { serializeBoard } from '../../core/parser/taskSerializer.js';
import { ConfigManager } from '../../core/config/configManager.js';
import { FileStore } from '../../core/store/fileStore.js';
import { TaskStore } from '../../core/store/taskStore.js';
import { Priority } from '../../core/model/task.js';

// Everything a human put in a state file that the parser does not turn into a Task: the file
// heading, prose, a comment, a section whose prefix the parser refuses, and a trailing note.
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

describe('parse and write are inverses', () => {
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
    ['no trailing newline', '# B\n\n## TASK-001: T\n**Priority:** P1\n\n---'],
    ['unterminated final task', '# B\n\n## TASK-001: T\n**Priority:** P1\n'],
    ['no tasks at all', '# B\n\nJust prose.\n'],
    ['empty', ''],
  ])('%s', (_name, original) => {
    const parsed = parseTasks(original);

    expect(serializeBoard(parsed.segments, parsed.tasks)).toBe(original);
  });
});

describe('a write keeps what the parser did not claim', () => {
  let tmpDir: string;
  let taskStore: TaskStore;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'taskplanner-lossless-'));
    const configManager = new ConfigManager(tmpDir);
    configManager.load();
    configManager.save();
    const fileStore = new FileStore(tmpDir);
    fileStore.initializeStateFiles(configManager.get());
    fs.writeFileSync(path.join(tmpDir, 'BACKLOG.md'), MESSY, 'utf8');
    taskStore = new TaskStore(configManager, fileStore);
    taskStore.reload();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  const backlog = () => fs.readFileSync(path.join(tmpDir, 'BACKLOG.md'), 'utf8');

  it('updating one task leaves prose, comments and a refused section in place', () => {
    taskStore.updateTask('TASK-001', { title: 'First, renamed' });
    const after = backlog();

    expect(after).toContain('Prose a human wrote at the top.');
    expect(after).toContain('<!-- keep this -->');
    expect(after).toContain('<!-- a note between two tasks -->');
    expect(after).toContain('## task-003: lowercase, the parser refuses this');
    expect(after).toContain('A trailing note.');
    expect(after).toContain('## TASK-001: First, renamed');
  });

  it('leaves the untouched task byte for byte', () => {
    taskStore.updateTask('TASK-001', { title: 'First, renamed' });

    expect(backlog()).toContain('## TASK-002: Second\n**Priority:** P2\n\nBody two.\n\n---\n');
  });

  it('deleting a task keeps the rest of the file', () => {
    taskStore.deleteTask('TASK-002');
    const after = backlog();

    expect(after).not.toContain('## TASK-002:');
    expect(after).toContain('Prose a human wrote at the top.');
    expect(after).toContain('## task-003: lowercase, the parser refuses this');
    expect(after).toContain('A trailing note.');
  });

  it('adding a task keeps the file heading and the prose above it', () => {
    taskStore.createTask(
      { title: 'Added', priority: Priority.P1, tags: [], description: 'New body.' },
      'Backlog',
    );
    const after = backlog();

    expect(after.startsWith('# Backlog\n')).toBe(true);
    expect(after).toContain('Prose a human wrote at the top.');
    expect(after).toContain('Added');
    expect(parseTasks(after).tasks.map((t) => t.id)).toContain('TASK-001');
  });

  it('a CRLF board stays CRLF after a write', () => {
    fs.writeFileSync(path.join(tmpDir, 'BACKLOG.md'), MESSY.replace(/\n/g, '\r\n'), 'utf8');
    taskStore.reload();

    taskStore.updateTask('TASK-001', { title: 'Renamed' });

    expect(backlog()).not.toMatch(/(?<!\r)\n/);
  });
});
