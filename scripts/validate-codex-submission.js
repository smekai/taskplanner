const fs = require('fs');
const path = require('path');

function fail(message) {
  console.error(`[codex-submission] ERROR: ${message}`);
  process.exitCode = 1;
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    fail(`Failed to read JSON at ${filePath}: ${error.message}`);
    return null;
  }
}

function assertExists(filePath, label) {
  if (!fs.existsSync(filePath)) {
    fail(`${label} not found: ${filePath}`);
    return false;
  }
  return true;
}

function listFiles(root) {
  const files = [];

  function visit(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) visit(fullPath);
      else files.push(path.relative(root, fullPath).replaceAll('\\', '/'));
    }
  }

  visit(root);
  return files.sort();
}

function validateCopiedTree(source, destination, label) {
  if (!assertExists(destination, label)) return;

  const sourceFiles = listFiles(source);
  const destinationFiles = listFiles(destination);
  if (JSON.stringify(destinationFiles) !== JSON.stringify(sourceFiles)) {
    fail(`${label} file tree does not match its source.`);
    return;
  }

  for (const relativePath of sourceFiles) {
    const sourceContent = fs.readFileSync(path.join(source, relativePath));
    const destinationContent = fs.readFileSync(path.join(destination, relativePath));
    if (!sourceContent.equals(destinationContent)) {
      fail(`${label} file differs from source: ${relativePath}`);
    }
  }
}

function main() {
  const root = path.resolve(__dirname, '..');
  const packageJson = readJson(path.join(root, 'package.json'));
  if (!packageJson) return;

  const pluginRoot = path.join(root, 'plugins', 'taskplanner');
  const submissionPath = path.join(pluginRoot, '.codex-plugin', 'submission.json');
  const submission = readJson(submissionPath);
  if (!submission) return;

  const skillsRoot = path.join(pluginRoot, 'skills');
  const packageRoot = path.join(
    root,
    'dist',
    'codex',
    `taskplanner-codex-skills-${packageJson.version}`,
  );

  if (submission.submissionType !== 'Skills only') fail('Submission type must be Skills only.');
  if (submission.version !== packageJson.version) {
    fail(`Submission version must match package.json (${packageJson.version}).`);
  }
  if (submission.positiveTestCases?.length !== 5) {
    fail('Submission must contain exactly five positive test cases.');
  }
  if (submission.negativeTestCases?.length !== 3) {
    fail('Submission must contain exactly three negative test cases.');
  }
  if (submission.starterPrompts?.length < 2) fail('At least two starter prompts are required.');

  for (const field of [
    'name',
    'shortDescription',
    'longDescription',
    'category',
    'websiteUrl',
    'supportUrl',
    'privacyPolicyUrl',
    'termsUrl',
    'releaseNotes',
  ]) {
    if (!submission[field]) fail(`Missing submission field: ${field}.`);
  }

  for (const field of ['websiteUrl', 'supportUrl', 'privacyPolicyUrl', 'termsUrl']) {
    if (!String(submission[field]).startsWith('https://')) fail(`${field} must use HTTPS.`);
  }

  for (const fileName of ['PRIVACY.md', 'TERMS.md']) {
    assertExists(path.join(root, fileName), fileName);
  }

  const skillNames = fs
    .readdirSync(skillsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
  for (const skillName of skillNames) {
    const skillPath = path.join(skillsRoot, skillName, 'SKILL.md');
    if (!assertExists(skillPath, `${skillName}/SKILL.md`)) continue;
    const content = fs.readFileSync(skillPath, 'utf8');
    if (content.includes('[TODO:')) fail(`${skillName} still contains a TODO placeholder.`);
  }

  const primary = fs.readFileSync(path.join(skillsRoot, 'taskplanner', 'SKILL.md'), 'utf8');
  if (!primary.includes('direct file')) fail('Primary skill must document direct file fallback.');
  const update = fs.readFileSync(path.join(skillsRoot, 'update-taskplanner', 'SKILL.md'), 'utf8');
  if (!update.includes('Only after all writes succeed')) {
    fail('Update skill must record the version only after successful synchronization.');
  }

  if (!assertExists(packageRoot, 'Packaged Codex plugin root')) return;
  const topLevelEntries = fs.readdirSync(packageRoot).sort();
  const expectedTopLevelEntries = ['.codex-plugin', 'LICENSE', 'assets', 'skills'].sort();
  if (JSON.stringify(topLevelEntries) !== JSON.stringify(expectedTopLevelEntries)) {
    fail('Packaged Codex plugin root contains unexpected or missing top-level entries.');
  }

  const publicManifest = readJson(path.join(packageRoot, '.codex-plugin', 'plugin.json'));
  if (publicManifest) {
    if (publicManifest.name !== 'taskplanner') fail('Public manifest name must be taskplanner.');
    if (publicManifest.version !== packageJson.version) {
      fail(`Public manifest version must match package.json (${packageJson.version}).`);
    }
    if (publicManifest.skills !== './skills/') {
      fail('Public manifest skills must point to ./skills/.');
    }
    if (publicManifest.mcpServers || publicManifest.apps || publicManifest.hooks) {
      fail('Skills-only public manifest must not declare MCP servers, apps, or hooks.');
    }
    if (publicManifest.interface?.privacyPolicyURL !== submission.privacyPolicyUrl) {
      fail('Public manifest privacy policy must match the submission metadata.');
    }
    if (publicManifest.interface?.termsOfServiceURL !== submission.termsUrl) {
      fail('Public manifest terms URL must match the submission metadata.');
    }
    for (const field of ['composerIcon', 'logo']) {
      const assetPath = publicManifest.interface?.[field];
      if (!assetPath || !assetPath.startsWith('./')) {
        fail(`Public manifest interface.${field} must be a relative plugin path.`);
        continue;
      }
      assertExists(path.join(packageRoot, assetPath.slice(2)), `Public manifest ${field}`);
    }
  }

  validateCopiedTree(skillsRoot, path.join(packageRoot, 'skills'), 'Packaged skills');
  const sourceIcon = path.join(pluginRoot, 'assets', 'taskplanner-color.png');
  const packagedIcon = path.join(packageRoot, 'assets', 'taskplanner-color.png');
  if (
    assertExists(packagedIcon, 'Packaged Codex icon') &&
    !fs.readFileSync(sourceIcon).equals(fs.readFileSync(packagedIcon))
  ) {
    fail('Packaged Codex icon differs from the plugin source icon.');
  }

  if (!process.exitCode) console.log('[codex-submission] Validation passed.');
}

main();
