import * as esbuild from 'esbuild';

const isWatch = process.argv.includes('--watch');
const isMinify = process.argv.includes('--minify');

const ctx = await esbuild.context({
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'out/extension.js',
  external: ['vscode'],
  format: 'cjs',
  platform: 'node',
  target: 'node18',
  sourcemap: !isMinify,
  minify: isMinify,
  logLevel: 'info',
});

if (isWatch) {
  await ctx.watch();
  console.log('Watching for changes...');
} else {
  await ctx.rebuild();
  await ctx.dispose();
}
