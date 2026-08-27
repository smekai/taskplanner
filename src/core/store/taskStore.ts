import { Task } from '../model/task.js';
import { TaskState } from '../model/state.js';
import { TaskPlannerConfig } from '../model/config.js';
import { ParseWarning } from '../model/parseResult.js';
import { ConfigManager } from '../config/configManager.js';
import { FileStore } from './fileStore.js';
import { IdGenerator } from '../id/idGenerator.js';
import { DuplicateResolution } from '../validation/duplicateDetector.js';
import { countTaskHeadings, maxTaskIdNumber, parseTasks } from '../parser/taskParser.js';
import { currentTimestamp } from '../util/time.js';
import {
  ArchiveResult,
  archiveHeadingFor,
  isDateArchivable,
  joinWorkLog,
  planArchive,
  splitWorkLog,
  workLogArchiveFileFor,
} from './archive.js';

export type TaskStoreListener = () => void;

/** States that skip full parse on reload until explicitly loaded (large archives). */
const DEFERRED_STATE_NAMES = new Set(['Done', 'Rejected']);

export function isDeferredStateName(stateName: string): boolean {
  return DEFERRED_STATE_NAMES.has(stateName);
}

export class TaskStore {
  private tasksByState: Map<string, Task[]> = new Map();
  private parseWarningsByFile: Map<string, ParseWarning[]> = new Map();
  /** Done/Rejected not yet fully parsed; `tasksByState` holds [] until loaded. */
  private deferredUnloadedStates: Set<string> = new Set();
  /** Heading counts for deferred states (from `countTaskHeadings`). */
  private deferredSectionCounts: Map<string, number> = new Map();
  private listeners: TaskStoreListener[] = [];
  private fileStore: FileStore;
  private idGenerator: IdGenerator;

  constructor(
    private configManager: ConfigManager,
    fileStore: FileStore,
  ) {
    this.fileStore = fileStore;
    this.idGenerator = new IdGenerator(configManager);
  }

  get config(): TaskPlannerConfig {
    return this.configManager.get();
  }

  reload(): void {
    this.reloadSync();
  }

  /** Reset in-memory state and deferred tracking to a blank slate before a reload. */
  private resetReloadState(): void {
    this.tasksByState = new Map();
    this.parseWarningsByFile = new Map();
    this.deferredUnloadedStates.clear();
    this.deferredSectionCounts.clear();
  }

  /** Record a deferred state (raw counted only; tasks loaded lazily). */
  private applyDeferredState(state: TaskState, raw: string): void {
    this.deferredSectionCounts.set(state.name, countTaskHeadings(raw));
    this.deferredUnloadedStates.add(state.name);
    this.tasksByState.set(state.name, []);
  }

  /** Record a fully-parsed state's tasks and warnings. */
  private applyParsedState(
    state: TaskState,
    pr: { tasks: Task[]; warnings: ParseWarning[] },
  ): void {
    this.tasksByState.set(state.name, pr.tasks);
    if (pr.warnings.length > 0) {
      this.parseWarningsByFile.set(state.fileName, pr.warnings);
    }
  }

  private reloadSync(): void {
    this.resetReloadState();
    for (const state of this.config.states) {
      if (isDeferredStateName(state.name)) {
        this.applyDeferredState(state, this.fileStore.readRawContent(state));
      } else {
        this.applyParsedState(state, this.fileStore.readState(state));
      }
    }
    this.notifyListeners();
  }

  async reloadAsync(): Promise<void> {
    this.resetReloadState();
    for (const state of this.config.states) {
      if (isDeferredStateName(state.name)) {
        this.applyDeferredState(state, await this.fileStore.readRawContentAsync(state));
      } else {
        this.applyParsedState(state, await this.fileStore.readStateAsync(state));
      }
    }
    this.notifyListeners();
  }

  /** Parse one state file into memory; clears deferred flag for that state. */
  private parseStateIntoStore(stateName: string): void {
    const state = this.findState(stateName);
    if (!state) {
      return;
    }
    const pr = this.fileStore.readState(state);
    this.tasksByState.set(stateName, pr.tasks);
    this.deferredUnloadedStates.delete(stateName);
    this.deferredSectionCounts.set(stateName, pr.tasks.length);
    this.parseWarningsByFile.delete(state.fileName);
    if (pr.warnings.length > 0) {
      this.parseWarningsByFile.set(state.fileName, pr.warnings);
    }
  }

  reloadState(stateName: string): void {
    const state = this.findState(stateName);
    if (!state) {
      return;
    }
    this.parseStateIntoStore(stateName);
    this.notifyListeners();
  }

