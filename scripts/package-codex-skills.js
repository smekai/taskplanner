const fs = require('fs');
const path = require('path');
const yazl = require('yazl');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function listFiles(root) {
  const files = [];

  function visit(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) visit(fullPath);
      else files.push(path.relative(root, fullPath));
    }
  }

  visit(root);
  return files.sort();
}

function writeZip(sourceRoot, destinationPath) {
  const entries = listFiles(sourceRoot).map((relativePath) => ({
    relativePath,
    archivePath: relativePath.replaceAll(path.sep, '/'),
  }));

  for (const { archivePath } of entries) {
    if (archivePath.includes('\\') || archivePath.startsWith('/') || archivePath.includes('../')) {
      throw new Error(`Invalid ZIP entry path: ${archivePath}`);
    }
  }

  fs.rmSync(destinationPath, { force: true });
  return new Promise((resolve, reject) => {
    const zip = new yazl.ZipFile();
    const output = fs.createWriteStream(destinationPath);
    output.on('close', resolve);
    output.on('error', reject);
    zip.outputStream.on('error', reject);
    zip.outputStream.pipe(output);

    for (const { relativePath, archivePath } of entries) {
      zip.addFile(path.join(sourceRoot, relativePath), archivePath);
    }
    zip.end();
  });
}

async function main() {
  const root = path.resolve(__dirname, '..');
  const pkg = readJson(path.join(root, 'package.json'));
  const pluginSource = path.join(root, 'plugins', 'taskplanner');
  const manifestSource = path.join(pluginSource, '.codex-plugin', 'plugin.json');
  const submission = readJson(path.join(pluginSource, '.codex-plugin', 'submission.json'));
  const destination = path.join(root, 'dist', 'codex', `taskplanner-codex-skills-${pkg.version}`);
  const zipDestination = `${destination}.zip`;

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
  await writeZip(destination, zipDestination);

  console.log(`[codex-skills] Wrote plugin root ${path.relative(root, destination)}`);
  console.log(`[codex-skills] Wrote upload ZIP ${path.relative(root, zipDestination)}`);
}

main().catch((error) => {
  console.error(`[codex-skills] ERROR: ${error.message}`);
  process.exitCode = 1;
});
