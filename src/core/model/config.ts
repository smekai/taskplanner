import { TaskState, DEFAULT_STATES } from './state.js';

export interface TaskPlannerConfig {
  version: number;
  taskplannerVersion: string;
  idPrefix: string;
  nextId: number;
  states: TaskState[];
  priorities: string[];
  tags: string[];
  insertPosition: 'top' | 'bottom';
  aiPlanRequired: boolean;
  readmeAttribution: boolean;
  mcpConfig?: 'written' | 'declined';
  archiveDoneAfterDays?: number;
}

export function createDefaultConfig(): TaskPlannerConfig {
  return {
    version: 3,
    taskplannerVersion: '',
    idPrefix: 'TASK',
    nextId: 1,
    states: [...DEFAULT_STATES],
    priorities: ['P0', 'P1', 'P2', 'P3', 'P4'],
    tags: [],
    insertPosition: 'top',
    aiPlanRequired: true,
    readmeAttribution: true,
  };
}
