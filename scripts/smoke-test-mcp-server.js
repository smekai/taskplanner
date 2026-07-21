/**
 * Headless smoke test for the TaskPlanner MCP server (stdio).
 * Verifies tools/list includes board tools and board resource metadata.
 *
 * Usage: node scripts/smoke-test-mcp-server.js
 */
const { spawn } = require('child_process');
const path = require('path');
const { pathToFileURL } = require('url');

const serverPath = process.env.TASKPLANNER_MCP_SERVER_PATH
  ? path.resolve(process.env.TASKPLANNER_MCP_SERVER_PATH)
  : path.join(__dirname, '..', 'plugins', 'taskplanner', 'dist', 'mcp-server.js');
const workspaceRoot = path.join(__dirname, '..');
const pluginRoot = path.dirname(path.dirname(serverPath));

function send(proc, payload) {
  proc.stdin.write(`${JSON.stringify(payload)}\n`);
}

function fail(message) {
  console.error(`[mcp-smoke] ERROR: ${message}`);
  process.exit(1);
}

async function main() {
  const proc = spawn('node', [serverPath], {
    // Match Codex plugin startup: the process starts in the installed plugin, not the task repo.
    cwd: pluginRoot,
    env: { ...process.env },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  const initId = 1;
  const toolsListId = 2;
  const resourceListId = 3;
  const resourceReadId = 4;
  const boardDataId = 5;
  const results = {
    tools: null,
    resources: null,
    resourceHtml: null,
    boardData: null,
  };

  let buffer = '';
  const timeout = setTimeout(() => {
    fail('Timed out waiting for MCP responses.');
  }, 15000);

  proc.stderr.on('data', (chunk) => {
    const text = chunk.toString('utf8').trim();
    if (text) console.error(`[mcp-smoke] stderr: ${text}`);
  });

  proc.stdout.on('data', (chunk) => {
    buffer += chunk.toString('utf8');
    while (true) {
      const index = buffer.indexOf('\n');
      if (index === -1) break;
      const line = buffer.slice(0, index).trim();
      buffer = buffer.slice(index + 1);
      if (!line) continue;

      const message = JSON.parse(line);

      if (message.method === 'roots/list' && message.id !== undefined) {
        send(proc, {
          jsonrpc: '2.0',
          id: message.id,
          result: {
            roots: [{ uri: pathToFileURL(workspaceRoot).href, name: 'TaskPlanner workspace' }],
          },
        });
        continue;
      }

      if (message.id === initId && message.result) {
        send(proc, {
          jsonrpc: '2.0',
          method: 'notifications/initialized',
          params: {},
        });
        send(proc, {
          jsonrpc: '2.0',
          id: toolsListId,
          method: 'tools/list',
          params: {},
        });
        continue;
      }

      if (message.id === toolsListId && message.result) {
        results.tools = message.result.tools || [];
        send(proc, {
          jsonrpc: '2.0',
          id: resourceListId,
          method: 'resources/list',
          params: {},
        });
        continue;
      }

      if (message.id === resourceListId && message.result) {
        results.resources = message.result.resources || [];
        send(proc, {
          jsonrpc: '2.0',
          id: resourceReadId,
          method: 'resources/read',
          params: { uri: 'ui://taskplanner/board' },
        });
        continue;
      }

      if (message.id === resourceReadId && message.result) {
        results.resourceHtml = message.result.contents?.[0]?.text || '';
        send(proc, {
          jsonrpc: '2.0',
          id: boardDataId,
          method: 'tools/call',
          params: {
            name: 'taskplanner_board_data',
            arguments: { workspace_root: workspaceRoot, limit: 1 },
          },
        });
        continue;
      }

      if (message.id === boardDataId && message.result) {
        results.boardData = message.result;
        finish();
        continue;
      }

      if (message.error) {
        fail(message.error.message || JSON.stringify(message.error));
      }
    }
  });

  function finish() {
    clearTimeout(timeout);
    proc.kill();

    const toolNames = (results.tools || []).map((tool) => tool.name);
    const requiredTools = [
      'taskplanner_board',
      'taskplanner_list',
      'taskplanner_board_visual',
      'taskplanner_board_data',
      'taskplanner_create',
      'taskplanner_move',
      'taskplanner_get',
      'taskplanner_update',
    ];
    for (const name of requiredTools) {
      if (!toolNames.includes(name)) {
        fail(`Missing tool: ${name}`);
      }
      const workspaceSchema = results.tools.find((tool) => tool.name === name)?.inputSchema
        ?.properties?.workspace_root;
      if (!workspaceSchema) {
        fail(`${name} is missing the workspace_root input.`);
      }
    }

    const visualTool = results.tools.find((tool) => tool.name === 'taskplanner_board_visual');
    const meta = visualTool?._meta || {};
    if (
      meta.ui?.resourceUri !== 'ui://taskplanner/board' &&
      meta['ui/resourceUri'] !== 'ui://taskplanner/board'
    ) {
      fail('taskplanner_board_visual is missing MCP App UI metadata.');
    }

    const resource = (results.resources || []).find(
      (item) => item.uri === 'ui://taskplanner/board',
    );
    if (!resource) {
      fail('Board resource ui://taskplanner/board not listed.');
    }

    if (!results.resourceHtml || !results.resourceHtml.includes('TaskPlanner Board')) {
      fail('Board HTML resource did not load expected content.');
    }
    if (!results.resourceHtml.includes('workspace_root')) {
      fail('Board HTML does not propagate workspace_root to follow-up tool calls.');
    }

    for (const name of [
      'taskplanner_board',
      'taskplanner_list',
      'taskplanner_get',
      'taskplanner_board_data',
      'taskplanner_board_visual',
    ]) {
      const annotations = results.tools.find((tool) => tool.name === name)?.annotations;
      if (annotations?.readOnlyHint !== true || annotations?.openWorldHint !== false) {
        fail(`${name} is missing read-only/closed-world annotations.`);
      }
    }

    for (const name of ['taskplanner_move', 'taskplanner_update']) {
      const annotations = results.tools.find((tool) => tool.name === name)?.annotations;
      if (annotations?.readOnlyHint !== false || annotations?.destructiveHint !== true) {
        fail(`${name} is missing modifying/destructive annotations.`);
      }
    }

    if (!results.boardData?.structuredContent?.board) {
      fail('taskplanner_board_data did not return structured board content.');
    }
    if (path.resolve(results.boardData?.structuredContent?.workspaceRoot || '') !== workspaceRoot) {
      fail('taskplanner_board_data did not resolve the explicit workspace root.');
    }

    console.log('[mcp-smoke] MCP server initialized.');
    console.log(`[mcp-smoke] tools/list OK (${toolNames.length} tools).`);
    console.log('[mcp-smoke] taskplanner_board_visual UI metadata OK.');
    console.log('[mcp-smoke] board resource HTML OK.');
    console.log('[mcp-smoke] Explicit workspace root, annotations, and structured content OK.');
    console.log('[mcp-smoke] Smoke test passed.');
  }

  send(proc, {
    jsonrpc: '2.0',
    id: initId,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'taskplanner-smoke-test', version: '1.0.0' },
    },
  });
}

main().catch((error) => fail(error.message || String(error)));
