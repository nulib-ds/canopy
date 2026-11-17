// The UI bundle every browser runtime is built from (`ui/dist/index.mjs`) holds Canopy's
// own components. A library a component loads only when it needs it stays outside it,
// external (`ui/scripts/build-ui.mjs`), so a runtime that never uses it never carries it.
// Until 2.x Phase 7 the map's Allmaps layer was inlined: 2.2 MB with zod, proj4 and
// Allmaps' renderer, which every runtime built from the UI carried, the search page's
// among them (2.9 MB, 470 KB gzipped; 108 KB and 35 KB since).

const fs = require('node:fs');
const path = require('node:path');

const DIST = path.resolve(__dirname, '../../../packages/app/ui/dist/index.mjs');

test('the UI bundle inlines no package of its own', () => {
  const source = fs.readFileSync(DIST, 'utf8');
  const inlined = new Set(
    [...source.matchAll(/^\/\/ \S*node_modules\/((?:@[^/]+\/)?[^/\s]+)/gm)].map((match) => match[1]),
  );
  expect([...inlined]).toEqual([]);
});

test('the map loads Allmaps itself, when a map needs it', () => {
  const source = fs.readFileSync(DIST, 'utf8');
  expect(source).toMatch(/import\("@allmaps\/leaflet"\)/);
});

test('the UI bundle stays under 512 KB', () => {
  expect(fs.statSync(DIST).size).toBeLessThan(512 * 1024);
});
