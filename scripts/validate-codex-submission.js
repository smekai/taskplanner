const fs = require('fs');
const path = require('path');

function fail(message) {
  console.error(`[codex-submission] ERROR: ${message}`);
  process.exitCode = 1;
}

function main() {
  const root = path.resolve(__dirname, '..');
  const submissionPath = path.join(
    root,
    'plugins',
    'taskplanner',
    '.codex-plugin',
    'submission.json',
  );
  const submission = JSON.parse(fs.readFileSync(submissionPath, 'utf8'));
  const skillsRoot = path.join(root, 'plugins', 'taskplanner', 'skills');

  if (submission.submissionType !== 'Skills only') fail('Submission type must be Skills only.');
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
    if (!fs.existsSync(path.join(root, fileName))) fail(`${fileName} is required.`);
  }

  const skillNames = fs
    .readdirSync(skillsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
  for (const skillName of skillNames) {
    const skillPath = path.join(skillsRoot, skillName, 'SKILL.md');
    if (!fs.existsSync(skillPath)) {
      fail(`${skillName} is missing SKILL.md.`);
      continue;
    }
    const content = fs.readFileSync(skillPath, 'utf8');
    if (content.includes('[TODO:')) fail(`${skillName} still contains a TODO placeholder.`);
  }

  const primary = fs.readFileSync(path.join(skillsRoot, 'taskplanner', 'SKILL.md'), 'utf8');
  if (!primary.includes('direct file')) fail('Primary skill must document direct file fallback.');
  const update = fs.readFileSync(path.join(skillsRoot, 'update-taskplanner', 'SKILL.md'), 'utf8');
  if (!update.includes('Only after all writes succeed')) {
    fail('Update skill must record the version only after successful synchronization.');
  }

  if (!process.exitCode) console.log('[codex-submission] Validation passed.');
}

main();
