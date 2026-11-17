// `@canopy-iiif/app`, Canopy's 1.x name, kept in 2.x as a package whose every entry passes
// through to `@nulib/canopy` (packages/app-alias): a 1.x site's package.json, stylesheet,
// build script and MDX imports go on working unedited (the MDX API is a contract).

const fs = require('fs');
const path = require('path');
const {execFileSync} = require('child_process');

const REPO = path.resolve(__dirname, '../../..');
const MAIN_DIR = path.join(REPO, 'packages/app');
const ALIAS_DIR = path.join(REPO, 'packages/app-alias');
const main = require(path.join(MAIN_DIR, 'package.json'));
const alias = require(path.join(ALIAS_DIR, 'package.json'));

// The files `npm publish` would send, as `npm pack` lists them.
function packed(workspace) {
  const out = execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts', '-w', workspace], {
    cwd: REPO,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  return new Set(JSON.parse(out)[0].files.map((file) => file.path));
}

const targetsOf = (entry) =>
  [...new Set(typeof entry === 'string' ? [entry] : Object.values(entry))].map((target) =>
    target.replace(/^\.\//, ''),
  );

const mainFiles = packed('@nulib/canopy');
const aliasFiles = packed('@canopy-iiif/app');

// The entries of the main package a site can reach: their files are published. (Two in
// its exports map have none behind them, as in 1.x: `./ui/styles/runtime.css`, never
// written, and `./docs-legacy-compat`, which `files` leaves out.)
const reachable = Object.entries(main.exports).filter(
  ([key, entry]) => key.includes('*') || targetsOf(entry).every((target) => mainFiles.has(target)),
);

test('the alias is the 1.x name, at the version of @nulib/canopy, and depends on exactly it', () => {
  expect(main.name).toBe('@nulib/canopy');
  expect(alias.name).toBe('@canopy-iiif/app');
  expect(alias.version).toBe(main.version);
  expect(alias.dependencies).toEqual({'@nulib/canopy': main.version});
});

test('every entry a site can reach in @nulib/canopy has its counterpart in the alias', () => {
  expect(reachable.length).toBeGreaterThan(10);
  expect(Object.keys(alias.exports).sort()).toEqual(reachable.map(([key]) => key).sort());
  for (const [key, entry] of reachable) {
    expect([key, alias.exports[key]]).toEqual([key, entry]);
    if (key.includes('*')) continue;
    for (const target of targetsOf(entry)) {
      expect([key, target, aliasFiles.has(target)]).toEqual([key, target, true]);
    }
  }
});

test('each shared component module has its counterpart, and nothing else does', () => {
  const dir = path.join(MAIN_DIR, 'lib/components');
  const shared = fs
    .readdirSync(dir)
    .filter((name) => /module\.exports/.test(fs.readFileSync(path.join(dir, name), 'utf8')))
    .sort();
  expect(shared).toContain('referenced.js');
  for (const name of shared) expect(mainFiles.has(`lib/components/${name}`)).toBe(true);
  expect(fs.readdirSync(path.join(ALIAS_DIR, 'lib/components')).sort()).toEqual(shared);
});

test('the entries are the very same modules under either name, in Node', () => {
  // A child process, as the build's Markdown parsers are ES modules that Node requires
  // and Jest cannot.
  const cjs = [
    '',
    '/head',
    '/base-path',
    '/orchestrator',
    '/ui/theme',
    '/ui/tailwind-config',
    '/ui/canopy-iiif-plugin',
    '/ui/canopy-iiif-preset',
    ...fs.readdirSync(path.join(ALIAS_DIR, 'lib/components')).map((name) => `/lib/components/${name}`),
  ];
  const script = `
    const out = {};
    for (const sub of ${JSON.stringify(cjs)}) {
      const before = require('@canopy-iiif/app' + sub);
      out[sub] = before === require('@nulib/canopy' + sub) && before != null;
    }
    (async () => {
      for (const sub of ['/ui', '/ui/server']) {
        const before = await import('@canopy-iiif/app' + sub);
        const after = await import('@nulib/canopy' + sub);
        const names = Object.keys(after);
        out[sub] =
          names.length > 20 &&
          Object.keys(before).length === names.length &&
          names.every((name) => before[name] === after[name]);
      }
      process.stdout.write(JSON.stringify(out));
    })();
  `;
  const env = {...process.env};
  delete env.NODE_OPTIONS;
  const out = JSON.parse(
    execFileSync(process.execPath, ['-e', script], {cwd: REPO, env, encoding: 'utf8'}),
  );
  const expected = Object.fromEntries([...cjs, '/ui', '/ui/server'].map((sub) => [sub, true]));
  expect(out).toEqual(expected);
});

test('the stylesheet a 1.x site imports is the new package’s', () => {
  const css = fs.readFileSync(path.join(ALIAS_DIR, 'ui/styles/index.css'), 'utf8');
  expect(css).toMatch(/@import "@nulib\/canopy\/ui\/styles\/index\.css";/);
});

test('only the two packages are published', () => {
  const pub = fs
    .readdirSync(path.join(REPO, 'packages'))
    .map((dir) => path.join(REPO, 'packages', dir, 'package.json'))
    .filter((file) => fs.existsSync(file))
    .map((file) => require(file))
    .filter((pkg) => !pkg.private)
    .map((pkg) => pkg.name)
    .sort();
  expect(pub).toEqual(['@canopy-iiif/app', '@nulib/canopy']);
});