  /** Load a deferred state (Done/Rejected) if it was not parsed yet. */
  ensureStateLoaded(stateName: string): void {
    if (!this.deferredUnloadedStates.has(stateName)) {
      return;
    }
    this.parseStateIntoStore(stateName);
    this.notifyListeners();
  }

  /** Load every deferred state (e.g. assignee grouping, search, move picker). */
  ensureAllDeferredStatesLoaded(): void {
    const pending = [...this.deferredUnloadedStates];
    if (pending.length === 0) {
      return;
    }
    for (const name of pending) {
      this.parseStateIntoStore(name);
    }
    this.notifyListeners();
  }

  /** Per-state counts for UI: heading count when deferred, else parsed task length. */
  getStateDisplayCounts(): Map<string, number> {
    const m = new Map<string, number>();
    for (const s of this.config.states) {
      const tasks = this.tasksByState.get(s.name) ?? [];
      if (this.deferredUnloadedStates.has(s.name)) {
        m.set(s.name, this.deferredSectionCounts.get(s.name) ?? 0);
      } else {
        m.set(s.name, tasks.length);
      }
    }
    return m;
  }

  isStateDeferredUnloaded(stateName: string): boolean {
    return this.deferredUnloadedStates.has(stateName);
  }

  getWarnings(): { fileName: string; warnings: ParseWarning[] }[] {
    return [...this.parseWarningsByFile.entries()]
      .filter(([, w]) => w.length > 0)
      .map(([fileName, warnings]) => ({ fileName, warnings }));
  }

  getTasksByState(stateName: string): Task[] {
    return this.tasksByState.get(stateName) ?? [];
  }

  getAllTasks(): Map<string, Task[]> {
    return new Map(this.tasksByState);
  }

  /**
   * Highest task-ID number across every state. Loaded states read from memory;
   * deferred states (Done/Rejected) scan raw file content so they stay deferred.
   */
  getMaxTaskIdNumber(): number {
    const prefix = this.config.idPrefix;
    let max = 0;
    for (const [stateName, tasks] of this.tasksByState) {
      if (this.deferredUnloadedStates.has(stateName)) {
        const state = this.findState(stateName);
        if (state) {
          const raw = this.fileStore.readRawContent(state);
          const n = maxTaskIdNumber(raw, prefix);
          if (n > max) {
            max = n;
          }
        }
        continue;
      }
      for (const task of tasks) {
        const parsed = this.idGenerator.parseId(task.id);
        if (parsed && parsed.prefix === prefix && parsed.number > max) {
          max = parsed.number;
        }
      }
    }

    // Archived tasks are not in any state, so without this nextId would forget them and reissue
    // their IDs. Scanned raw, like deferred states, rather than parsed.
    for (const fileName of this.fileStore.listArchiveFiles()) {
      const n = maxTaskIdNumber(this.fileStore.readArchiveRaw(fileName), prefix);
      if (n > max) max = n;
    }

    return max;
  }

  /**
   * Move completed tasks older than `archiveDoneAfterDays` out of Done into .tasks/archive/.
   * A no-op when the setting is absent, and idempotent: a second run finds nothing left to move.
   */
  archiveCompleted(now = new Date()): ArchiveResult {
    const afterDays = this.config.archiveDoneAfterDays ?? 0;
    const doneState = this.config.states.find((state) => state.name === 'Done');
    if (afterDays <= 0 || !doneState) return { archived: 0, files: [] };

    this.ensureStateLoaded(doneState.name);
    const { keep, byFile } = planArchive(this.getTasksByState(doneState.name), afterDays, now);

    let archived = 0;
    for (const [fileName, moving] of byFile) {
      // Append to whatever the file already holds so earlier runs are preserved.
      const existing = this.fileStore.readArchiveRaw(fileName);
      const existingTasks = existing ? parseTasks(existing).tasks : [];
      this.fileStore.writeArchive(fileName, archiveHeadingFor(fileName), [
        ...existingTasks,
        ...moving,
      ]);
      archived += moving.length;
    }

    if (byFile.size > 0) {
      this.tasksByState.set(doneState.name, keep);
      this.fileStore.writeState(doneState, keep);
      this.notifyListeners();
    }

    // Independent of whether any task moved: the log grows on its own schedule, and a board with
    // nothing old enough to archive can still have a log that does.
    const log = this.archiveWorkLog(afterDays, now);
    return { archived, files: [...byFile.keys(), ...log].sort() };
  }

