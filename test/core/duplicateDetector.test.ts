import { describe, expect, it } from 'vitest';
import { Priority, Task } from '../../src/core/model/task.js';
import { TaskState } from '../../src/core/model/state.js';
import { detectDuplicates, resolveConflict } from '../../src/core/validation/duplicateDetector.js';

function task(id: string, title: string, updatedAt?: string): Task {
  return {
    id,
    title,
    description: '',
    priority: Priority.P2,
    tags: [],
    updatedAt,
  };
}

const states: TaskState[] = [
  { name: 'Backlog', fileName: 'BACKLOG.md', order: 0 },
  { name: 'Next', fileName: 'NEXT.md', order: 1 },
  { name: 'In Progress', fileName: 'IN_PROGRESS.md', order: 2 },
  { name: 'Done', fileName: 'DONE.md', order: 3 },
];

describe('duplicateDetector', () => {
  it('returns no conflicts when task IDs are unique', () => {
    const tasksByState = new Map<string, Task[]>([
      ['Backlog', [task('TASK-001', 'One')]],
      ['Next', [task('TASK-002', 'Two')]],
    ]);

    expect(detectDuplicates(tasksByState)).toEqual([]);
  });

  it('detects a duplicate ID across different states', () => {
    const tasksByState = new Map<string, Task[]>([
      ['Backlog', [task('TASK-001', 'One')]],
      ['Next', [task('TASK-001', 'One copy')]],
    ]);

    const conflicts = detectDuplicates(tasksByState);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].taskId).toBe('TASK-001');
    expect(conflicts[0].occurrences.map((o) => o.stateName)).toEqual(['Backlog', 'Next']);
  });

  it('detects duplicate IDs in the same state file', () => {
    const tasksByState = new Map<string, Task[]>([
      ['Backlog', [task('TASK-001', 'First'), task('TASK-001', 'Second')]],
    ]);

    const conflicts = detectDuplicates(tasksByState);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].occurrences.map((o) => o.index)).toEqual([0, 1]);
  });

  it('resolveConflict keeps latest updatedAt', () => {
    const tasksByState = new Map<string, Task[]>([
      ['Backlog', [task('TASK-001', 'Old', '2026-03-18 12:00')]],
      ['Next', [task('TASK-001', 'New', '2026-03-19 09:30')]],
    ]);

    const conflict = detectDuplicates(tasksByState)[0];
    const resolution = resolveConflict(conflict, states);

    expect(resolution.keep.stateName).toBe('Next');
    expect(resolution.keep.task.title).toBe('New');
    expect(resolution.remove).toHaveLength(1);
  });

  it('resolveConflict falls back to highest state order when updatedAt is missing', () => {
    const tasksByState = new Map<string, Task[]>([
      ['Backlog', [task('TASK-001', 'Backlog')]],
      ['In Progress', [task('TASK-001', 'Progress')]],
    ]);

    const conflict = detectDuplicates(tasksByState)[0];
    const resolution = resolveConflict(conflict, states);

    expect(resolution.keep.stateName).toBe('In Progress');
    expect(resolution.remove).toHaveLength(1);
    expect(resolution.remove[0].stateName).toBe('Backlog');
  });
});
