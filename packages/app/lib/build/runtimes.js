const { logLine } = require('./log');
const { fs, path, OUT_DIR, ensureDirSync } = require('../common');

async function prepareAllRuntimes() {
  const mdx = require('./mdx');
  try { await mdx.ensureClientRuntime(); } catch (_) {}
  try { if (typeof mdx.ensureTimelineRuntime === 'function') await mdx.ensureTimelineRuntime(); } catch (_) {}
  try { if (typeof mdx.ensureMapRuntime === 'function') await mdx.ensureMapRuntime(); } catch (_) {}
  try { if (typeof mdx.ensureHeroRuntime === 'function') await mdx.ensureHeroRuntime(); } catch (_) {}
  try { if (typeof mdx.ensureFacetsRuntime === 'function') await mdx.ensureFacetsRuntime(); } catch (_) {}
  try { if (typeof mdx.ensureReactGlobals === 'function') await mdx.ensureReactGlobals(); } catch (_) {}
  await prepareSearchFormRuntime();
  await prepareDiscoveryRuntime();
  try { logLine('✓ Prepared client hydration runtimes', 'cyan', { dim: true }); } catch (_) {}
}

async function resolveEsbuild() {
  try { return require('../../ui/node_modules/esbuild'); } catch (_) {
    try { return require('esbuild'); } catch (_) {
      return null;
    }
  }
}

async function prepareSearchFormRuntime() {
  const esbuild = await resolveEsbuild();
  if (!esbuild) throw new Error('Search form runtime bundling requires esbuild. Install dependencies before building.');
  ensureDirSync(OUT_DIR);
  const scriptsDir = path.join(OUT_DIR, 'scripts');
  ensureDirSync(scriptsDir);
  const entry = path.join(__dirname, '..', 'search', 'search-form-runtime.js');
  const outFile = path.join(scriptsDir, 'canopy-search-form.js');
  await esbuild.build({
    entryPoints: [entry],
    outfile: outFile,
    platform: 'browser',
    format: 'iife',
    bundle: true,
    sourcemap: false,
    target: ['es2018'],
    logLevel: 'silent',
    minify: true,
  });
  try {
    let size = 0;
    try { const st = fs.statSync(outFile); size = st.size || 0; } catch (_) {}
    const kb = size ? ` (${(size / 1024).toFixed(1)} KB)` : '';
    const rel = path.relative(process.cwd(), outFile).split(path.sep).join('/');
    logLine(`✓ Wrote ${rel}${kb}`, 'cyan');
  } catch (_) {}
}

async function prepareDiscoveryRuntime() {
  const { readWebMcpEnabled } = require('../discovery/config');
  const outFile = path.join(OUT_DIR, 'scripts', 'canopy-webmcp.js');
  if (!readWebMcpEnabled()) {
    await fs.promises.rm(outFile, { force: true });
    return;
  }
  const esbuild = await resolveEsbuild();
  if (!esbuild) throw new Error('WebMCP runtime bundling requires esbuild.');
  ensureDirSync(path.dirname(outFile));
  await esbuild.build({
    entryPoints: [path.join(__dirname, '..', 'discovery', 'browser.js')],
    outfile: outFile,
    platform: 'browser',
    format: 'iife',
    bundle: true,
    target: ['es2020'],
    logLevel: 'silent',
    minify: true,
  });
}

async function prepareSearchRuntime(timeoutMs = 10000, label = '') {
  const search = require('../search/search');
  try { logLine(`• Writing search runtime${label ? ' (' + label + ')' : ''}...`, 'blue', { bright: true }); } catch (_) {}

  let timedOut = false;
  await Promise.race([
    search.ensureSearchRuntime(),
    new Promise((_, reject) => setTimeout(() => { timedOut = true; reject(new Error('timeout')); }, Number(timeoutMs)))
  ]).catch(() => {
    try { console.warn(`Search: Bundling runtime timed out${label ? ' (' + label + ')' : ''}, skipping`); } catch (_) {}
  });
  if (timedOut) {
    try { logLine(`! Search runtime not bundled${label ? ' (' + label + ')' : ''}\n`, 'yellow'); } catch (_) {}
  }
}

module.exports = { prepareAllRuntimes, prepareSearchFormRuntime, prepareSearchRuntime, prepareDiscoveryRuntime };
