import * as fs from 'fs';

export type RenameFile = (from: string, to: string) => void;

const RETRYABLE_RENAME_CODES = new Set(['EPERM', 'EBUSY', 'EACCES']);
const RENAME_RETRY_DELAYS_MS = [10, 25, 50, 100, 200];

let tempSequence = 0;

function pause(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function isRetryableRename(error: unknown): boolean {
  return RETRYABLE_RENAME_CODES.has((error as NodeJS.ErrnoException).code ?? '');
}

export function tempPathFor(filePath: string): string {
  tempSequence += 1;
  return `${filePath}.${process.pid}.${tempSequence}.tmp`;
}

// WHY: Windows refuses a rename while another handle holds the target open (a second writer, an editor, antivirus); it clears within milliseconds.
export function renameWithRetry(
  from: string,
  to: string,
  rename: RenameFile = fs.renameSync,
): void {
  for (const delay of RENAME_RETRY_DELAYS_MS) {
    try {
      rename(from, to);
      return;
    } catch (error) {
      if (!isRetryableRename(error)) throw error;
      pause(delay);
    }
  }
  rename(from, to);
}

export function writeFileAtomic(
  filePath: string,
  content: string,
  rename: RenameFile = fs.renameSync,
): void {
  const tempPath = tempPathFor(filePath);
  fs.writeFileSync(tempPath, content, 'utf-8');
  try {
    renameWithRetry(tempPath, filePath, rename);
  } catch (error) {
    fs.rmSync(tempPath, { force: true });
    throw error;
  }
}
