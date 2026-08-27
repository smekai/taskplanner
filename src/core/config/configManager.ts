import * as fs from 'fs';
import * as path from 'path';
import { TaskPlannerConfig, createDefaultConfig } from '../model/config.js';

export class ConfigManager {
  private config: TaskPlannerConfig;
  private configPath: string;

  constructor(private tasksDir: string) {
    this.configPath = path.join(tasksDir, 'config.json');
    this.config = createDefaultConfig();
  }

  load(): TaskPlannerConfig {
    if (fs.existsSync(this.configPath)) {
      const raw = fs.readFileSync(this.configPath, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<TaskPlannerConfig>;
      this.config = { ...createDefaultConfig(), ...parsed };
      this.migrateConfig();
    } else {
      this.config = createDefaultConfig();
    }
    return this.config;
  }

  /** Re-read config.json without running migrations — picks up concurrent writes. */
  reloadFromDisk(): void {
    if (!fs.existsSync(this.configPath)) {
      return;
    }
    const raw = fs.readFileSync(this.configPath, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<TaskPlannerConfig>;
    this.config = { ...createDefaultConfig(), ...parsed };
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

    if (changed) {
      this.config.version = 3;
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
