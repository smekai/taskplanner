const fs = require('fs');
const path = require('path');
const { createVSIX } = require('@vscode/vsce');

async function main() {
  const root = path.resolve(__dirname, '..');
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const destination = path.join(root, 'dist', 'vscode', `${pkg.name}-${pkg.version}.vsix`);

  fs.mkdirSync(path.dirname(destination), { recursive: true });
  await createVSIX({ cwd: root, packagePath: destination });
}

main().catch((error) => {
  console.error(`[vsix] ERROR: ${error.message}`);
  process.exitCode = 1;
});
