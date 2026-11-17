// `canopy build` and `canopy dev` (`lib/cli.js`, `bin/canopy.js`).

const fs = require('fs');
const os = require('os');
const path = require('path');
const {execFileSync} = require('child_process');
const {run} = require('../../../packages/app/lib/cli');
const pkg = require('../../../packages/app/package.json');

const CLI = path.resolve(__dirname, '../../../packages/app/lib/cli.js');

// Not tsx's loaders in Jest's own process; the last test registers them in a child.
globalThis.__CANOPY_TSX_LOADERS__ = true;

function io() {
  const lines = {log: [], error: []};
  return {
    lines,
    log: (text) => lines.log.push(String(text)),
    error: (text) => lines.error.push(String(text)),
  };
}

test('help names both commands', async () => {
  const out = io();
  expect(await run(['--help'], out)).toBe(0);
  const text = out.lines.log.join('\n');
  expect(text).toMatch(/Usage: canopy <command>/);
  expect(text).toMatch(/^ {2}build\s+Build the site into site\//m);
  expect(text).toMatch(/^ {2}dev\s+Build the site, serve it/m);
});

test('the version is the package’s', async () => {
  const out = io();
  expect(await run(['--version'], out)).toBe(0);
  expect(out.lines.log).toEqual([pkg.version]);
});

test('no command, or an unknown one, fails with the usage', async () => {
  for (const argv of [[], ['deploy']]) {
    const out = io();
    expect(await run(argv, out)).toBe(1);
    expect(out.lines.error.join('\n')).toMatch(/Usage: canopy <command>/);
  }
  const out = io();
  await run(['deploy'], out);
  expect(out.lines.error[0]).toMatch(/Unknown command: deploy/);
});

test('a command runs the orchestrator in that mode, with its options', async () => {
  jest.resetModules();
  const calls = [];
  jest.doMock('../../../packages/app/lib/orchestrator', () => ({
    orchestrate: async (options) => calls.push(options),
  }));
  const {run: runMocked} = require('../../../packages/app/lib/cli');
  expect(await runMocked(['build', '--debug'], io())).toBe(0);
  expect(await runMocked(['dev'], io())).toBe(0);
  expect(calls).toEqual([{argv: ['--build', '--debug']}, {argv: ['--dev']}]);
  jest.dontMock('../../../packages/app/lib/orchestrator');
});

test('the command loads what 1.x’s tsx loaded: MDX importing a .jsx of its own', () => {
  // As the docs' home page imports its components: an ES module (compiled MDX) importing
  // a .jsx file that requires its packages.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'canopy-loaders-'));
  try {
    fs.writeFileSync(
      path.join(dir, 'Note.jsx'),
      'const React = require("react");\nmodule.exports = function Note() { return <p>A note</p>; };\n',
    );
    fs.writeFileSync(
      path.join(dir, 'page.mjs'),
      'import Note from "./Note.jsx";\nconsole.log(typeof Note);\n',
    );
    fs.symlinkSync(path.resolve(__dirname, '../../../node_modules'), path.join(dir, 'node_modules'), 'dir');
    const env = {...process.env};
    delete env.NODE_OPTIONS;
    const load = (register) =>
      execFileSync(
        process.execPath,
        ['-e', `${register ? `require(${JSON.stringify(CLI)}).registerLoaders()` : 'Promise.resolve()'}.then(() => import(${JSON.stringify(path.join(dir, 'page.mjs'))}))`],
        {cwd: dir, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']},
      ).trim();
    expect(() => load(false)).toThrow(/Unknown file extension "\.jsx"/);
    expect(load(true)).toBe('function');
  } finally {
    fs.rmSync(dir, {recursive: true, force: true});
  }
});
