/**
 * Headless smoke test for the TaskPlanner npm package (stdio).
 *
 * Packs packages/mcp-server, installs the tarball into an empty temporary directory, and exercises
 * the published artifact there: both workspace-root paths, the tool set and annotations, the board
 * resource, the Assignee round-trip, the bin mapping, and the library entry.
 *
 * Usage: node scripts/smoke-test-mcp-server.js
 * Set TASKPLANNER_MCP_SERVER_PATH to test a bundle in place, skipping pack/install.
 */
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const repoRoot = path.join(__dirname, '..');
const packageDir = path.join(repoRoot, 'packages', 'mcp-server');
const packageName = require(path.join(packageDir, 'package.json')).name;
const npmCli = path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
const BOARD_URI = 'ui://taskplanner/board';
const SCRATCH_TASK_ID = 'SMOKE-001';
const BIN_NAME = 'taskplanner-mcp';

function fail(message) {
  console.error(`[mcp-smoke] ERROR: ${message}`);
  process.exit(1);
}

function expect(condition, message) {
  if (!condition) fail(message);
}

function log(message) {
  console.log(`[mcp-smoke] ${message}`);
}

// ── stdio JSON-RPC client ───────────────────────────────

class McpClient {
  constructor(proc, label) {
    this.proc = proc;
    this.label = label;
    this.nextId = 1;
    this.pending = new Map();
    this.buffer = '';

    proc.stderr.on('data', (chunk) => {
      const text = chunk.toString('utf8').trim();
      if (text) console.error(`[mcp-smoke] (${label}) stderr: ${text}`);
    });

    proc.stdout.on('data', (chunk) => {
      this.buffer += chunk.toString('utf8');
      let index;
      while ((index = this.buffer.indexOf('\n')) !== -1) {
        const line = this.buffer.slice(0, index).trim();
        this.buffer = this.buffer.slice(index + 1);
        if (line) this.handle(JSON.parse(line));
      }
    });
  }

  handle(message) {
    // Inbound requests share the id space with ours, so answer rather than fall through.
    if (message.method && message.id !== undefined) {
      const error = { code: -32601, message: `Unsupported request: ${message.method}` };
      return this.send({ jsonrpc: '2.0', id: message.id, error });
    }
    const entry = this.pending.get(message.id);
    if (!entry) return;
    this.pending.delete(message.id);
    clearTimeout(entry.timer);
    if (message.error) entry.reject(new Error(message.error.message ?? 'request failed'));
    else entry.resolve(message.result);
  }

  send(payload) {
    this.proc.stdin.write(`${JSON.stringify(payload)}\n`);
  }