  /**
   * Move work-log entries past the threshold into .tasks/archive/, on the same schedule as tasks.
   * WORK_LOG.md grows one entry per completed task forever, so archiving Done alone would leave
   * half the problem. Entries are moved as raw text: the log is prose a human wrote, and nothing
   * here should reformat it.
   */
  private archiveWorkLog(afterDays: number, now: Date): string[] {
    const content = this.fileStore.readWorkLog();
    if (!content.trim()) return [];

    const { header, entries } = splitWorkLog(content);
    const keep: typeof entries = [];
    const byFile = new Map<string, typeof entries>();

    for (const entry of entries) {
      if (!isDateArchivable(entry.date, afterDays, now)) {
        keep.push(entry);
        continue;
      }
      const fileName = workLogArchiveFileFor(entry);
      byFile.set(fileName, [...(byFile.get(fileName) ?? []), entry]);
    }

    if (byFile.size === 0) return [];

    for (const [fileName, moving] of byFile) {
      const existing = this.fileStore.readArchiveRaw(fileName);
      const prior = existing ? splitWorkLog(existing) : { header: '', entries: [] };
      const heading = `# ${archiveHeadingFor(fileName.replace('WORK_LOG', 'DONE'))} — work log`;
      this.fileStore.writeArchiveRaw(
        fileName,
        joinWorkLog(prior.header || heading, [...prior.entries, ...moving]),
      );
    }

    this.fileStore.writeWorkLog(joinWorkLog(header, keep));
    return [...byFile.keys()];
  }

  private findInMemory(taskId: string): { task: Task; stateName: string } | null {
    for (const [stateName, tasks] of this.tasksByState) {
      const task = tasks.find((t) => t.id === taskId);
      if (task) {
        return { task, stateName };
      }
    }
    return null;
  }

  findTask(taskId: string): { task: Task; stateName: string } | null {
    let hit = this.findInMemory(taskId);
    if (hit) {
      return hit;
    }
    const pending = [...this.deferredUnloadedStates];
    if (pending.length === 0) {
      return null;
    }
    for (const stateName of pending) {
      this.parseStateIntoStore(stateName);
      hit = this.findInMemory(taskId);
      if (hit) {
        this.notifyListeners();
        return hit;
      }
    }
    this.notifyListeners();
    return null;
  }

  createTask(task: Omit<Task, 'id'>, stateName: string): Task {
    const state = this.findState(stateName);
    if (!state) {
      throw new Error(`Unknown state: ${stateName}`);
    }
    this.ensureStateLoaded(stateName);

    this.configManager.reloadFromDisk();
    this.configManager.reconcileNextId(this.getMaxTaskIdNumber() + 1);
    const id = this.idGenerator.next();
    const newTask: Task = { ...task, id, updatedAt: currentTimestamp() };

    const tasks = this.getTasksByState(stateName);
    if (this.config.insertPosition === 'top') {
      tasks.unshift(newTask);
    } else {
      tasks.push(newTask);
    }

    this.tasksByState.set(stateName, tasks);
    this.fileStore.writeState(state, tasks);
    this.notifyListeners();
    return newTask;
  }

  moveTask(taskId: string, targetStateName: string, targetIndex?: number): Task | null {
    const found = this.findTask(taskId);
    if (!found) {
      return null;
    }
    this.ensureStateLoaded(targetStateName);

    const sourceState = this.findState(found.stateName);
    const targetState = this.findState(targetStateName);
    if (!sourceState || !targetState) {
      return null;
    }

    if (targetIndex !== undefined && found.stateName === targetStateName) {
      return this.reorderTaskToIndex(taskId, targetIndex) ? found.task : null;
    }

    // Remove from source
    const sourceTasks = this.getTasksByState(found.stateName).filter((t) => t.id !== taskId);
    this.tasksByState.set(found.stateName, sourceTasks);
    this.fileStore.writeState(sourceState, sourceTasks);

    // Add to target with updated timestamp
    found.task.updatedAt = currentTimestamp();
    const targetTasks = [...this.getTasksByState(targetStateName)].filter((t) => t.id !== taskId);
    if (targetIndex !== undefined) {
      const clamped = Math.max(0, Math.min(targetIndex, targetTasks.length));
      targetTasks.splice(clamped, 0, found.task);
    } else if (this.config.insertPosition === 'top') {
      targetTasks.unshift(found.task);
    } else {
      targetTasks.push(found.task);
    }
    this.tasksByState.set(targetStateName, targetTasks);
    this.fileStore.writeState(targetState, targetTasks);

    // Keep Done trimmed as work completes rather than letting it grow until someone notices.
    // Inert unless archiveDoneAfterDays is configured.
    if (targetStateName === 'Done') this.archiveCompleted();

    this.notifyListeners();
    return found.task;
  }

  deleteTask(taskId: string): boolean {
    const found = this.findTask(taskId);
    if (!found) {
      return false;
    }

    const state = this.findState(found.stateName);
    if (!state) {
      return false;
    }

    const tasks = this.getTasksByState(found.stateName).filter((t) => t.id !== taskId);
    this.tasksByState.set(found.stateName, tasks);
    this.fileStore.writeState(state, tasks);
    this.notifyListeners();
    return true;
  }

