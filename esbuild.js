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
    outfile: 'plugins/taskplanner/dist/mcp-server.js',
    plugins: [
      boardUiWatchPlugin(),
      {
        name: 'watch-plugin',
        setup(build) {
          build.onEnd((result) => {
            if (result.errors.length === 0) {
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
