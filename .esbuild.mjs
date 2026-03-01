import * as esbuild from 'esbuild';

const isWatch  = process.argv.includes('--watch');
const isMinify = process.argv.includes('--minify');

const sharedOptions = {
  bundle:    true,
  sourcemap: !isMinify,
  minify:    isMinify,
  logLevel:  /** @type {esbuild.LogLevel} */ ('info'),
};

// ── Extension host (Node.js) ─────────────────────────────────────────────────
const extCtx = await esbuild.context({
  ...sharedOptions,
  entryPoints: ['src/extension.ts'],
  outfile:     'out/extension.js',
  external:    ['vscode'],
  format:      'cjs',
  platform:    'node',
  target:      'node18',
});

// ── Webview (browser) ────────────────────────────────────────────────────────
// urlUtils is bundled into the output — no module system at runtime.
const webCtx = await esbuild.context({
  ...sharedOptions,
  entryPoints: ['src/webview/browser.ts'],
  outfile:     'media/browser.js',
  format:      'iife',     // self-contained, no require() or import
  platform:    'browser',
  target:      ['chrome108'],  // VS Code ships Electron ≥28 (Chromium ≥108)
});

if (isWatch) {
  await Promise.all([extCtx.watch(), webCtx.watch()]);
  console.log('Watching for changes…');
} else {
  await Promise.all([extCtx.rebuild(), webCtx.rebuild()]);
  await Promise.all([extCtx.dispose(), webCtx.dispose()]);
}
