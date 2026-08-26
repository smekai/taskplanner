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

function fail(message) {
  console.error(`[mcp-smoke] ERROR: ${message}`);
  process.exit(1);
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
    if (message.method && message.id !== undefined) {
      this.send({
        jsonrpc: '2.0',
        id: message.id,
        error: { code: -32601, message: `Unsupported request: ${message.method}` },
      });
      return;
    }
    if (message.id === undefined) return; // notification

    const entry = this.pending.get(message.id);
    if (!entry) return;
    this.pending.delete(message.id);
    clearTimeout(entry.timer);
    if (message.error)
      entry.reject(new Error(message.error.message || JSON.stringify(message.error)));
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

  async initialize() {
    const result = await this.request('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'taskplanner-smoke-test', version: '1.0.0' },
    });
    this.send({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} });
    return result;
  }

  async callTool(name, args) {
    const result = await this.request('tools/call', { name, arguments: args });
    if (result.isError) {
      fail(`${name} failed (${this.label}): ${result.content?.[0]?.text || 'unknown error'}`);
    }
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
function childEnv(extra = {}) {
  const env = { ...process.env };
  for (const key of [
    'TASKPLANNER_WORKSPACE_ROOT',
    'CURSOR_WORKSPACE_ROOT',
    'VSCODE_WORKSPACE_ROOT',
    'PWD',
    'INIT_CWD',
  ]) {
    delete env[key];
  }
  return { ...env, ...extra };
}

function startServerProcess(command, args, { cwd, env, label }) {
  const proc = spawn(command, args, {
    cwd,
    env: childEnv(env),
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  return new McpClient(proc, label);
}

function startServer(serverPath, options) {
  return startServerProcess(process.execPath, [serverPath], options);
}

// ── publish the package into a throwaway install ────────

function run(command, args, options) {
  const result = spawnSync(command, args, { encoding: 'utf8', ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(' ')} exited ${result.status}\n${result.stdout || ''}${result.stderr || ''}`,
    );
  }
  return result.stdout;
}

const npmCli = path.join(
  path.dirname(process.execPath),
  'node_modules',
  'npm',
  'bin',
  'npm-cli.js',
);

function npm(args, options) {
  // npm's JS entry, not the npm.cmd shim: no shell, no .cmd quoting rules.
  const cli = fs.existsSync(npmCli) ? npmCli : null;
  if (cli) return run(process.execPath, [cli, ...args], options);
  return run('npm', args, { shell: process.platform === 'win32', ...options });
}

function installPublishedPackage(tempRoot) {
  const packDir = path.join(tempRoot, 'pack');
  const installDir = path.join(tempRoot, 'install');
  fs.mkdirSync(packDir, { recursive: true });
  fs.mkdirSync(installDir, { recursive: true });

  const packJson = npm(['pack', '--json', '--pack-destination', packDir], { cwd: packageDir });
  const packed = JSON.parse(packJson.slice(packJson.indexOf('[')))[0];
  const tarball = path.join(packDir, packed.filename);

  const packedPaths = (packed.files || []).map((file) => file.path.replace(/\\/g, '/'));
  for (const required of [
    'LICENSE',
    'dist/mcp-server.js',
    'dist/index.js',
    'dist/index.d.ts',
    'ui/board/index.html',
    'package.json',
  ]) {
    if (!packedPaths.includes(required)) {
      fail(`Published tarball is missing ${required}. Run "npm run build" first.`);
    }
  }
  log(`packed ${packed.filename} (${packedPaths.length} files).`);

  fs.writeFileSync(
    path.join(installDir, 'package.json'),
    `${JSON.stringify({ name: 'taskplanner-mcp-smoke', version: '1.0.0', private: true }, null, 2)}\n`,
  );
  npm(['install', tarball, '--no-audit', '--no-fund', '--no-package-lock', '--loglevel=error'], {
    cwd: installDir,
  });

  const serverPath = require.resolve(`${packageName}/mcp-server`, { paths: [installDir] });
  if (!serverPath.startsWith(fs.realpathSync(installDir))) {
    fail(`Resolved ${serverPath}, which is outside the fresh install at ${installDir}.`);
  }
  log(`installed ${packageName} and resolved ${path.relative(installDir, serverPath)}.`);
  return { serverPath, installDir };
}

// ── a scratch repository written the way a consumer writes one ──

const SCRATCH_TASK_ID = 'SMOKE-001';

function createScratchWorkspace(tempRoot) {
  const root = path.join(tempRoot, 'scratch-repo');
  const tasksDir = path.join(root, '.tasks');
  const nested = path.join(root, 'src', 'deep', 'nested');
  fs.mkdirSync(tasksDir, { recursive: true });
  fs.mkdirSync(nested, { recursive: true });

  const states = [
    { name: 'Backlog', fileName: 'BACKLOG.md', order: 0 },
    { name: 'Next', fileName: 'NEXT.md', order: 1 },
    { name: 'In Progress', fileName: 'IN_PROGRESS.md', order: 2 },
    { name: 'Done', fileName: 'DONE.md', order: 3 },
    { name: 'Rejected', fileName: 'REJECTED.md', order: 4 },
  ];
  fs.writeFileSync(
    path.join(tasksDir, 'config.json'),
    `${JSON.stringify(
      {
        version: 2,
        idPrefix: 'SMOKE',
        nextId: 2,
        states,
        priorities: ['P0', 'P1', 'P2', 'P3', 'P4'],
        insertPosition: 'top',
      },
      null,
      2,
    )}\n`,
  );

  fs.writeFileSync(
    path.join(tasksDir, 'BACKLOG.md'),
    [
      '# Backlog',
      '',
      `## ${SCRATCH_TASK_ID}: Assignee round-trip`,
      '**Priority:** P1',
      '**Tags:** smoke',
      '**Assignee:** owner',
      '**Updated:** 2026-01-01 00:00',
      '',
      'Written directly to markdown by a consumer, not through the MCP tools.',
      '',
      '---',
      '',
    ].join('\n'),
  );
  for (const state of states.slice(1)) {
    fs.writeFileSync(path.join(tasksDir, state.fileName), `# ${state.name}\n\n`);
  }

  return { root, tasksDir, nested };
}

// ── assertions ──────────────────────────────────────────

const REQUIRED_TOOLS = [
  'taskplanner_board',
  'taskplanner_list',
  'taskplanner_get',
  'taskplanner_create',
  'taskplanner_update',
  'taskplanner_move',
  'taskplanner_board_visual',
  'taskplanner_board_data',
];

function checkTools(tools) {
  const names = tools.map((tool) => tool.name);
  for (const name of REQUIRED_TOOLS) {
    if (!names.includes(name)) fail(`Missing tool: ${name}`);
    const tool = tools.find((candidate) => candidate.name === name);
    if (!tool.inputSchema?.properties?.workspace_root) {
      fail(`${name} is missing the workspace_root input.`);
    }
  }

  const visual = tools.find((tool) => tool.name === 'taskplanner_board_visual');
  const meta = visual?._meta || {};
  if (
    meta.ui?.resourceUri !== 'ui://taskplanner/board' &&
    meta['ui/resourceUri'] !== 'ui://taskplanner/board'
  ) {
    fail('taskplanner_board_visual is missing MCP App UI metadata.');
  }

  for (const name of [
    'taskplanner_board',
    'taskplanner_list',
    'taskplanner_get',
    'taskplanner_board_data',
    'taskplanner_board_visual',
  ]) {
    const annotations = tools.find((tool) => tool.name === name)?.annotations;
    if (annotations?.readOnlyHint !== true || annotations?.openWorldHint !== false) {
      fail(`${name} is missing read-only/closed-world annotations.`);
    }
  }

  for (const name of ['taskplanner_move', 'taskplanner_update']) {
    const annotations = tools.find((tool) => tool.name === name)?.annotations;
    if (annotations?.readOnlyHint !== false || annotations?.destructiveHint !== true) {
      fail(`${name} is missing modifying/destructive annotations.`);
    }
  }

  log(`tools/list OK (${names.length} tools).`);
}

async function checkEnvVarRoot(serverPath, installDir) {
  const nestedRepoDir = path.join(repoRoot, 'src', 'mcp');
  const client = startServer(serverPath, {
    cwd: installDir,
    env: { TASKPLANNER_WORKSPACE_ROOT: nestedRepoDir },
    label: 'env-var',
  });

  try {
    await client.initialize();

    const tools = (await client.request('tools/list')).tools || [];
    checkTools(tools);

    const resources = (await client.request('resources/list')).resources || [];
    if (!resources.some((resource) => resource.uri === 'ui://taskplanner/board')) {
      fail('Board resource ui://taskplanner/board not listed.');
    }

    const html =
      (await client.request('resources/read', { uri: 'ui://taskplanner/board' })).contents?.[0]
        ?.text || '';
    if (!html.includes('TaskPlanner Board')) {
      fail('Board HTML resource did not load expected content from the installed package.');
    }
    if (!html.includes('workspace_root')) {
      fail('Board HTML does not propagate workspace_root to follow-up tool calls.');
    }
    log('board resource HTML OK (loaded via __dirname from the installed package).');

    // No workspace_root argument: TASKPLANNER_WORKSPACE_ROOT is the only thing that can answer.
    const board = await client.callTool('taskplanner_board', {});
    if (!board.content?.[0]?.text) fail('taskplanner_board returned no content.');

    const boardData = await client.callTool('taskplanner_board_data', { limit: 1 });
    if (!boardData.structuredContent?.board) {
      fail('taskplanner_board_data did not return structured board content.');
    }
    const resolved = path.resolve(boardData.structuredContent.workspaceRoot || '');
    if (resolved !== path.resolve(repoRoot)) {
      fail(
        `TASKPLANNER_WORKSPACE_ROOT=${nestedRepoDir} resolved to ${resolved}; expected ${repoRoot}.`,
      );
    }
    log('TASKPLANNER_WORKSPACE_ROOT OK (walked up from a subdirectory to .tasks/).');
  } finally {
    await client.close();
  }
}

function checkLibraryEntry(installDir, scratch) {
  const libraryPath = require.resolve(packageName, { paths: [installDir] });
  if (!/[\\/]dist[\\/]index\.js$/.test(libraryPath)) {
    fail(`"." resolved to ${libraryPath}; expected the library at dist/index.js.`);
  }

  const taskplanner = require(libraryPath);
  for (const name of ['parseTasks', 'serializeTask', 'TaskStore', 'FileStore', 'ConfigManager']) {
    if (!taskplanner[name]) fail(`Library entry does not export ${name}.`);
  }

  const markdown = fs.readFileSync(path.join(scratch.tasksDir, 'IN_PROGRESS.md'), 'utf8');
  const result = taskplanner.parseTasks(markdown);
  const task = result.tasks.find((candidate) => candidate.id === SCRATCH_TASK_ID);
  if (!task) fail(`Library parseTasks did not find ${SCRATCH_TASK_ID} in IN_PROGRESS.md.`);
  if (task.assignee !== 'owner') {
    fail(`Library read assignee as ${JSON.stringify(task.assignee)}; expected "owner".`);
  }

  const types = path.join(path.dirname(libraryPath), 'index.d.ts');
  if (!fs.existsSync(types)) fail(`Library entry has no type declarations at ${types}.`);

  log('library entry OK (require, no server started, same parser, types present).');
}

const BIN_NAME = 'taskplanner-mcp';

/** Reads the bin mapping the manifest declares; hardcoding it would pass with `bin` deleted. */
async function checkBinLauncher(installDir, scratch) {
  const manifestPath = require.resolve(`${packageName}/package.json`, { paths: [installDir] });
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  const declared =
    typeof manifest.bin === 'string' ? { [manifest.name]: manifest.bin } : manifest.bin || {};
  const target = declared[BIN_NAME];
  if (!target) {
    fail(`Published package declares no "${BIN_NAME}" bin (bin: ${JSON.stringify(manifest.bin)}).`);
  }
  const targetPath = path.resolve(path.dirname(manifestPath), target);
  if (!fs.existsSync(targetPath)) {
    fail(`bin "${BIN_NAME}" points at ${target}, which is not present in the published package.`);
  }

  const shimDir = path.join(installDir, 'node_modules', '.bin');
  const shims = fs.existsSync(shimDir) ? fs.readdirSync(shimDir) : [];
  if (!shims.some((entry) => entry === BIN_NAME || entry.startsWith(`${BIN_NAME}.`))) {
    fail(
      `npm installed no ${BIN_NAME} shim in node_modules/.bin (found: ${shims.join(', ') || 'nothing'}).`,
    );
  }

  const client = startServerProcess(process.execPath, [npmCli, 'exec', '--', BIN_NAME], {
    cwd: installDir,
    env: {},
    label: 'npm exec',
  });
  try {
    await client.initialize();
    await client.callTool('taskplanner_board', { workspace_root: scratch.root });
    log(`bin OK (package.json bin → ${target}, launched via npm exec).`);
  } finally {
    await client.close();
  }
}

/** No TASKPLANNER_WORKSPACE_ROOT here, so the workspace_root argument does all the work. */
async function checkToolInputRootAndAssignee(serverPath, installDir, scratch) {
  const client = startServer(serverPath, {
    cwd: installDir,
    env: {},
    label: 'tool-input',
  });

  try {
    await client.initialize();

    const board = await client.callTool('taskplanner_board_data', {
      workspace_root: scratch.nested,
      limit: 1,
    });
    const resolved = path.resolve(board.structuredContent?.workspaceRoot || '');
    if (resolved !== fs.realpathSync(scratch.root)) {
      fail(`workspace_root=${scratch.nested} resolved to ${resolved}; expected ${scratch.root}.`);
    }
    log('workspace_root tool input OK (fresh install, empty cwd, nested root).');

    const before = await client.callTool('taskplanner_get', {
      workspace_root: scratch.nested,
      task_id: SCRATCH_TASK_ID,
    });
    if (before.structuredContent?.task?.assignee !== 'owner') {
      fail(
        `Assignee read back as ${JSON.stringify(before.structuredContent?.task?.assignee)}; expected "owner".`,
      );
    }

    const moved = await client.callTool('taskplanner_move', {
      workspace_root: scratch.nested,
      task_id: SCRATCH_TASK_ID,
      target_state: 'In Progress',
    });
    if (moved.structuredContent?.task?.assignee !== 'owner') {
      fail('taskplanner_move dropped the assignee from its response.');
    }

    const after = await client.callTool('taskplanner_get', {
      workspace_root: scratch.nested,
      task_id: SCRATCH_TASK_ID,
    });
    if (after.structuredContent?.task?.assignee !== 'owner') {
      fail('Assignee did not survive taskplanner_move.');
    }

    const markdown = fs.readFileSync(path.join(scratch.tasksDir, 'IN_PROGRESS.md'), 'utf8');
    if (!markdown.includes('**Assignee:** owner')) {
      fail(`IN_PROGRESS.md lost **Assignee:** owner after the move:\n${markdown}`);
    }
    if (
      fs.readFileSync(path.join(scratch.tasksDir, 'BACKLOG.md'), 'utf8').includes(SCRATCH_TASK_ID)
    ) {
      fail('Moved task is still present in BACKLOG.md.');
    }
    log('Assignee round-trip OK (markdown → get → move → get → markdown).');
  } finally {
    await client.close();
  }
}

// ── main ────────────────────────────────────────────────

async function main() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'taskplanner-mcp-smoke-'));
  let serverPath;
  let installDir;

  try {
    if (process.env.TASKPLANNER_MCP_SERVER_PATH) {
      serverPath = path.resolve(process.env.TASKPLANNER_MCP_SERVER_PATH);
      installDir = path.join(tempRoot, 'install');
      fs.mkdirSync(installDir, { recursive: true });
      log(`TASKPLANNER_MCP_SERVER_PATH set — testing ${serverPath} without packing.`);
    } else {
      ({ serverPath, installDir } = installPublishedPackage(tempRoot));
    }

    const scratch = createScratchWorkspace(tempRoot);

    await checkEnvVarRoot(serverPath, installDir);
    await checkToolInputRootAndAssignee(serverPath, installDir, scratch);
    if (!process.env.TASKPLANNER_MCP_SERVER_PATH) {
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
