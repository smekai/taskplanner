#!/usr/bin/env node
// Launcher for `npx @refined/taskplanner` and shell use only.
//
// Programmatic consumers must NOT spawn this bin by name: on Windows the name
// resolves to a .cmd shim, which needs Node >= 20's shell rule to spawn. Spawn
// process.execPath with require.resolve('@refined/taskplanner/mcp-server') instead.
// Note the subpath — bare '@refined/taskplanner' is the inert library entry, which
// starts no server. See README.
require('../dist/mcp-server.js');
