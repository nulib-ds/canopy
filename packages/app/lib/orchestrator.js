const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const { PACKAGE_NAME } = require('./build/package-names');

const log = (msg) => console.log(`[canopy] ${msg}`);
const warn = (msg) => console.warn(`[canopy][warn] ${msg}`);
const err = (msg) => console.error(`[canopy][error] ${msg}`);

let uiWatcherChild = null;

const workspacePackageJsonPath = path.resolve(process.cwd(), 'packages/app/package.json');
const hasAppWorkspace = fs.existsSync(workspacePackageJsonPath);
const workspaceUiDistDir = path.resolve(process.cwd(), 'packages/app/ui/dist');
const requiredUiArtifacts = [
  path.join(workspaceUiDistDir, 'server.mjs'),
  path.join(workspaceUiDistDir, 'index.mjs'),
];

function prettyPath(p) {
  try {
    const rel = path.relative(process.cwd(), p);
    return rel ? rel.split(path.sep).join('/') : p;
  } catch (_) {
    return p;
  }
}

function ensureUiDistReady(context = 'build') {
  if (!hasAppWorkspace) return;
  const missing = [];
  for (const file of requiredUiArtifacts) {
    try {
      if (!fs.existsSync(file)) missing.push(file);
    } catch (_) {
      missing.push(file);
    }
  }
  if (missing.length) {
    const list = missing.map((file) => prettyPath(file)).join(', ');
    const label = context ? `${context} ` : '';
    throw new Error(
      `${PACKAGE_NAME}/ui ${label}did not produce required bundle(s): ${list}. ` +
        `Run "npm -w ${PACKAGE_NAME} run ui:build" and ensure it completes successfully.`
    );
  }
}

function getMode(argv = process.argv.slice(2), env = process.env) {
  const cli = new Set(argv);
  if (cli.has('--dev')) return 'dev';
  if (cli.has('--build')) return 'build';

  if (env.CANOPY_MODE === 'dev') return 'dev';
  if (env.CANOPY_MODE === 'build') return 'build';

  const npmScript = env.npm_lifecycle_event;
  if (npmScript === 'dev') return 'dev';
  if (npmScript === 'build') return 'build';

  return 'build';
}

function runOnce(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'inherit', shell: false, ...opts });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${cmd} ${args.join(' ')} exited with code ${code}`));
      }
    });
  });
}

function start(cmd, args, opts = {}) {
  const child = spawn(cmd, args, { stdio: 'inherit', shell: false, ...opts });
  child.on('error', (error) => {
    const message = error && error.message ? error.message : String(error);
    warn(`Subprocess error (${cmd}): ${message}`);
  });
  return child;
}

async function buildUiOnce(label, env = process.env) {
  if (!hasAppWorkspace) return;
  const prefix = label || 'Building';
  log(`${prefix} UI assets (${PACKAGE_NAME}/ui)`);
  try {
    await runOnce('npm', ['-w', PACKAGE_NAME, 'run', 'ui:build'], { env });
  } catch (error) {
    const message = (error && error.message) || String(error);
    throw new Error(`[canopy] Failed to ${prefix.toLowerCase()} UI assets: ${message}`);
  }
  ensureUiDistReady(prefix.toLowerCase());
  log('UI assets ready');
}

async function prepareUi(mode, env = process.env) {
  if (!hasAppWorkspace) {
    log(`Using bundled UI assets from ${PACKAGE_NAME} (workspace not detected)`);
    return null;
  }

  if (mode === 'build') {
    await buildUiOnce('Building', env);
    return null;
  }

  await buildUiOnce('Prebuilding', env);

  log(`Starting UI watcher (${PACKAGE_NAME}/ui)`);
  try {
    uiWatcherChild = start('npm', ['-w', PACKAGE_NAME, 'run', 'ui:watch'], { env });
  } catch (error) {
    warn(`UI watch skipped: ${(error && error.message) || String(error)}`);
    uiWatcherChild = null;
  }
  return uiWatcherChild;
}

function loadLibraryApi() {
  let lib;
  try {
    lib = require('./index.js');
  } catch (e) {
    const hint = [
      `Unable to load ${PACKAGE_NAME}.`,
      'Ensure dependencies are installed (npm install)',
      "and that peer deps like 'react' are present.",
    ].join(' ');
    const detail = e && e.message ? `\nCaused by: ${e.message}` : '';
    throw new Error(`${hint}${detail}`);
  }

  const api = lib && (typeof lib.build === 'function' || typeof lib.dev === 'function')
    ? lib
    : lib && lib.default
    ? lib.default
    : lib;

  if (!api || (typeof api.build !== 'function' && typeof api.dev !== 'function')) {
    throw new TypeError(`Invalid ${PACKAGE_NAME} export: expected functions build() and/or dev().`);
  }

  return api;
}

function attachSignalHandlers() {
  const clean = () => {
    if (uiWatcherChild && !uiWatcherChild.killed) {
      try { uiWatcherChild.kill(); } catch (_) {}
    }
  };

  process.on('SIGINT', () => {
    clean();
    process.exit(130);
  });
  process.on('SIGTERM', () => {
    clean();
    process.exit(143);
  });
  process.on('exit', clean);
}

async function orchestrate(options = {}) {
  const argv = options.argv || process.argv.slice(2);
  const env = options.env || process.env;
  if (
    argv.includes('--debug-iiif') ||
    argv.includes('--iiif-debug') ||
    argv.includes('--debug')
  ) {
    if (!env.CANOPY_IIIF_DEBUG) env.CANOPY_IIIF_DEBUG = '1';
    if (!process.env.CANOPY_IIIF_DEBUG) process.env.CANOPY_IIIF_DEBUG = '1';
    log('IIIF debug logging enabled');
  }

  process.title = 'canopy-app';
  const mode = getMode(argv, env);
  log(`Mode: ${mode}`);

  await prepareUi(mode, env);

  const api = loadLibraryApi();
  let exitAfterBuild = false;
  try {
    if (mode === 'dev') {
      attachSignalHandlers();
      log('Starting dev server...');
      await (typeof api.dev === 'function' ? api.dev() : Promise.resolve());
    } else {
      log('Building site...');
      if (typeof api.build === 'function') {
        await api.build();
      }
      log('Build complete');
      exitAfterBuild = true;
    }
  } finally {
    if (uiWatcherChild && !uiWatcherChild.killed) {
      try { uiWatcherChild.kill(); } catch (_) {}
    }
  }

  if (exitAfterBuild) {
    try {
      if (!process.exitCode || process.exitCode === 0) process.exit(0);
    } catch (_) {
      process.exit(0);
    }
  }
}

module.exports = {
  orchestrate,
  _internals: {
    getMode,
    prepareUi,
    loadLibraryApi,
    runOnce,
    start,
  },
  log,
  warn,
  err,
};
