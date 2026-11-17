// Either name a site's code imports Canopy by, read as @nulib/canopy wherever the build
// compiles or bundles it (`lib/build/package-names.js`): MDX pages and layouts, a site's
// components for the server and the browser, and the search result templates.

const fs = require('fs');
const os = require('os');
const path = require('path');
const esbuild = require('esbuild');
const {
  PACKAGE_NAME,
  LEGACY_NAMES,
  currentSpec,
  serverSpec,
  recmaPackageImports,
  esbuildPackageNames,
  esbuildServerPackageNames,
} = require('../../../packages/app/lib/build/package-names');

const REPO = path.resolve(__dirname, '../../..');

test('the names', () => {
  expect(PACKAGE_NAME).toBe('@nulib/canopy');
  expect(LEGACY_NAMES).toEqual(['@canopy-iiif/app']);
});

test('a specifier of either name is read as the new one, and the browser UI as the server’s', () => {
  expect(currentSpec('@canopy-iiif/app')).toBe('@nulib/canopy');
  expect(currentSpec('@canopy-iiif/app/ui')).toBe('@nulib/canopy/ui');
  expect(currentSpec('@canopy-iiif/app/ui/server')).toBe('@nulib/canopy/ui/server');
  expect(currentSpec('@canopy-iiif/app/head')).toBe('@nulib/canopy/head');
  expect(currentSpec('@nulib/canopy/base-path')).toBe('@nulib/canopy/base-path');
  expect(serverSpec('@canopy-iiif/app/ui')).toBe('@nulib/canopy/ui/server');
  expect(serverSpec('@nulib/canopy/ui')).toBe('@nulib/canopy/ui/server');
  expect(serverSpec('@canopy-iiif/app/ui/theme')).toBe('@nulib/canopy/ui/theme');
  // Not ours, nor a prefix of ours.
  for (const spec of ['react', '@canopy-iiif/helpers/docs/x.js', '@canopy-iiif/apple', '@nulib/clover', '@nulib/canopy-x']) {
    expect(currentSpec(spec)).toBe(spec);
    expect(serverSpec(spec)).toBe(spec);
  }
});

test('an MDX page’s imports are read, and its words are left as written', async () => {
  const {compile} = await import('@mdx-js/mdx');
  const source = [
    'import {Card} from "@canopy-iiif/app/ui";',
    'import {Meta} from "@canopy-iiif/app/head";',
    'export {Button} from "@canopy-iiif/app/ui/server";',
    '',
    'A 1.x site imports `"@canopy-iiif/app/ui"`:',
    '',
    '```js',
    'import {Card} from "@canopy-iiif/app/ui";',
    '```',
  ].join('\n');
  const server = String(await compile(source, {recmaPlugins: [[recmaPackageImports, {server: true}]]}));
  expect(server).toMatch(/import \{Card\} from "@nulib\/canopy\/ui\/server";/);
  expect(server).toMatch(/import \{Meta\} from "@nulib\/canopy\/head";/);
  expect(server).toMatch(/export \{Button\} from "@nulib\/canopy\/ui\/server";/);
  // The inline code and the code block keep the name they show.
  expect((server.match(/\\"@canopy-iiif\/app\/ui\\"/g) || []).length).toBe(2);

  const layout = String(await compile(source, {recmaPlugins: [[recmaPackageImports, {server: false}]]}));
  expect(layout).toMatch(/import \{Card\} from "@nulib\/canopy\/ui";/);
});

function siteWith(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'canopy-names-'));
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), {recursive: true});
    fs.writeFileSync(path.join(dir, rel), text);
  }
  fs.symlinkSync(path.join(REPO, 'node_modules'), path.join(dir, 'node_modules'), 'dir');
  return dir;
}

test('a component bundled for the browser finds the package by its 1.x name', async () => {
  const dir = siteWith({
    'app/components/Link.client.jsx':
      'import {withBasePath} from "@canopy-iiif/app/base-path";\nexport const href = withBasePath("/a");\n',
  });
  try {
    const out = await esbuild.build({
      entryPoints: [path.join(dir, 'app/components/Link.client.jsx')],
      bundle: true,
      write: false,
      format: 'esm',
      platform: 'browser',
      logLevel: 'silent',
      plugins: [esbuildPackageNames()],
    });
    const code = out.outputFiles[0].text;
    expect(code).toMatch(/function withBasePath/);
    expect(code).not.toMatch(/@canopy-iiif\/app/);
  } finally {
    fs.rmSync(dir, {recursive: true, force: true});
  }
});

test('a component bundled for the server imports the package’s server entry, by its new name', async () => {
  const dir = siteWith({
    'app/components/Box.jsx':
      'import {Card} from "@canopy-iiif/app/ui";\nimport {Meta} from "@nulib/canopy/head";\nexport default function Box(){ return [Card, Meta]; }\n',
  });
  try {
    const out = await esbuild.build({
      entryPoints: [path.join(dir, 'app/components/Box.jsx')],
      bundle: true,
      write: false,
      format: 'esm',
      platform: 'node',
      logLevel: 'silent',
      plugins: [esbuildServerPackageNames()],
    });
    const code = out.outputFiles[0].text;
    expect(code).toMatch(/from "@nulib\/canopy\/ui\/server"/);
    expect(code).toMatch(/from "@nulib\/canopy\/head"/);
    expect(code).not.toMatch(/@canopy-iiif\/app/);

    // A component loaded by its own path keeps the UI entry it names, as in 1.x.
    const own = await esbuild.build({
      entryPoints: [path.join(dir, 'app/components/Box.jsx')],
      bundle: true,
      write: false,
      format: 'esm',
      platform: 'node',
      logLevel: 'silent',
      plugins: [esbuildServerPackageNames({server: false})],
    });
    expect(own.outputFiles[0].text).toMatch(/from "@nulib\/canopy\/ui"/);
  } finally {
    fs.rmSync(dir, {recursive: true, force: true});
  }
});
