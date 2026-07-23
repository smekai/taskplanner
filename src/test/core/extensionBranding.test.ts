import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

interface ExtensionManifest {
  icon: string;
  contributes: {
    viewsContainers: {
      activitybar: Array<{ icon: string }>;
    };
  };
}

describe('extension branding', () => {
  it('uses the branded logo in marketplaces and the checkmark in the activity bar', () => {
    const manifest = JSON.parse(
      readFileSync(resolve('package.json'), 'utf8'),
    ) as ExtensionManifest;
    const activityBarIcon = manifest.contributes.viewsContainers.activitybar[0].icon;
    const activityBarSvg = readFileSync(resolve(activityBarIcon), 'utf8');

    expect(manifest.icon).toBe('resources/icons/taskplanner-color.png');
    expect(activityBarIcon).toBe('resources/icons/taskplanner.svg');
    expect(activityBarSvg).toContain(
      'd="M 20 68 L 50 98 L 108 30"',
    );
    expect(activityBarSvg).not.toContain('<image');
  });
});
