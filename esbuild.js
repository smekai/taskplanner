const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

const shared = {
  bundle: true,
  format: 'cjs',
  minify: production,
  sourcemap: !production,
  sourcesContent: false,
  platform: 'node',
  logLevel: 'info',
};

const boardUiDir = path.join(__dirname, 'src', 'mcp', 'ui', 'board');
const pluginRoot = path.join(__dirname, 'plugins', 'taskplanner');
const boardUiOutDir = path.join(pluginRoot, 'ui', 'board');
const boardHtmlTemplate = path.join(boardUiDir, 'board.html');
const boardCssFile = path.join(boardUiDir, 'board.css');
const boardHtmlOut = path.join(boardUiOutDir, 'index.html');

// The MCP server bundle is written once, for the plugin, and copied into the npm package.
// Copying rather than building twice makes the two artifacts byte-identical: one implementation
// shipped to two install locations, never a fork.
const mcpServerOut = path.join(pluginRoot, 'dist', 'mcp-server.js');
const mcpPackageRoot = path.join(__dirname, 'packages', 'mcp-server');
const mcpPackageServerOut = path.join(mcpPackageRoot, 'dist', 'mcp-server.js');
const mcpPackageBoardHtmlOut = path.join(mcpPackageRoot, 'ui', 'board', 'index.html');

// The bundle resolves its board HTML through __dirname, which only exists because the output
// format is CJS. Keep it that way — `shared.format` is load-bearing for the published package,
// which is spawned by plain `node` (see scripts/smoke-test-mcp-server.js).
function syncMcpPackage() {
  if (shared.format !== 'cjs') {
    throw new Error(
      `MCP bundle format must stay "cjs" (__dirname is used at runtime); got "${shared.format}".`,
    );
  }

  const copies = [
    [mcpServerOut, mcpPackageServerOut],
    [boardHtmlOut, mcpPackageBoardHtmlOut],
  ];
  for (const [from, to] of copies) {
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(from, to);
  }

  // No sourcemap in the package: `files` ships all of dist/, and a dev-build map would be
  // published alongside the production bundle it does not describe.
  fs.rmSync(`${mcpPackageServerOut}.map`, { force: true });

  console.log(`[mcp-package] synced ${path.relative(__dirname, mcpPackageRoot)}`);
}

async function buildBoardUi() {
  const result = await esbuild.build({
    entryPoints: [path.join(boardUiDir, 'board.ts')],
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: ['es2020'],
    minify: production,
    sourcemap: false,
    sourcesContent: false,
    write: false,
    logLevel: 'silent',
  });
  const js = result.outputFiles[0].text;
  const css = fs.readFileSync(boardCssFile, 'utf8');
  const template = fs.readFileSync(boardHtmlTemplate, 'utf8');
  const html = template.replace('/*__CSS__*/', () => css).replace('/*__JS__*/', () => js);
  fs.mkdirSync(boardUiOutDir, { recursive: true });
  fs.writeFileSync(boardHtmlOut, html, 'utf8');
  console.log(`[board-ui] wrote ${path.relative(__dirname, boardHtmlOut)} (${html.length} bytes)`);
}

function boardUiWatchPlugin() {
  return {
    name: 'board-ui',
    setup(build) {
      build.onStart(async () => {
        try {
          await buildBoardUi();
        } catch (e) {
          console.error('[board-ui] build failed:', e.message);
        }
      });
    },
  };
}

async function main() {
  const extensionCtx = await esbuild.context({
    ...shared,
    entryPoints: ['src/extension/extension.ts'],
    outfile: 'dist/extension.js',
    external: ['vscode'],
    plugins: [
      {
        name: 'watch-plugin',
        setup(build) {
          build.onEnd((result) => {
            if (result.errors.length === 0) {
              console.log('[watch] extension build succeeded');
            }
          });
        },
      },
    ],
  });

  const mcpCtx = await esbuild.context({
    ...shared,
    entryPoints: ['src/mcp/server.ts'],
    outfile: mcpServerOut,
    plugins: [
      boardUiWatchPlugin(),
      {
        name: 'watch-plugin',
        setup(build) {
          build.onEnd((result) => {
            if (result.errors.length === 0) {
              syncMcpPackage();
              console.log('[watch] mcp-server build succeeded');
            }
          });
        },
      },
    ],
  });

  if (watch) {
    await extensionCtx.watch();
    await mcpCtx.watch();
    console.log('[watch] watching for changes...');
  } else {
    await extensionCtx.rebuild();
    await mcpCtx.rebuild();
    await extensionCtx.dispose();
    await mcpCtx.dispose();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
