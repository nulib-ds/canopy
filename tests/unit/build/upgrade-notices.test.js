// What the build says once to a site made before 2.0 (`lib/build/upgrade-notices.js`).

const fs = require('fs');
const os = require('os');
const path = require('path');
const {upgradeNotices, searchHeadingNotice} = require('../../../packages/app/lib/build/upgrade-notices');

function site(pkg, files = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'canopy-notices-'));
  if (pkg) fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify(pkg));
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), {recursive: true});
    fs.writeFileSync(path.join(dir, rel), text);
  }
  return dir;
}

const V1 = {
  scripts: {build: 'tsx app/scripts/canopy-build.mts', dev: 'tsx app/scripts/canopy-build.mts'},
  dependencies: {
    '@canopy-iiif/app': '^2.0.0',
    '@samvera/clover-iiif': '^3.16.0',
    'embla-carousel': '^8.6.0',
    react: '^19.0.0',
  },
  devDependencies: {tsx: '^4.19.1'},
};

test('a 1.x site hears of the new name, Clover 3, Embla and tsx', () => {
  const notes = upgradeNotices(site(V1));
  expect(notes).toHaveLength(4);
  expect(notes[0]).toMatch(/published as @nulib\/canopy since 2\.0/);
  expect(notes[0]).toMatch(/@canopy-iiif\/app passes through to it and keeps working/);
  expect(notes[0]).toMatch(/upgrading\.html$/);
  expect(notes[1]).toBe(
    '@samvera/clover-iiif (Clover 3) is in package.json and nothing imports it: Canopy 2 brings Clover 4 itself, so it can be removed.',
  );
  expect(notes[2]).toMatch(/^embla-carousel is in package\.json and nothing imports it: the hero’s carousel/);
  expect(notes[3]).toMatch(/runs Canopy through tsx \(build, dev\)/);
});

test('Clover 3 that a component of the site imports stays', () => {
  const dir = site(V1, {
    'app/components/Old.jsx': 'import Viewer from "@samvera/clover-iiif/viewer";\n',
    'app/components/nested/Fine.tsx': 'export default 1;\n',
  });
  const notes = upgradeNotices(dir);
  expect(notes[1]).toBe(
    'app/components/Old.jsx imports @samvera/clover-iiif (Clover 3), which Canopy 2 no longer uses. It keeps working while it stays in package.json.',
  );
});

test('a 2.x site, and a folder that is not a site, hear nothing', () => {
  expect(
    upgradeNotices(
      site({scripts: {build: 'canopy build', dev: 'canopy dev'}, dependencies: {'@nulib/canopy': '^2.0.0'}}),
    ),
  ).toEqual([]);
  expect(upgradeNotices(site(null))).toEqual([]);
});

test('a site that names both packages is switching, and hears nothing of the name', () => {
  const notes = upgradeNotices(
    site({dependencies: {'@canopy-iiif/app': '^2.0.0', '@nulib/canopy': '^2.0.0'}}),
  );
  expect(notes).toEqual([]);
});

test('a search page with no h1, as a 1.x layout renders it, hears how to give it one', () => {
  expect(searchHeadingNotice('<main><h1 class="x">Search</h1><div id="search-results"></div></main>')).toBe(null);
  expect(searchHeadingNotice('<main><h1>Buscar</h1></main>')).toBe(null);
  const note = searchHeadingNotice('<main><div data-canopy-search-tabs></div><div id="search-results"></div></main>');
  expect(note).toMatch(/^content\/search\/_layout\.mdx gives the search page no h1/);
  expect(note).toMatch(/<h1>\{props\.page\?\.title \|\| "Search"\}<\/h1>/);
  // An h2 or a heading-like word is not an h1.
  expect(searchHeadingNotice('<h2>Search</h2><p>h1</p><header1>x</header1>')).not.toBe(null);
});
