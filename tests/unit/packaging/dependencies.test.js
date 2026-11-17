// Every package the published code of @nulib/canopy imports is one it declares, so a site
// needs only @nulib/canopy, React and React DOM. Until 2.0 the build's Markdown parsers
// came through @mdx-js/mdx and remark-gfm, found only because npm installed them at the
// top of node_modules, and esbuild and Tailwind came from each site's own package.json.

const fs = require('fs');
const path = require('path');
const {builtinModules} = require('module');
const {execFileSync} = require('child_process');

const REPO = path.resolve(__dirname, '../../..');
const DIR = path.join(REPO, 'packages/app');
const pkg = require(path.join(DIR, 'package.json'));

const PATTERNS = [
  /require\(\s*['"]([^'"\n]+)['"]\s*\)/g,
  /require\.resolve\(\s*['"]([^'"\n]+)['"]/g,
  /\bfrom\s*['"]([^'"\n]+)['"]/g,
  /\bimport\s*\(\s*['"]([^'"\n]+)['"]\s*\)/g,
  /\bimport\s+['"]([^'"\n]+)['"]/g,
];
// A module an esbuild plugin answers for, not a package (`search/search.js`).
const VIRTUAL = new Set(['__CANOPY_SEARCH_RESULT_TEMPLATES__']);

const published = JSON.parse(
  execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts', '-w', pkg.name], {
    cwd: REPO,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }),
)[0].files
  .map((file) => file.path)
  .filter((file) => /\.(c|m)?jsx?$/.test(file));

const packageOf = (spec) =>
  spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];

function importsOf(text) {
  const names = new Set();
  for (const pattern of PATTERNS) {
    for (const [, spec] of text.matchAll(pattern)) {
      if (/^(\.|\/|node:|file:|data:|https?:|#)/.test(spec) || VIRTUAL.has(spec)) continue;
      names.add(packageOf(spec));
    }
  }
  return names;
}

test('the published code imports only what the package declares', () => {
  const declared = new Set([
    pkg.name,
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.peerDependencies || {}),
  ]);
  const builtins = new Set(builtinModules.map((name) => name.split('/')[0]));
  const undeclared = [];
  for (const file of published) {
    for (const name of importsOf(fs.readFileSync(path.join(DIR, file), 'utf8'))) {
      if (!declared.has(name) && !builtins.has(name)) undeclared.push(`${name} (${file})`);
    }
  }
  expect(published.length).toBeGreaterThan(40);
  expect(undeclared).toEqual([]);
});

test('the build brings its own tools, and React stays the site’s', () => {
  for (const name of [
    'esbuild',
    // The command's loaders, as 1.x sites' builds ran through tsx (`lib/cli.js`).
    'tsx',
    '@tailwindcss/cli',
    'tailwindcss',
    'micromark-extension-mdxjs',
    'mdast-util-mdx',
    'micromark-extension-gfm',
    'mdast-util-gfm',
  ]) {
    expect([name, Boolean(pkg.dependencies[name])]).toEqual([name, true]);
  }
  expect(Object.keys(pkg.peerDependencies).sort()).toEqual(['react', 'react-dom']);
  expect(pkg.devDependencies).toBeUndefined();
});

test('the canopy command is published, and runs', () => {
  expect(pkg.bin).toEqual({canopy: 'bin/canopy.js'});
  const all = JSON.parse(
    execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts', '-w', pkg.name], {
      cwd: REPO,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }),
  )[0].files;
  const bin = all.find((file) => file.path === 'bin/canopy.js');
  expect(bin).toBeTruthy();
  expect(bin.mode & 0o111).toBeTruthy();
  const env = {...process.env};
  delete env.NODE_OPTIONS;
  const version = execFileSync(process.execPath, [path.join(DIR, 'bin/canopy.js'), '--version'], {
    env,
    encoding: 'utf8',
  });
  expect(version.trim()).toBe(pkg.version);
});
