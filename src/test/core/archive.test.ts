import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ConfigManager } from '../../core/config/configManager.js';
import { FileStore } from '../../core/store/fileStore.js';
import { TaskStore } from '../../core/store/taskStore.js';
import { archiveFileFor, isArchivable } from '../../core/store/archive.js';
import { Priority, Task } from '../../core/model/task.js';

const NOW = new Date('2026-08-27T12:00:00Z');

function task(id: string, updatedAt?: string): Task {
  return { id, title: `Task ${id}`, description: 'body', priority: Priority.P2, tags: [], updatedAt };
}

describe('archiveFileFor', () => {
  it('buckets by half-year', () => {
    expect(archiveFileFor(task('T-1', '2026-03-16 10:00'))).toBe('DONE-2026-H1.md');
    expect(archiveFileFor(task('T-2', '2026-08-27 10:00'))).toBe('DONE-2026-H2.md');
    expect(archiveFileFor(task('T-3', '2025-06-30'))).toBe('DONE-2025-H1.md');
  });

  it('gives undated tasks their own bucket rather than inventing a date', () => {
    expect(archiveFileFor(task('T-4'))).toBe('DONE-undated.md');
    expect(archiveFileFor(task('T-5', 'sometime last year'))).toBe('DONE-undated.md');
  });
});

describe('isArchivable', () => {
  it('is disabled when no threshold is configured', () => {
    // The upgrade-safety property: an unset config must never move anything.
    expect(isArchivable(task('T-1', '2020-01-01'), 0, NOW)).toBe(false);
    expect(isArchivable(task('T-2'), 0, NOW)).toBe(false);
  });

  it('compares age against the threshold', () => {
    expect(isArchivable(task('T-1', '2026-01-01'), 90, NOW)).toBe(true);
    expect(isArchivable(task('T-2', '2026-08-20'), 90, NOW)).toBe(false);
  });

  it('treats an unusable date as archivable', () => {
    expect(isArchivable(task('T-3'), 90, NOW)).toBe(true);
    expect(isArchivable(task('T-4', 'whenever'), 90, NOW)).toBe(true);
  });
});

describe('TaskStore.archiveCompleted', () => {
  let tmpDir: string;
  let store: TaskStore;
  let configManager: ConfigManager;
  let fileStore: FileStore;

  const setup = (archiveDoneAfterDays?: number) => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'archive-test-'));
    fs.writeFileSync(
      path.join(tmpDir, 'config.json'),
      JSON.stringify({ version: 3, idPrefix: 'T', nextId: 1, archiveDoneAfterDays }),
    );
    configManager = new ConfigManager(tmpDir);
    configManager.load();
    fileStore = new FileStore(tmpDir);
    fileStore.initializeStateFiles(configManager.get());
    store = new TaskStore(configManager, fileStore);
    store.reload();
  };

  const writeDone = (body: string) => {
    fs.writeFileSync(path.join(tmpDir, 'DONE.md'), body);
    store.reload();
    store.ensureStateLoaded('Done');
  };

  const done = (id: string, date: string, extra = '') =>
    `## ${id}: Task ${id}\n**Priority:** P2\n**Updated:** ${date}\n${extra}\nbody for ${id}\n\n---\n`;

  afterEach(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

  it('does nothing when the setting is absent', () => {
    setup(undefined);
    writeDone(`# Done\n\n${done('T-001', '2020-01-01')}`);

    expect(store.archiveCompleted(NOW).archived).toBe(0);
    expect(fs.existsSync(path.join(tmpDir, 'archive'))).toBe(false);
    expect(fs.readFileSync(path.join(tmpDir, 'DONE.md'), 'utf-8')).toContain('T-001');
  });

  it('moves old tasks out and keeps recent ones', () => {
    setup(90);
    writeDone(`# Done\n\n${done('T-001', '2026-01-15')}\n${done('T-002', '2026-08-20')}`);

    const result = store.archiveCompleted(NOW);

    expect(result.archived).toBe(1);
    expect(result.files).toEqual(['DONE-2026-H1.md']);
    const doneMd = fs.readFileSync(path.join(tmpDir, 'DONE.md'), 'utf-8');
    expect(doneMd).not.toContain('T-001');
    expect(doneMd).toContain('T-002');
    expect(fs.readFileSync(path.join(tmpDir, 'archive', 'DONE-2026-H1.md'), 'utf-8')).toContain(
      'body for T-001',
    );
  });

  it('is idempotent', () => {
    setup(90);
    writeDone(`# Done\n\n${done('T-001', '2026-01-15')}`);

    expect(store.archiveCompleted(NOW).archived).toBe(1);
    const after = fs.readFileSync(path.join(tmpDir, 'archive', 'DONE-2026-H1.md'), 'utf-8');
    expect(store.archiveCompleted(NOW).archived).toBe(0);
    expect(fs.readFileSync(path.join(tmpDir, 'archive', 'DONE-2026-H1.md'), 'utf-8')).toBe(after);
  });

  it('appends to an archive file rather than replacing it', () => {
    setup(90);
    writeDone(`# Done\n\n${done('T-001', '2026-01-15')}`);
    store.archiveCompleted(NOW);

    writeDone(`# Done\n\n${done('T-002', '2026-02-20')}`);
    store.archiveCompleted(NOW);

    const archive = fs.readFileSync(path.join(tmpDir, 'archive', 'DONE-2026-H1.md'), 'utf-8');
    expect(archive).toContain('T-001');
    expect(archive).toContain('T-002');
  });

  it('never reissues an archived task ID', () => {
    // The hazard this whole task carries: getMaxTaskIdNumber walks configured states only, so
    // without scanning the archive, nextId would forget archived tasks and hand out their IDs.
    setup(90);
    writeDone(`# Done\n\n${done('T-001', '2026-01-15')}\n${done('T-002', '2026-01-16')}`);
    store.archiveCompleted(NOW);

    expect(fs.readFileSync(path.join(tmpDir, 'DONE.md'), 'utf-8')).not.toContain('T-00');

    const created = store.createTask(
      { title: 'New work', description: '', priority: Priority.P2, tags: [] },
      'Backlog',
    );
    expect(created.id).toBe('T-003');
  });

  it('preserves the task body through the move', () => {
    setup(90);
    writeDone(`# Done\n\n${done('T-001', '2026-01-15', '**Tags:** core, ci\n')}`);
    store.archiveCompleted(NOW);

    const archived = fs.readFileSync(path.join(tmpDir, 'archive', 'DONE-2026-H1.md'), 'utf-8');
    expect(archived).toContain('body for T-001');
    expect(archived).toContain('**Tags:** core, ci');
    expect(archived).toContain('**Updated:** 2026-01-15');
  });

  it('sends undated tasks to their own file', () => {
    setup(90);
    fs.writeFileSync(
      path.join(tmpDir, 'DONE.md'),
      '# Done\n\n## T-009: Ancient\n**Priority:** P2\n\nno date here\n\n---\n',
    );
    store.reload();
    store.ensureStateLoaded('Done');

    expect(store.archiveCompleted(NOW).files).toEqual(['DONE-undated.md']);
    expect(fs.readFileSync(path.join(tmpDir, 'archive', 'DONE-undated.md'), 'utf-8')).toContain(
      'T-009',
    );
  });
});