  updateTask(taskId: string, updates: Partial<Omit<Task, 'id'>>): Task | null {
    const found = this.findTask(taskId);
    if (!found) {
      return null;
    }

    const state = this.findState(found.stateName);
    if (!state) {
      return null;
    }

    // Skip write/notify if no fields actually changed
    if (!TaskStore.hasChanges(found.task, updates)) {
      return found.task;
    }

    const updatedTask: Task = {
      ...found.task,
      ...updates,
      id: taskId,
      updatedAt: currentTimestamp(),
    };
    const tasks = this.getTasksByState(found.stateName).map((t) =>
      t.id === taskId ? updatedTask : t,
    );
    this.tasksByState.set(found.stateName, tasks);
    this.fileStore.writeState(state, tasks);
    this.notifyListeners();
    return updatedTask;
  }

  private static hasChanges(task: Task, updates: Partial<Omit<Task, 'id'>>): boolean {
    for (const key of Object.keys(updates) as (keyof typeof updates)[]) {
      const oldVal = task[key];
      const newVal = updates[key];
      if (Array.isArray(oldVal) && Array.isArray(newVal)) {
        if (oldVal.length !== newVal.length || oldVal.some((v, i) => v !== newVal[i])) {
          return true;
        }
      } else if (oldVal !== newVal) {
        return true;
      }
    }
    return false;
  }

  reorderTaskToIndex(taskId: string, newIndex: number): boolean {
    const found = this.findTask(taskId);
    if (!found) {
      return false;
    }

    const state = this.findState(found.stateName);
    if (!state) {
      return false;
    }

    const tasks = [...this.getTasksByState(found.stateName)];
    const from = tasks.findIndex((t) => t.id === taskId);
    if (from === -1) {
      return false;
    }

    const to = Math.max(0, Math.min(newIndex, tasks.length - 1));
    if (from === to) {
      return true;
    }

    const [item] = tasks.splice(from, 1);
    tasks.splice(to, 0, item);
    this.tasksByState.set(found.stateName, tasks);
    this.fileStore.writeState(state, tasks);
    this.notifyListeners();
    return true;
  }

  reorderTask(taskId: string, direction: 'up' | 'down'): boolean {
    const found = this.findTask(taskId);
    if (!found) {
      return false;
    }

    const state = this.findState(found.stateName);
    if (!state) {
      return false;
    }

    const tasks = [...this.getTasksByState(found.stateName)];
    const index = tasks.findIndex((t) => t.id === taskId);
    if (index === -1) {
      return false;
    }

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= tasks.length) {
      return false;
    }

    [tasks[index], tasks[newIndex]] = [tasks[newIndex], tasks[index]];
    this.tasksByState.set(found.stateName, tasks);
    this.fileStore.writeState(state, tasks);
    this.notifyListeners();
    return true;
  }

  onDidChange(listener: TaskStoreListener): { dispose: () => void } {
    this.listeners.push(listener);
    return {
      dispose: () => {
        const index = this.listeners.indexOf(listener);
        if (index >= 0) {
          this.listeners.splice(index, 1);
        }
      },
    };
  }

  fixDuplicates(resolutions: DuplicateResolution[]): number {
    const neededStates = new Set<string>();
    for (const resolution of resolutions) {
      neededStates.add(resolution.keep.stateName);
      for (const dup of resolution.remove) {
        neededStates.add(dup.stateName);
      }
    }
    let loadedDeferred = false;
    for (const name of neededStates) {
      if (this.deferredUnloadedStates.has(name)) {
        this.parseStateIntoStore(name);
        loadedDeferred = true;
      }
    }

    let removedCount = 0;
    const removalsByState = new Map<string, Set<number>>();

    for (const resolution of resolutions) {
      for (const duplicate of resolution.remove) {
        const indexes = removalsByState.get(duplicate.stateName) ?? new Set<number>();
        indexes.add(duplicate.index);
        removalsByState.set(duplicate.stateName, indexes);
      }
    }

    for (const [stateName, indexes] of removalsByState) {
      const state = this.findState(stateName);
      if (!state) {
        continue;
      }

      const tasks = [...this.getTasksByState(stateName)];
      const sortedIndexes = [...indexes].sort((a, b) => b - a);
      for (const index of sortedIndexes) {
        if (index >= 0 && index < tasks.length) {
          tasks.splice(index, 1);
          removedCount++;
        }
      }

      this.tasksByState.set(stateName, tasks);
      this.fileStore.writeState(state, tasks);
    }

    if (removedCount > 0 || loadedDeferred) {
      this.notifyListeners();
    }

    return removedCount;
  }

  private findState(stateName: string): TaskState | undefined {
    return this.config.states.find((s) => s.name === stateName);
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}
