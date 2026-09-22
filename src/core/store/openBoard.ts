import * as fs from 'fs';
import * as path from 'path';
import { ConfigManager } from '../config/configManager.js';
import { FileStore } from './fileStore.js';
import { TaskStore } from './taskStore.js';

export interface OpenBoardOptions {
  initialize?: boolean;
  persistMigration?: boolean;
}

export interface OpenedBoard {
  configManager: ConfigManager;
  fileStore: FileStore;
  taskStore: TaskStore;
}

export function boardExists(tasksDir: string): boolean {
  return fs.existsSync(path.join(tasksDir, 'config.json'));
}

export function initializeBoard(tasksDir: string): OpenedBoard {
  const configManager = new ConfigManager(tasksDir);
  const fileStore = new FileStore(tasksDir);
  configManager.load();
  configManager.save();
  fileStore.initializeStateFiles(configManager.get());
  return openWith(configManager, fileStore, true);
}

export function openBoard(tasksDir: string, options: OpenBoardOptions = {}): OpenedBoard {
  if (options.initialize && !boardExists(tasksDir)) {
    return initializeBoard(tasksDir);
  }
  return openWith(
    new ConfigManager(tasksDir),
    new FileStore(tasksDir),
    options.persistMigration ?? false,
  );
}

function openWith(
  configManager: ConfigManager,
  fileStore: FileStore,
  persistMigration: boolean,
): OpenedBoard {
  configManager.load({ persistMigration });
  const taskStore = new TaskStore(configManager, fileStore);
  taskStore.reload();
  return { configManager, fileStore, taskStore };
}
