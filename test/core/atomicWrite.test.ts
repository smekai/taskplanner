import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  RenameFile,
  renameWithRetry,
  tempPathFor,
  writeFileAtomic,
} from '../../src/core/store/atomicWrite.js';

function errorWithCode(code: string): NodeJS.ErrnoException {
  return Object.assign(new Error(`${code}: rename`), { code });
}

function failingRename(code: string, failures: number): RenameFile & { calls: number } {
  const rename = ((from: string, to: string) => {
    rename.calls += 1;
    if (rename.calls <= failures) throw errorWithCode(code);
    fs.renameSync(from, to);
  }) as RenameFile & { calls: number };
  rename.calls = 0;
  return rename;
}

describe('writeFileAtomic', () => {
  let tmpDir: string;
  let target: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'taskplanner-atomic-write-'));
    target = path.join(tmpDir, 'BACKLOG.md');
    fs.writeFileSync(target, 'before');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  const leftovers = () => fs.readdirSync(tmpDir).filter((name) => name !== 'BACKLOG.md');

  it('replaces the file and leaves no temporary file behind', () => {
    writeFileAtomic(target, 'after');

    expect(fs.readFileSync(target, 'utf8')).toBe('after');
    expect(leftovers()).toEqual([]);
  });

  // Two writers sharing one `<file>.tmp` collided on Windows; each write needs its own.
  it('gives every write its own temporary file', () => {
    const first = tempPathFor(target);
    const second = tempPathFor(target);

    expect(first).not.toBe(second);
    expect(first).not.toBe(`${target}.tmp`);
    expect(path.dirname(first)).toBe(tmpDir);
  });

  it('retries a rename Windows refuses while the file is held open', () => {
    const rename = failingRename('EPERM', 2);

    writeFileAtomic(target, 'after', rename);

    expect(rename.calls).toBe(3);
    expect(fs.readFileSync(target, 'utf8')).toBe('after');
    expect(leftovers()).toEqual([]);
  });

  it('gives up after the retries, keeps the old file and removes the temporary one', () => {
    const rename = failingRename('EBUSY', Number.POSITIVE_INFINITY);

    expect(() => writeFileAtomic(target, 'after', rename)).toThrow('EBUSY');

    expect(rename.calls).toBe(6);
    expect(fs.readFileSync(target, 'utf8')).toBe('before');
    expect(leftovers()).toEqual([]);
  });

  it('does not retry an error that waiting cannot fix', () => {
    const rename = failingRename('ENOSPC', 1);

    expect(() => renameWithRetry('a', 'b', rename)).toThrow('ENOSPC');
    expect(rename.calls).toBe(1);
  });
});
