import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

interface ExtensionManifest {
  contributes: {
    configuration: {
      properties: Record<string, { default?: unknown }>;
    };
  };
}

describe('extension configuration', () => {
  it('enables Cursor Plan-mode automation by default', () => {
    const manifest = JSON.parse(readFileSync(resolve('package.json'), 'utf8')) as ExtensionManifest;

    expect(
      manifest.contributes.configuration.properties['taskplanner.cursorPlanAndSubmitAfterOpen']
        .default,
    ).toBe(true);
  });
});