  request(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Timed out waiting for ${method} (${this.label}).`));
      }, 20000);
      this.pending.set(id, { resolve, reject, timer });
      this.send({ jsonrpc: '2.0', id, method, params });
    });
  }

  async callTool(name, args) {
    const result = await this.request('tools/call', { name, arguments: args });
    expect(!result.isError, `${name} failed (${this.label}): ${result.content?.[0]?.text}`);
    return result;
  }

  /** Resolves once the child has actually exited — Windows keeps the bundle locked until then. */
  close() {
    for (const entry of this.pending.values()) clearTimeout(entry.timer);
    this.pending.clear();
    if (this.proc.exitCode !== null || this.proc.signalCode !== null) return Promise.resolve();
    return new Promise((resolve) => {
      this.proc.once('exit', resolve);
      this.proc.kill();
      setTimeout(resolve, 5000).unref();
    });
  }
}

/** Strips confounding roots so a pass proves the variable under test is what located .tasks/. */
function childEnv(extra) {
  const env = { ...process.env };
  const confounders = ['TASKPLANNER_WORKSPACE_ROOT', 'CURSOR_WORKSPACE_ROOT'];
  for (const key of [...confounders, 'VSCODE_WORKSPACE_ROOT', 'PWD', 'INIT_CWD']) delete env[key];
  return { ...env, ...extra };
}

/** Initializes a server child, runs the checks against it, and always waits for it to exit. */
async function withServer({ command = process.execPath, args, cwd, env = {}, shell, label }, run) {
  const proc = spawn(command, args, { cwd, env: childEnv(env), stdio: 'pipe', shell });
  const client = new McpClient(proc, label);
  try {
    await client.request('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'taskplanner-smoke-test', version: '1.0.0' },
    });
    client.send({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} });
    return await run(client);
  } finally {
    await client.close();
  }
}

// ── publish the package into a throwaway install ────────

/** Prefers npm's JS entry over the npm.cmd shim: no shell, no .cmd quoting rules. */
function npmSpawn(args) {
  const direct = fs.existsSync(npmCli);
  return {
    command: direct ? process.execPath : 'npm',
    args: direct ? [npmCli, ...args] : args,
    shell: !direct && process.platform === 'win32',
  };
}

function npm(args, options) {
  const { command, args: argv, shell } = npmSpawn(args);
  const result = spawnSync(command, argv, { encoding: 'utf8', shell, ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`npm ${args.join(' ')} exited ${result.status}\n${result.stderr || ''}`);
  }
  return result.stdout;
}

const REQUIRED_PACKED_FILES = [
  'LICENSE',
  'package.json',
  'dist/mcp-server.js',
  'dist/index.js',
  'dist/index.d.ts',
  'ui/board/index.html',
];

function installPublishedPackage(tempRoot) {
  const packDir = path.join(tempRoot, 'pack');
  const installDir = path.join(tempRoot, 'install');
  fs.mkdirSync(packDir, { recursive: true });
  fs.mkdirSync(installDir, { recursive: true });

  const packJson = npm(['pack', '--json', '--pack-destination', packDir], { cwd: packageDir });
  const packed = JSON.parse(packJson.slice(packJson.indexOf('[')))[0];
  const packedPaths = (packed.files || []).map((file) => file.path.replace(/\\/g, '/'));
  for (const required of REQUIRED_PACKED_FILES) {
    expect(packedPaths.includes(required), `Tarball is missing ${required}; run "npm run build".`);
  }
  log(`packed ${packed.filename} (${packedPaths.length} files).`);

  const manifest = { name: 'taskplanner-mcp-smoke', version: '1.0.0', private: true };
  fs.writeFileSync(path.join(installDir, 'package.json'), JSON.stringify(manifest));
  const tarball = path.join(packDir, packed.filename);
  const flags = ['--no-audit', '--no-fund', '--no-package-lock', '--loglevel=error'];
  npm(['install', tarball, ...flags], { cwd: installDir });

  const serverPath = require.resolve(`${packageName}/mcp-server`, { paths: [installDir] });
  const inside = serverPath.startsWith(fs.realpathSync(installDir));
  expect(inside, `Resolved ${serverPath}, outside the fresh install at ${installDir}.`);
  log(`installed ${packageName} and resolved ${path.relative(installDir, serverPath)}.`);
  return { serverPath, installDir };
}

// ── a scratch repository written the way a consumer writes one ──

function createScratchWorkspace(tempRoot) {
  const root = path.join(tempRoot, 'scratch-repo');
  const tasksDir = path.join(root, '.tasks');
  const nested = path.join(root, 'src', 'deep', 'nested');
  fs.mkdirSync(tasksDir, { recursive: true });
  fs.mkdirSync(nested, { recursive: true });

  const states = ['Backlog', 'Next', 'In Progress', 'Done', 'Rejected'].map((name, order) => ({
    name,
    fileName: `${name.replace(' ', '_').toUpperCase()}.md`,
    order,
  }));
  const write = (file, body) => fs.writeFileSync(path.join(tasksDir, file), body);

  const priorities = ['P0', 'P1', 'P2', 'P3', 'P4'];
  const config = { version: 2, idPrefix: 'SMOKE', nextId: 2, states, priorities };
  write('config.json', JSON.stringify({ ...config, insertPosition: 'top' }, null, 2));

  // **Assignee:** on its own line, the way a consumer's own writer emits it.
  write(
    'BACKLOG.md',
    [
      '# Backlog',
      '',
      `## ${SCRATCH_TASK_ID}: Assignee round-trip`,
      '**Priority:** P1',
      '**Tags:** smoke',
      '**Assignee:** owner',
      '',
      'Written directly to markdown, not through the MCP tools.',
      '',
      '---',
      '',
    ].join('\n'),
  );
  for (const state of states.slice(1)) write(state.fileName, `# ${state.name}\n\n`);

  return { root, tasksDir, nested };
}

// ── assertions ──────────────────────────────────────────

const REQUIRED_TOOLS = ['create', 'update', 'move', 'board', 'list', 'get'];
const READ_ONLY_TOOLS = ['board', 'list', 'get', 'board_data', 'board_visual'];
const MODIFYING_TOOLS = ['move', 'update'];
const tool = (suffix) => `taskplanner_${suffix}`;

