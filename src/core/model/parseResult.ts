import { Task } from './task.js';

export interface ParseWarning {
  line: number;
  message: string;
}

export interface TextSegment {
  kind: 'text';
  raw: string;
}

export interface TaskSegment {
  kind: 'task';
  task: Task;
  raw: string;
}

export type BoardSegment = TextSegment | TaskSegment;

export interface ParseResult {
  tasks: Task[];
  warnings: ParseWarning[];
  segments: BoardSegment[];
}
