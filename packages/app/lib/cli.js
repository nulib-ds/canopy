// The `canopy` command (`bin/canopy.js`): `canopy build` and `canopy dev`, as a site's
// package.json scripts run them since 2.0. A 1.x site ran the same through `tsx` and its
// own `app/scripts/canopy-build.mts`, which keeps working.

'use strict';

const {PACKAGE_NAME} = require('./build/package-names');

const COMMANDS = {
  build: 'Build the site into site/.',
  dev: 'Build the site, serve it at http://localhost:5001 (or $PORT), and rebuild it on change.',
};

function usage() {
  return [
    'Usage: canopy <command> [options]',
    '',
    'Commands:',
    ...Object.entries(COMMANDS).map(([name, about]) => `  ${name.padEnd(10)}${about}`),
    '',
    'Options:',
    '  --debug     Log each IIIF request as it is made.',
    '  --help      Show this help.',
    `  --version   Show the version of ${PACKAGE_NAME}.`,
  ].join('\n');
}

// A 1.x site's build ran through tsx, which let its MDX import a `.jsx`, `.tsx` or `.ts`
// file directly (the docs' home page and Style guide do). The command runs the build
// under tsx's loaders too, so that MDX keeps working as written (AGENTS.md, the MDX API
// is a contract). Once a process: under a site's own `tsx` script they are there already.
async function registerLoaders() {
  if (globalThis.__CANOPY_TSX_LOADERS__) return;
  globalThis.__CANOPY_TSX_LOADERS__ = true;
  require('tsx/cjs/api').register();
  // Its ES module API by import: the CommonJS build of it (4.23) names a loader file the
  // package does not have.
  const {register} = await import('tsx/esm/api');
  register();
}

// Resolves to the exit code; `dev` resolves only when the server stops.
async function run(argv = process.argv.slice(2), io = console) {
  const [command, ...rest] = argv;
  if (command === '--help' || command === '-h' || command === 'help') {
    io.log(usage());
    return 0;
  }
  if (command === '--version' || command === '-v') {
    io.log(require('../package.json').version);
    return 0;
  }
  if (!command || !Object.prototype.hasOwnProperty.call(COMMANDS, command)) {
    io.error(command ? `[canopy][error] Unknown command: ${command}\n` : '');
    io.error(usage());
    return 1;
  }
  await registerLoaders();
  const {orchestrate} = require('./orchestrator');
  await orchestrate({argv: [`--${command}`, ...rest]});
  return 0;
}

module.exports = {run, usage, registerLoaders, COMMANDS};
