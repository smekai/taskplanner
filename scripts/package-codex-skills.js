const fs = require('fs');
const path = require('path');

function main() {
  const root = path.resolve(__dirname, '..');
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const source = path.join(root, 'plugins', 'taskplanner', 'skills');
  const destination = path.join(root, 'dist', 'codex', `taskplanner-codex-skills-${pkg.version}`);

  fs.rmSync(destination, { recursive: true, force: true });
  fs.mkdirSync(destination, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    fs.cpSync(path.join(source, entry.name), path.join(destination, entry.name), {
      recursive: true,
    });
  }

  console.log(`[codex-skills] Wrote ${path.relative(root, destination)}`);
}

main();
