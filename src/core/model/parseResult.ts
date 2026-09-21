import { Task } from './task.js';

export interface ParseIssue {
  line: number;
  message: string;
  raw?: string;
}

export type ParseWarning = ParseIssue;

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
  errors: ParseIssue[];
  warnings: ParseIssue[];
  segments: BoardSegment[];
}