function checkTools(tools) {
  const byName = new Map(tools.map((entry) => [entry.name, entry]));
  for (const suffix of [...REQUIRED_TOOLS, 'board_visual', 'board_data']) {
    const entry = byName.get(tool(suffix));
    expect(entry, `Missing tool: ${tool(suffix)}`);
    const root = entry.inputSchema?.properties?.workspace_root;
    expect(root, `${tool(suffix)} is missing the workspace_root input.`);
  }

  const meta = byName.get(tool('board_visual'))?._meta || {};
  const uri = meta.ui?.resourceUri ?? meta['ui/resourceUri'];
  expect(uri === BOARD_URI, `${tool('board_visual')} is missing MCP App UI metadata.`);

  for (const suffix of READ_ONLY_TOOLS) {
    const hints = byName.get(tool(suffix))?.annotations;
    const ok = hints?.readOnlyHint === true && hints?.openWorldHint === false;
    expect(ok, `${tool(suffix)} is missing read-only/closed-world annotations.`);
  }
  for (const suffix of MODIFYING_TOOLS) {
    const hints = byName.get(tool(suffix))?.annotations;
    const ok = hints?.readOnlyHint === false && hints?.destructiveHint === true;
    expect(ok, `${tool(suffix)} is missing modifying/destructive annotations.`);
  }
  log(`tools/list OK (${tools.length} tools).`);
}

/** Case 1: TASKPLANNER_WORKSPACE_ROOT, pointed at a subdirectory so a pass proves the walk up. */
function checkEnvVarRoot(serverPath, installDir) {
  const nestedRepoDir = path.join(repoRoot, 'src', 'mcp');
  const env = { TASKPLANNER_WORKSPACE_ROOT: nestedRepoDir };
  return withServer({ args: [serverPath], cwd: installDir, env, label: 'env-var' }, async (c) => {
    checkTools((await c.request('tools/list')).tools || []);

    const resources = (await c.request('resources/list')).resources || [];
    expect(
      resources.some((resource) => resource.uri === BOARD_URI),
      `Board resource ${BOARD_URI} not listed.`,
    );
    const html = (await c.request('resources/read', { uri: BOARD_URI })).contents?.[0]?.text || '';
    expect(
      html.includes('TaskPlanner Board'),
      'Board HTML did not load from the installed package.',
    );
    expect(html.includes('workspace_root'), 'Board HTML does not propagate workspace_root.');
    log('board resource HTML OK (loaded via __dirname from the installed package).');

    // No workspace_root argument: the environment variable is the only thing that can answer.
    const board = await c.callTool(tool('board'), {});
    expect(board.content?.[0]?.text, 'taskplanner_board returned no content.');

    const data = await c.callTool(tool('board_data'), { limit: 1 });
    expect(data.structuredContent?.board, 'taskplanner_board_data returned no structured board.');
    const resolved = path.resolve(data.structuredContent.workspaceRoot || '');
    expect(
      resolved === path.resolve(repoRoot),
      `env var resolved to ${resolved}, not ${repoRoot}.`,
    );
    log('TASKPLANNER_WORKSPACE_ROOT OK (walked up from a subdirectory to .tasks/).');
  });
}

/** Case 2: no environment variable, so the workspace_root argument does all the work. */
function checkToolInputRootAndAssignee(serverPath, installDir, scratch) {
  const workspace_root = scratch.nested;
  const task = { workspace_root, task_id: SCRATCH_TASK_ID };
  const assignee = (result) => result.structuredContent?.task?.assignee;

  return withServer({ args: [serverPath], cwd: installDir, label: 'tool-input' }, async (c) => {
    const board = await c.callTool(tool('board_data'), { workspace_root, limit: 1 });
    const resolved = path.resolve(board.structuredContent?.workspaceRoot || '');
    const expected = fs.realpathSync(scratch.root);
    expect(resolved === expected, `workspace_root resolved to ${resolved}, not ${expected}.`);
    log('workspace_root tool input OK (fresh install, empty cwd, nested root).');

    const before = await c.callTool(tool('get'), task);
    expect(assignee(before) === 'owner', `Assignee read back as ${assignee(before)}, not "owner".`);
    const moved = await c.callTool(tool('move'), { ...task, target_state: 'In Progress' });
    expect(assignee(moved) === 'owner', 'taskplanner_move dropped the assignee from its response.');
    const after = await c.callTool(tool('get'), task);
    expect(assignee(after) === 'owner', 'Assignee did not survive taskplanner_move.');

    const read = (file) => fs.readFileSync(path.join(scratch.tasksDir, file), 'utf8');
    expect(read('IN_PROGRESS.md').includes('**Assignee:** owner'), 'Markdown lost the assignee.');
    expect(!read('BACKLOG.md').includes(SCRATCH_TASK_ID), 'Moved task is still in BACKLOG.md.');
    log('Assignee round-trip OK (markdown → get → move → get → markdown).');
  });
}

