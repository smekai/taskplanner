import * as fs from 'fs';
import * as path from 'path';
import {
  generateAiInstructions,
  upsertMarkedSection,
  upsertReadmeAttribution,
} from '../ai/aiInstructions.js';
import { ConfigManager } from '../config/configManager.js';

export type VersionSyncStatus =
  | 'installed-newer'
  | 'equal'
  | 'installed-older'
  | 'legacy'
  | 'invalid-installed';

export interface VersionSyncComparison {
  status: VersionSyncStatus;
  installedVersion?: string;
  storedVersion?: string;
}

export interface ProjectSyncOptions {
  force?: boolean;
  syncInstructions?: boolean;
}

export interface ProjectSyncResult extends VersionSyncComparison {
  synchronized: boolean;
  updatedFiles: string[];
}

/**
 * Return a stable x.y.z version. SemVer build metadata, including +codex cachebusters,
 * deliberately has no effect on project synchronization.
 */
export function normalizeTaskPlannerVersion(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const match = /^(\d+)\.(\d+)\.(\d+)(?:\+[0-9A-Za-z.-]+)?$/.exec(value.trim());
  if (!match) return undefined;
  return `${Number(match[1])}.${Number(match[2])}.${Number(match[3])}`;
}

export function compareTaskPlannerVersions(
  installedValue: unknown,
  storedValue: unknown,
): VersionSyncComparison {
  const installedVersion = normalizeTaskPlannerVersion(installedValue);
  if (!installedVersion) return { status: 'invalid-installed' };

  const storedVersion = normalizeTaskPlannerVersion(storedValue);
  if (!storedVersion) return { status: 'legacy', installedVersion };

  const installedParts = installedVersion.split('.').map(Number);
  const storedParts = storedVersion.split('.').map(Number);
  for (let index = 0; index < installedParts.length; index++) {
    if (installedParts[index] > storedParts[index]) {
      return { status: 'installed-newer', installedVersion, storedVersion };
    }
    if (installedParts[index] < storedParts[index]) {
      return { status: 'installed-older', installedVersion, storedVersion };
    }
  }
  return { status: 'equal', installedVersion, storedVersion };
}

/**
 * Synchronize only TaskPlanner-owned marker blocks and safe config defaults.
 * The recorded version is persisted last so an interrupted sync retries next time.
 */
export function synchronizeTaskPlannerProject(
  workspaceRoot: string,
  configManager: ConfigManager,
  installedValue: unknown,
  options: ProjectSyncOptions = {},
): ProjectSyncResult {
  const comparison = compareTaskPlannerVersions(
    installedValue,
    configManager.get().taskplannerVersion,
  );
  if (comparison.status === 'invalid-installed') {
    throw new Error(`Invalid installed TaskPlanner version: ${String(installedValue)}`);
  }
  if (
    comparison.status === 'installed-older' ||
    (comparison.status === 'equal' && !options.force)
  ) {
    return { ...comparison, synchronized: false, updatedFiles: [] };
  }

  const config = configManager.get();
  const updatedFiles: string[] = [];

  if (options.syncInstructions !== false) {
    const instructions = generateAiInstructions(config);
    const managedFiles = [
      ['AGENTS.md', instructions.agentsMd],
      ['CLAUDE.md', instructions.claudeMd],
      ['.cursorrules', instructions.cursorRules],
    ] as const;

    for (const [relativePath, section] of managedFiles) {
      const filePath = path.join(workspaceRoot, relativePath);
      const existing = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : '';
      const updated = upsertMarkedSection(existing, section);
      if (updated !== existing) fs.writeFileSync(filePath, updated, 'utf-8');
      updatedFiles.push(relativePath);
    }
  }

  const readmePath = path.join(workspaceRoot, 'README.md');
  if (config.readmeAttribution && fs.existsSync(readmePath)) {
    const existing = fs.readFileSync(readmePath, 'utf-8');
    const updated = upsertReadmeAttribution(existing);
    if (updated !== existing) fs.writeFileSync(readmePath, updated, 'utf-8');
    updatedFiles.push('README.md');
  }

  const previousVersion = config.taskplannerVersion;
  configManager.update({ taskplannerVersion: comparison.installedVersion });
  try {
    configManager.save();
  } catch (error) {
    configManager.update({ taskplannerVersion: previousVersion });
    throw error;
  }

  return { ...comparison, synchronized: true, updatedFiles };
}
