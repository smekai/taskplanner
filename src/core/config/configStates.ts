import { TaskState, DEFAULT_STATES } from '../model/state.js';

export type ConfigReport = (message: string) => void;

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

export function normalizeStates(value: unknown, report: ConfigReport): TaskState[] {
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
