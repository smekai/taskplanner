const fs = require('fs');
const path = require('path');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function main() {
  const root = path.resolve(__dirname, '..');
  const pkg = readJson(path.join(root, 'package.json'));
  const pluginSource = path.join(root, 'plugins', 'taskplanner');
  const manifestSource = path.join(pluginSource, '.codex-plugin', 'plugin.json');
  const submission = readJson(path.join(pluginSource, '.codex-plugin', 'submission.json'));
  const destination = path.join(root, 'dist', 'codex', `taskplanner-codex-skills-${pkg.version}`);

  fs.rmSync(destination, { recursive: true, force: true });
  fs.mkdirSync(path.join(destination, '.codex-plugin'), { recursive: true });

  const publicManifest = readJson(manifestSource);
  delete publicManifest.mcpServers;
  delete publicManifest.apps;
  delete publicManifest.hooks;
  publicManifest.skills = './skills/';
  publicManifest.interface = {
    ...publicManifest.interface,
    privacyPolicyURL: submission.privacyPolicyUrl,
    termsOfServiceURL: submission.termsUrl,
  };

  fs.writeFileSync(
    path.join(destination, '.codex-plugin', 'plugin.json'),
    `${JSON.stringify(publicManifest, null, 2)}\n`,
  );
  fs.cpSync(path.join(pluginSource, 'skills'), path.join(destination, 'skills'), {
    recursive: true,
  });
  fs.mkdirSync(path.join(destination, 'assets'), { recursive: true });
  fs.copyFileSync(
    path.join(pluginSource, 'assets', 'taskplanner-color.png'),
    path.join(destination, 'assets', 'taskplanner-color.png'),
  );
  fs.copyFileSync(path.join(root, 'LICENSE'), path.join(destination, 'LICENSE'));

  console.log(`[codex-skills] Wrote plugin root ${path.relative(root, destination)}`);
}

main();
