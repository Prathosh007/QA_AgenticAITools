const esbuild = require("esbuild"); //No I18N

const production = process.argv.includes('--production'); //No I18N
const watch = process.argv.includes('--watch'); //No I18N

/**
 * @type {import('esbuild').Plugin}
 */
const esbuildProblemMatcherPlugin = {
  name: 'esbuild-problem-matcher', //No I18N
  setup(build) {
    build.onStart(() => {
      console.log('[watch] build started'); // eslint-disable-line no-console
    });
    build.onEnd((result) => {
      result.errors.forEach(({ text, location }) => {
        console.error(`✘ [ERROR] ${text}`); // eslint-disable-line no-console
        console.error(`    ${location.file}:${location.line}:${location.column}:`); // eslint-disable-line no-console
      });
      console.log('[watch] build finished'); // eslint-disable-line no-console
    });
  }
};

async function main() {
  const ctx = await esbuild.context({
    entryPoints: ['src/extension.ts'], //No I18N
    bundle: true,
    format: 'cjs', //No I18N
    minify: production,
    sourcemap: !production,
    sourcesContent: false,
    platform: 'node', //No I18N
    outfile: 'dist/extension.js', //No I18N
    external: ['vscode'],
    logLevel: 'silent', //No I18N
    plugins: [esbuildProblemMatcherPlugin]
  });

  if (watch) {
    await ctx.watch();
  } else {
    await ctx.rebuild();
    await ctx.dispose();
  }
}

main().catch(e => {
  console.error(e); // eslint-disable-line no-console
  process.exit(1);
});
