const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

// A build that only overwrites leaves declarations behind for modules that were deleted,
// and `files: ["dist/"]` then publishes them.
fs.rmSync(path.join(root, 'packages', 'mcp-server', 'dist'), { recursive: true, force: true });

// The extension bundle shares dist/ with the packaged release artifacts, which the build
// must not touch: `npm run package` creates dist/vscode/ before vsce runs this through
// vscode:prepublish, and would then have nowhere to write the .vsix.
const packagedArtifacts = new Set(['vscode', 'codex']);
const extensionOutput = path.join(root, 'dist');

if (fs.existsSync(extensionOutput)) {
  for (const entry of fs.readdirSync(extensionOutput)) {
    if (packagedArtifacts.has(entry)) continue;
    fs.rmSync(path.join(extensionOutput, entry), { recursive: true, force: true });
  }
}
