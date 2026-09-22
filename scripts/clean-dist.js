const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

// A build that only overwrites leaves declarations behind for modules that were deleted,
// and `files: ["dist/"]` then publishes them.
const outputs = [path.join(root, 'dist'), path.join(root, 'packages', 'mcp-server', 'dist')];

for (const dir of outputs) {
  fs.rmSync(dir, { recursive: true, force: true });
}
