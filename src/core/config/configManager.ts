import * as fs from 'fs';
import * as path from 'path';
import { TaskPlannerConfig, createDefaultConfig } from '../model/config.js';
import { TaskState, DEFAULT_STATES } from '../model/state.js';

/** Task-file schema version this build writes. Bump when migrateConfig gains a step. */
const CONFIG_SCHEMA_VERSION = 3;

/** A problem found while loading config.json. Reported, never thrown — a broken config must not
 * take down the extension or an MCP tool call, but the user has to learn their settings were
 * ignored. Consumers decide how to surface these. */
export interface ConfigDiagnostic {
  message: string;
}

function isUsableState(value: unknown): value is TaskState {
  if (!value || typeof value !== 'object') return false;
  const state = value as Partial<TaskState>;
  return (
    typeof state.name === 'string' &&
    state.name.length > 0 &&
    typeof state.fileName === 'string' &&
    state.fileName.length > 0 &&
    typeof state.order === 'number' &&
    Number.isFinite(state.order)
  );
}

/**
 * Bring `states` to something every consumer can use. A malformed entry reaches
 * `path.join(tasksDir, state.fileName)` in FileStore and fails on `undefined`, so this is not
 * cosmetic. Entries naming a known state are repaired from DEFAULT_STATES; anything left unusable
 * costs the whole list, because a partial board is worse than the default one.
 */
function normalizeStates(value: unknown, report: (message: string) => void): TaskState[] {
  if (!Array.isArray(value)) {
    report(`"states" must be an array of {name, fileName, order}; using the default board.`);
    return [...DEFAULT_STATES];
  }

  const normalized: TaskState[] = [];
  for (const entry of value) {
    if (isUsableState(entry)) {
      normalized.push({ name: entry.name, fileName: entry.fileName, order: entry.order });
      continue;
    }

    // A bare string is the shape seen in the wild: ["Backlog", "Next", ...].
    const name = typeof entry === 'string' ? entry : (entry as Partial<TaskState>)?.name;
    const known = DEFAULT_STATES.find((s) => s.name === name);
    if (known) {
      report(`State "${known.name}" was malformed in config.json; restored from the defaults.`);
      normalized.push({ ...known });
      continue;
    }

    report(
      `Unusable entry in "states": ${JSON.stringify(entry)}. Using the default board instead.`,
    );
    return [...DEFAULT_STATES];
  }

  if (normalized.length === 0) {
    report(`"states" was empty; using the default board.`);
    return [...DEFAULT_STATES];
  }
  return normalized;
}

export class ConfigManager {
  private config: TaskPlannerConfig;
  private configPath: string;
  private diagnostics: ConfigDiagnostic[] = [];

  constructor(private tasksDir: string) {
    this.configPath = path.join(tasksDir, 'config.json');
    this.config = createDefaultConfig();
  }

  /** Problems found by the most recent load. Empty when config.json was clean or absent. */
  getDiagnostics(): readonly ConfigDiagnostic[] {
    return this.diagnostics;
  }

  load(): TaskPlannerConfig {
    this.diagnostics = [];
    this.config = this.readFromDisk();
    this.migrateConfig();
    return this.config;
  }

  /** Re-read config.json without running migrations — picks up concurrent writes. */
  reloadFromDisk(): void {
    if (!fs.existsSync(this.configPath)) {
      return;
    }
    this.diagnostics = [];
    this.config = this.readFromDisk();
  }

  /** Parse and normalize config.json, recording problems instead of throwing. */
  private readFromDisk(): TaskPlannerConfig {
    if (!fs.existsSync(this.configPath)) return createDefaultConfig();

    const report = (message: string) => this.diagnostics.push({ message });
    let parsed: Partial<TaskPlannerConfig> = {};
    try {
      const raw = fs.readFileSync(this.configPath, 'utf-8');
      const value: unknown = raw.trim().length > 0 ? JSON.parse(raw) : {};
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        report('config.json is not a JSON object; using defaults.');
      } else {
        parsed = value as Partial<TaskPlannerConfig>;
      }
    } catch (error) {
      report(`config.json could not be parsed (${(error as Error).message}); using defaults.`);
    }

    const merged = { ...createDefaultConfig(), ...parsed };
    // Only judge `states` when the file actually supplied one. Otherwise the default is simply the
    // default, and complaining about it would bury the real problem under a second, false message.
    if (parsed.states !== undefined) {
      merged.states = normalizeStates(parsed.states, report);
    }
    return merged;
  }

  private migrateConfig(): void {
    let changed = false;

    // v2: Add "Rejected" state if missing
    if (!this.config.states.some((s) => s.name === 'Rejected')) {
      this.config.states.push({ name: 'Rejected', fileName: 'REJECTED.md', order: 4 });
      changed = true;
    }

    // v3: Drop "sortBy". It was never read — sort order is a view setting, not project layout —
    // and sitting beside insertPosition it read as a file-ordering contract.
    const legacy = this.config as TaskPlannerConfig & { sortBy?: unknown };
    if (legacy.sortBy !== undefined) {
      delete legacy.sortBy;
      changed = true;
    }

    // Record the schema the file has been brought up to, whether or not this run had anything to
    // change — otherwise a v2 config that already happens to match v3 stays labelled v2 forever.
    // Never downgrade: a file written by a newer TaskPlanner keeps its own version.
    if (this.config.version < CONFIG_SCHEMA_VERSION) {
      this.config.version = CONFIG_SCHEMA_VERSION;
      changed = true;
    }

    if (changed) {
      this.save();
    }
  }

  save(): void {
    if (!fs.existsSync(this.tasksDir)) {
      fs.mkdirSync(this.tasksDir, { recursive: true });
    }
    fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2) + '\n', 'utf-8');
  }

  get(): TaskPlannerConfig {
    return this.config;
  }

  getTasksDir(): string {
    return this.tasksDir;
  }

  update(partial: Partial<TaskPlannerConfig>): void {
    this.config = { ...this.config, ...partial };
  }

  getNextId(): string {
    const id = `${this.config.idPrefix}-${String(this.config.nextId).padStart(3, '0')}`;
    this.config.nextId++;
    this.save();
    return id;
  }

  /** Raise `nextId` to `floor` if it is below. Returns true when config changed. */
  reconcileNextId(floor: number): boolean {
    if (this.config.nextId < floor) {
      this.config.nextId = floor;
      this.save();
      return true;
    }
    return false;
  }
}
