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

const boardUiDir = path.join(__dirname, 'views', 'mcp-app', 'board');
const boardHtmlTemplate = path.join(boardUiDir, 'board.html');
const boardCssFile = path.join(boardUiDir, 'board.css');

const mcpPackageRoot = path.join(__dirname, 'mcp');
const mcpServerOut = path.join(mcpPackageRoot, 'dist', 'mcp-server.js');
const boardHtmlOut = path.join(mcpPackageRoot, 'ui', 'board', 'index.html');
const mcpPackageLibraryOut = path.join(mcpPackageRoot, 'dist', 'index.js');

// Marketplaces copy only a plugin's own folder, so each one carries its own server and board.
const pluginRoots = ['claude', 'cursor', 'codex'].map((host) => path.join(__dirname, 'views', host));

const claudeModOut = path.join(__dirname, 'views', 'claude', 'hooks', 'register.js');

function syncPlugins() {
  if (shared.format !== 'cjs') {
    throw new Error(
      `MCP bundle format must stay "cjs" (__dirname is used at runtime); got "${shared.format}".`,
    );
  }

  for (const pluginRoot of pluginRoots) {
    const copies = [
      [mcpServerOut, path.join(pluginRoot, 'dist', 'mcp-server.js')],
      [boardHtmlOut, path.join(pluginRoot, 'ui', 'board', 'index.html')],
    ];
    for (const [from, to] of copies) {
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.copyFileSync(from, to);
    }
  }

  if (production) fs.rmSync(`${mcpServerOut}.map`, { force: true });

  console.log(`[plugins] synced ${pluginRoots.map((root) => path.relative(__dirname, root)).join(', ')}`);
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
  fs.mkdirSync(path.dirname(boardHtmlOut), { recursive: true });
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
    entryPoints: ['views/vscode/src/extension.ts'],
    outfile: 'dist/extension.js',
    external: ['vscode'],
    plugins: [
      {
        name: 'watch-plugin',
        setup(build) {
          build.onEnd((result) => {
            if (result.errors.length === 0) {
              if (production)
                fs.rmSync(path.join(__dirname, 'dist', 'extension.js.map'), { force: true });
              console.log('[watch] extension build succeeded');
            }
          });
        },
      },
    ],
  });

  const mcpCtx = await esbuild.context({
    ...shared,
    entryPoints: ['mcp/src/server.ts'],
    outfile: mcpServerOut,
    plugins: [
      boardUiWatchPlugin(),
      {
        name: 'watch-plugin',
        setup(build) {
          build.onEnd((result) => {
            if (result.errors.length === 0) {
              syncPlugins();
              console.log('[watch] mcp-server build succeeded');
            }
          });
        },
      },
    ],
  });

  const libraryCtx = await esbuild.context({
    ...shared,
    entryPoints: ['src/core/index.ts'],
    outfile: mcpPackageLibraryOut,
    plugins: [
      {
        name: 'watch-plugin',
        setup(build) {
          build.onEnd((result) => {
            if (result.errors.length === 0) {
              console.log('[watch] core library build succeeded');
            }
          });
        },
      },
    ],
  });

  const claudeModCtx = await esbuild.context({
    entryPoints: ['views/claude/mod/src/register.ts'],
    outfile: claudeModOut,
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    target: ['es2022'],
    minify: false,
    sourcemap: false,
    logLevel: 'info',
    plugins: [
      {
        name: 'watch-plugin',
        setup(build) {
          build.onEnd((result) => {
            if (result.errors.length === 0) {
              console.log('[watch] claude-mod build succeeded');
            }
          });
        },
      },
    ],
  });

  if (watch) {
    await extensionCtx.watch();
    await mcpCtx.watch();
    await libraryCtx.watch();
    await claudeModCtx.watch();
    console.log('[watch] watching for changes...');
    console.log('[watch] note: .d.ts output is not rebuilt here — run "npm run build:types".');
  } else {
    await extensionCtx.rebuild();
    await mcpCtx.rebuild();
    await libraryCtx.rebuild();
    await claudeModCtx.rebuild();
    await extensionCtx.dispose();
    await mcpCtx.dispose();
    await libraryCtx.dispose();
    await claudeModCtx.dispose();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
