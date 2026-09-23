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

export function openBoard(tasksDir: string, options: OpenBoardOptions = {}): OpenedBoard {
  const configManager = new ConfigManager(tasksDir);
  const fileStore = new FileStore(tasksDir);

  if (options.initialize && !boardExists(tasksDir)) {
    configManager.save();
    fileStore.initializeStateFiles(configManager.get());
  }

  configManager.load({ persistMigration: options.persistMigration ?? false });
  const taskStore = new TaskStore(configManager, fileStore);
  taskStore.reload();
  return { configManager, fileStore, taskStore };
}
