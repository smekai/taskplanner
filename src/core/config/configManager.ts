import * as fs from 'fs';
import * as path from 'path';
import { TaskPlannerConfig, createDefaultConfig } from '../model/config.js';
import { normalizeStates } from './configStates.js';

const CONFIG_SCHEMA_VERSION = 3;

export interface ConfigDiagnostic {
  message: string;
}

export interface LoadOptions {
  persistMigration?: boolean;
}

type Report = (message: string) => void;

const isStringArray = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((item) => typeof item === 'string');

const FIELDS: Record<string, (value: unknown) => boolean> = {
  version: (v) => typeof v === 'number' && Number.isFinite(v),
  taskplannerVersion: (v) => typeof v === 'string',
  idPrefix: (v) => typeof v === 'string' && v.length > 0,
  nextId: (v) => typeof v === 'number' && Number.isInteger(v) && v >= 1,
  priorities: (v) => isStringArray(v) && v.length > 0,
  tags: isStringArray,
  insertPosition: (v) => v === 'top' || v === 'bottom',
  aiPlanRequired: (v) => typeof v === 'boolean',
  readmeAttribution: (v) => typeof v === 'boolean',
  mcpConfig: (v) => v === 'written' || v === 'declined',
  archiveDoneAfterDays: (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0,
};

export class ConfigManager {
  private config: TaskPlannerConfig;
  private configPath: string;
  private diagnostics: ConfigDiagnostic[] = [];
  private unreadableRaw: string | null = null;

  constructor(private tasksDir: string) {
    this.configPath = path.join(tasksDir, 'config.json');
    this.config = createDefaultConfig();
  }

  getDiagnostics(): readonly ConfigDiagnostic[] {
    return this.diagnostics;
  }

  isConfigUnreadable(): boolean {
    return this.unreadableRaw !== null;
  }

  load(options: LoadOptions = {}): TaskPlannerConfig {
    this.diagnostics = [];
    this.config = this.readFromDisk();
    this.migrateConfig(options.persistMigration ?? true);
    return this.config;
  }

  reloadFromDisk(): void {
    this.diagnostics = [];
    this.config = this.readFromDisk();
  }

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
      this.unreadableRaw = fs.readFileSync(this.configPath, 'utf-8');
      report(`config.json could not be parsed (${(error as Error).message}); using defaults.`);
    }

    const defaults = createDefaultConfig() as unknown as Record<string, unknown>;
    const merged: Record<string, unknown> = { ...parsed };

    for (const [key, isValid] of Object.entries(FIELDS)) {
      if (!(key in parsed)) {
        merged[key] = defaults[key];
      } else if (isValid(parsed[key])) {
        merged[key] = parsed[key];
      } else {
        report(`"${key}" in config.json is not valid; using ${JSON.stringify(defaults[key])}.`);
        merged[key] = defaults[key];
      }
    }
    merged.states =
      parsed.states !== undefined ? normalizeStates(parsed.states, report) : defaults.states;

    return merged as unknown as TaskPlannerConfig;
  }

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
      this.diagnostics.push({
        message:
          'config.json could not be parsed and no backup could be written; it was left as is.',
      });
      this.unreadableRaw = raw;
    }
  }

  private addRejectedState(): boolean {
    if (this.config.states.some((s) => s.name === 'Rejected')) return false;
    this.config.states.push({ name: 'Rejected', fileName: 'REJECTED.md', order: 4 });
    return true;
  }

  private dropLegacySortBy(): boolean {
    const legacy = this.config as TaskPlannerConfig & { sortBy?: unknown };
    if (legacy.sortBy === undefined) return false;
    delete legacy.sortBy;
    return true;
  }

  private recordSchemaVersion(): boolean {
    if (this.config.version >= CONFIG_SCHEMA_VERSION) return false;
    this.config.version = CONFIG_SCHEMA_VERSION;
    return true;
  }

  private migrateConfig(persist: boolean): void {
    const steps = [this.addRejectedState(), this.dropLegacySortBy(), this.recordSchemaVersion()];
    if (persist && steps.some(Boolean)) {
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

  reconcileNextId(floor: number): boolean {
    if (this.config.nextId < floor) {
      this.config.nextId = floor;
      this.save();
      return true;
    }
    return false;
  }
}