/** Reads the bin mapping the manifest declares; hardcoding it would pass with `bin` deleted. */
function checkBinLauncher(installDir, scratch) {
  const manifestPath = require.resolve(`${packageName}/package.json`, { paths: [installDir] });
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const declared =
    typeof manifest.bin === 'string' ? { [manifest.name]: manifest.bin } : manifest.bin;
  const target = (declared || {})[BIN_NAME];
  expect(target, `Package declares no "${BIN_NAME}" bin (bin: ${JSON.stringify(manifest.bin)}).`);

  const targetPath = path.resolve(path.dirname(manifestPath), target);
  expect(fs.existsSync(targetPath), `bin "${BIN_NAME}" points at ${target}, which is not shipped.`);
  const shimDir = path.join(installDir, 'node_modules', '.bin');
  const shims = fs.existsSync(shimDir) ? fs.readdirSync(shimDir) : [];
  const installed = shims.some((e) => e === BIN_NAME || e.startsWith(`${BIN_NAME}.`));
  expect(installed, `npm installed no ${BIN_NAME} shim in node_modules/.bin.`);

  return withServer(
    { ...npmSpawn(['exec', '--', BIN_NAME]), cwd: installDir, label: 'npm exec' },
    async (c) => {
      await c.callTool(tool('board'), { workspace_root: scratch.root });
      log(`bin OK (package.json bin → ${target}, launched via npm exec).`);
    },
  );
}

const LIBRARY_EXPORTS = ['parseTasks', 'serializeTask', 'TaskStore', 'FileStore', 'ConfigManager'];

function checkLibraryEntry(installDir, scratch) {
  const libraryPath = require.resolve(packageName, { paths: [installDir] });
  const isLibrary = /[\\/]dist[\\/]index\.js$/.test(libraryPath);
  expect(isLibrary, `"." resolved to ${libraryPath}; expected the library at dist/index.js.`);

  const taskplanner = require(libraryPath);
  for (const name of LIBRARY_EXPORTS) {
    expect(taskplanner[name], `Library entry does not export ${name}.`);
  }

  const markdown = fs.readFileSync(path.join(scratch.tasksDir, 'IN_PROGRESS.md'), 'utf8');
  const parsed = taskplanner.parseTasks(markdown).tasks.find((t) => t.id === SCRATCH_TASK_ID);
  expect(parsed, `Library parseTasks did not find ${SCRATCH_TASK_ID} in IN_PROGRESS.md.`);
  expect(parsed.assignee === 'owner', `Library read assignee as ${parsed.assignee}, not "owner".`);

  const types = path.join(path.dirname(libraryPath), 'index.d.ts');
  expect(fs.existsSync(types), `Library entry has no type declarations at ${types}.`);
  log('library entry OK (require, no server started, same parser, types present).');
}

// ── main ────────────────────────────────────────────────

async function main() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'taskplanner-mcp-smoke-'));
  const inPlace = process.env.TASKPLANNER_MCP_SERVER_PATH;

  try {
    let serverPath;
    let installDir;
    if (inPlace) {
      serverPath = path.resolve(inPlace);
      installDir = path.join(tempRoot, 'install');
      fs.mkdirSync(installDir, { recursive: true });
      log(`TASKPLANNER_MCP_SERVER_PATH set — testing ${serverPath} without packing.`);
    } else {
      ({ serverPath, installDir } = installPublishedPackage(tempRoot));
    }

    const scratch = createScratchWorkspace(tempRoot);
    await checkEnvVarRoot(serverPath, installDir);
    await checkToolInputRootAndAssignee(serverPath, installDir, scratch);
    if (!inPlace) {
      await checkBinLauncher(installDir, scratch);
      checkLibraryEntry(installDir, scratch);
    }
    log('Smoke test passed.');
  } finally {
    // Best-effort: a just-killed child can still hold the bundle open on Windows.
    try {
      fs.rmSync(tempRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    } catch (error) {
      console.warn(`[mcp-smoke] could not remove ${tempRoot}: ${error.message}`);
    }
  }
}

main().catch((error) => fail(error.stack || error.message || String(error)));
