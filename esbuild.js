const esbuild = require('esbuild');

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

async function main() {
  const ctx = await esbuild.context({
    entryPoints: ['src/server.ts'],
    outfile: 'dist/server.js',
    bundle: true,
    format: 'cjs',
    platform: 'node',
    target: 'node18',
    sourcemap: !production,
    sourcesContent: false,
    minify: production,
    logLevel: 'warning',
    banner: {
      js: '#!/usr/bin/env node\n',
    },
  });

  if (watch) {
    await ctx.watch();
  } else {
    await ctx.rebuild();
    await ctx.dispose();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
