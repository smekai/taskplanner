import * as fs from 'fs';
import { promises as fsPromises } from 'fs';
import * as path from 'path';
import { Task } from '../model/task.js';
import { TaskState } from '../model/state.js';
import { TaskPlannerConfig } from '../model/config.js';
import { ParseResult } from '../model/parseResult.js';
import { parseTasks } from '../parser/taskParser.js';
import { serializeStateFile } from '../parser/taskSerializer.js';
import { DEFAULT_WORK_LOG_CONTENT } from '../ai/aiInstructions.js';

export class FileStore {
  constructor(private tasksDir: string) {}

  readState(state: TaskState): ParseResult {
    const filePath = path.join(this.tasksDir, state.fileName);
    if (!fs.existsSync(filePath)) {
      return { tasks: [], warnings: [] };
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    return parseTasks(content);
  }

  writeState(state: TaskState, tasks: Task[]): void {
    const filePath = path.join(this.tasksDir, state.fileName);
    const content = serializeStateFile(state.name, tasks);
    fs.writeFileSync(filePath, content, 'utf-8');
  }

  readAllStates(config: TaskPlannerConfig): Map<string, ParseResult> {
    const result = new Map<string, ParseResult>();
    for (const state of config.states) {
      result.set(state.name, this.readState(state));
    }
    return result;
  }

  async readStateAsync(state: TaskState): Promise<ParseResult> {
    const filePath = path.join(this.tasksDir, state.fileName);
    try {
      const content = await fsPromises.readFile(filePath, 'utf-8');
      return parseTasks(content);
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') {
        return { tasks: [], warnings: [] };
      }
      throw e;
    }
  }

  async readRawContentAsync(state: TaskState): Promise<string> {
    const filePath = path.join(this.tasksDir, state.fileName);
    try {
      return await fsPromises.readFile(filePath, 'utf-8');
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') {
        return '';
      }
      throw e;
    }
  }

  async readAllStatesAsync(config: TaskPlannerConfig): Promise<Map<string, ParseResult>> {
    const result = new Map<string, ParseResult>();
    for (const state of config.states) {
      result.set(state.name, await this.readStateAsync(state));
    }
    return result;
  }

  ensureDirectory(): void {
    if (!fs.existsSync(this.tasksDir)) {
      fs.mkdirSync(this.tasksDir, { recursive: true });
    }
  }

  initializeStateFiles(config: TaskPlannerConfig): void {
    this.ensureDirectory();
    for (const state of config.states) {
      const filePath = path.join(this.tasksDir, state.fileName);
      if (!fs.existsSync(filePath)) {
        const content = serializeStateFile(state.name, []);
        fs.writeFileSync(filePath, content, 'utf-8');
      }
    }
    const workLogPath = path.join(this.tasksDir, 'WORK_LOG.md');
    if (!fs.existsSync(workLogPath)) {
      fs.writeFileSync(workLogPath, DEFAULT_WORK_LOG_CONTENT, 'utf-8');
    }
  }

  getStateFilePath(state: TaskState): string {
    return path.join(this.tasksDir, state.fileName);
  }

  readRawContent(state: TaskState): string {
    const filePath = path.join(this.tasksDir, state.fileName);
    if (!fs.existsSync(filePath)) {
      return '';
    }
    return fs.readFileSync(filePath, 'utf-8');
  }
}
