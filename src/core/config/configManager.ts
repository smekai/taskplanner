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

type Report = (message: string) => void;

/**
 * Per-field decoders. Every field of TaskPlannerConfig goes through one, so the object handed to
 * consumers matches its declared type at runtime rather than only at compile time — a spread of
 * parsed JSON guarantees nothing. Each returns the default and reports when the stored value is
 * unusable; unknown keys pass through untouched so a newer TaskPlanner's settings survive a
 * round-trip through an older one.
 */
const DECODERS: {
  [K in keyof TaskPlannerConfig]?: (value: unknown, fallback: unknown, report: Report) => unknown;
} = {
  version: (v, d, r) => expectNumber(v, d, r, 'version'),
  taskplannerVersion: (v, d, r) => expectString(v, d, r, 'taskplannerVersion', true),
  idPrefix: (v, d, r) => expectString(v, d, r, 'idPrefix'),
  nextId: (v, d, r) => {
    const n = expectNumber(v, d, r, 'nextId');
    if (typeof n === 'number' && (n < 1 || !Number.isInteger(n))) {
      r(`"nextId" must be a positive whole number; using ${String(d)}.`);
      return d;
    }
    return n;
  },
  priorities: (v, d, r) => expectStringArray(v, d, r, 'priorities', true),
  tags: (v, d, r) => expectStringArray(v, d, r, 'tags', false),
  insertPosition: (v, d, r) => expectEnum(v, d, r, 'insertPosition', ['top', 'bottom']),
  aiPlanRequired: (v, d, r) => expectBoolean(v, d, r, 'aiPlanRequired'),
  readmeAttribution: (v, d, r) => expectBoolean(v, d, r, 'readmeAttribution'),
  mcpConfig: (v, d, r) =>
    v === undefined ? undefined : expectEnum(v, d, r, 'mcpConfig', ['written', 'declined']),
  archiveDoneAfterDays: (v, _d, r) => {
    if (v === undefined) return undefined;
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
      r(`"archiveDoneAfterDays" must be a non-negative number; archiving stays off.`);
      return undefined;
    }
    return v;
  },
};

function expectNumber(value: unknown, fallback: unknown, report: Report, key: string): unknown {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  report(`"${key}" must be a number; using ${String(fallback)}.`);
  return fallback;
}

function expectString(
  value: unknown,
  fallback: unknown,
  report: Report,
  key: string,
  allowEmpty = false,
): unknown {
  if (typeof value === 'string' && (allowEmpty || value.length > 0)) return value;
  report(`"${key}" must be a non-empty string; using the default.`);
  return fallback;
}

function expectBoolean(value: unknown, fallback: unknown, report: Report, key: string): unknown {
  if (typeof value === 'boolean') return value;
  report(`"${key}" must be true or false; using ${String(fallback)}.`);
  return fallback;
}

function expectEnum(
  value: unknown,
  fallback: unknown,
  report: Report,
  key: string,
  allowed: readonly string[],
): unknown {
  if (typeof value === 'string' && allowed.includes(value)) return value;
  report(`"${key}" must be one of ${allowed.join(', ')}; using ${String(fallback)}.`);
  return fallback;
}

function expectStringArray(
  value: unknown,
  fallback: unknown,
  report: Report,
  key: string,
  requireNonEmpty: boolean,
): unknown {
  if (Array.isArray(value) && value.every((item) => typeof item === 'string')) {
    if (!requireNonEmpty || value.length > 0) return value;
  }
  report(
    `"${key}" must be an array of strings${requireNonEmpty ? ' with at least one entry' : ''}; using the default.`,
  );
  return fallback;
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
  /** Raw bytes of a config.json we could not parse, held until a write preserves them. */
  private unreadableRaw: string | null = null;

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
    this.unreadableRaw = null;
    if (!fs.existsSync(this.configPath)) return createDefaultConfig();

    const report: Report = (message) => this.diagnostics.push({ message });
    let parsed: Record<string, unknown> = {};
    try {
      const raw = fs.readFileSync(this.configPath, 'utf-8');
      const value: unknown = raw.trim().length > 0 ? JSON.parse(raw) : {};
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        this.unreadableRaw = raw;
        report('config.json is not a JSON object; using defaults.');
      } else {
        parsed = value as Record<string, unknown>;
      }
    } catch (error) {
      // Keep the bytes so save() can preserve them instead of overwriting a file the user may
      // still be able to repair by hand.
      this.unreadableRaw = fs.readFileSync(this.configPath, 'utf-8');
      report(`config.json could not be parsed (${(error as Error).message}); using defaults.`);
    }

    const defaults = createDefaultConfig() as unknown as Record<string, unknown>;
    // Unknown keys pass through, so settings written by a newer TaskPlanner survive a round-trip.
    const merged: Record<string, unknown> = { ...parsed };

    for (const [key, decode] of Object.entries(DECODERS)) {
      // Absent means "use the default" and is not worth a diagnostic.
      merged[key] = key in parsed ? decode(parsed[key], defaults[key], report) : defaults[key];
    }
    merged.states =
      parsed.states !== undefined ? normalizeStates(parsed.states, report) : defaults.states;

    return merged as unknown as TaskPlannerConfig;
  }

  /**
   * Preserve a config we could not parse before replacing it. Loading is fail-open so the board
   * stays usable, but the first write would otherwise erase settings the user could have repaired —
   * and writes are not rare: allocating a task ID saves the config.
   */
  private quarantineUnreadable(): void {
    const raw = this.unreadableRaw;
    this.unreadableRaw = null;
    if (raw === null) return;

    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(this.tasksDir, `config.invalid-${stamp}.json`);
    try {
      fs.writeFileSync(backupPath, raw, 'utf-8');
      this.diagnostics.push({
        message: `The unreadable config.json was preserved as ${path.basename(backupPath)} before defaults were written.`,
      });
    } catch {
      // If the backup cannot be written, keep the original rather than losing it silently.
      this.diagnostics.push({
        message:
          'config.json could not be parsed and no backup could be written; it was left as is.',
      });
      this.unreadableRaw = raw;
    }
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
    this.quarantineUnreadable();
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
