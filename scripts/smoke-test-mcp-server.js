/**
 * Headless smoke test for the TaskPlanner MCP server (stdio).
 * Verifies tools/list includes board tools and board resource metadata.
 *
 * Usage: node scripts/smoke-test-mcp-server.js
 */
const { spawn } = require('child_process');
const path = require('path');

const serverPath = path.join(__dirname, '..', 'cursor-plugin', 'dist', 'mcp-server.js');
const workspaceRoot = path.join(__dirname, '..');

function send(proc, payload) {
  proc.stdin.write(`${JSON.stringify(payload)}\n`);
}

function fail(message) {
  console.error(`[mcp-smoke] ERROR: ${message}`);
  process.exit(1);
}

async function main() {
  const proc = spawn('node', [serverPath], {
    cwd: workspaceRoot,
    env: {
      ...process.env,
      CURSOR_WORKSPACE_ROOT: workspaceRoot,
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  const initId = 1;
  const toolsListId = 2;
  const resourceListId = 3;
  const resourceReadId = 4;
  const results = {
    tools: null,
    resources: null,
    resourceHtml: null,
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
      'taskplanner_board_visual',
      'taskplanner_board_data',
      'taskplanner_move',
      'taskplanner_get',
    ];
    for (const name of requiredTools) {
      if (!toolNames.includes(name)) {
        fail(`Missing tool: ${name}`);
      }
    }

    const visualTool = results.tools.find((tool) => tool.name === 'taskplanner_board_visual');
    const meta = visualTool?._meta || {};
    if (meta.ui?.resourceUri !== 'ui://taskplanner/board' && meta['ui/resourceUri'] !== 'ui://taskplanner/board') {
      fail('taskplanner_board_visual is missing MCP App UI metadata.');
    }

    const resource = (results.resources || []).find((item) => item.uri === 'ui://taskplanner/board');
    if (!resource) {
      fail('Board resource ui://taskplanner/board not listed.');
    }

    if (!results.resourceHtml || !results.resourceHtml.includes('TaskPlanner Board')) {
      fail('Board HTML resource did not load expected content.');
    }

    console.log('[mcp-smoke] MCP server initialized.');
    console.log(`[mcp-smoke] tools/list OK (${toolNames.length} tools).`);
    console.log('[mcp-smoke] taskplanner_board_visual UI metadata OK.');
    console.log('[mcp-smoke] board resource HTML OK.');
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
