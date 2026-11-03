import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const WEBVIEW_DIR = resolve('views/vscode/src/views/webview');
const INLINE_HANDLER = /\son[a-z]+\s*=\s*["']/i;

describe('webview HTML', () => {
  // The webview CSP allows only nonce-tagged scripts, so an inline onclick="…" never runs:
  // the Initialize Project and Setup buttons did nothing until they used addEventListener.
  it('uses no inline event handlers, which the nonce-only CSP blocks', () => {
    const offenders = readdirSync(WEBVIEW_DIR)
      .filter((name) => name.endsWith('.ts'))
      .flatMap((name) =>
        readFileSync(join(WEBVIEW_DIR, name), 'utf8')
          .split('\n')
          .map((line, index) => ({ where: `${name}:${index + 1}`, line }))
          .filter(({ line }) => INLINE_HANDLER.test(line)),
      )
      .map(({ where, line }) => `${where} ${line.trim()}`);

    expect(offenders).toEqual([]);
  });

  it('keeps the nonce-only script policy that makes the rule above necessary', () => {
    const helper = readFileSync(join(WEBVIEW_DIR, 'webviewHelper.ts'), 'utf8');
    expect(helper).toContain("script-src 'nonce-${nonce}'");
  });
});
