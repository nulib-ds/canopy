// How Canopy's search matches words (packages/app/lib/search/engine.js). Both search
// runtimes, the search page's and the header's suggestions, go through this engine, so
// these are what a visitor gets on both. A change of engine or of its settings that
// changes any of them should change this file on purpose.
//
// Measured against Canopy 1.x (FlexSearch 0.7.43) on the docs site's 223 records and 51
// queries (2026-11-16): the same hits for every query, but where accents now match
// ("haridwar" finds "Haridwār"), and the same first hit for 40 of 50.

const { execFileSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const FlexSearch = require('flexsearch');
const { ENGINE_ID, createEngine, searchText } = require('../../../packages/app/lib/search/engine');
const { resolveFlexSearchCompact } = require('../../../packages/app/lib/search/bundle');

const RECORDS = [
  { title: 'Map', type: 'docs', summary: 'Place works on a map with navPlace.' },
  { title: 'A Bengal atlas: containing maps of the theatre of war', type: 'work', metadata: ['1781'] },
  { title: 'The great temple, Hurdwar', type: 'work', metadata: ['Haridwār (India)', '1830'] },
  { title: 'Inhabitants of Amsterdam-Island', type: 'work', metadata: ['Cartes françaises'] },
  { title: 'Viewer', type: 'docs', summary: 'Embed a IIIF Manifest in a page with a deep zoom viewer.' },
  { title: 'Layout', type: 'docs', summary: 'Use a custom layout if a section needs its own frame.' },
  { title: 'Report of the select committee upon the cotton manufacture', type: 'work', metadata: ['1805'] },
  { title: 'View of Benares', type: 'work', metadata: ['1800', 'Vārānasi (India)'] },
  { title: 'Miniatures on mica, [seated woman sewing]', type: 'work' },
  { title: 'Miniatures on mica, [seated man, metalworking]', type: 'work' },
  { title: 'Search', type: 'page', summary: 'Search the collection.' },
  { title: 'Manuscripts of the court', type: 'work', metadata: ['México'] },
  { title: 'Bound volume', type: 'work', annotation: 'A note in pencil about the binding.' },
];

const engine = createEngine(FlexSearch);
const index = engine.buildIndex(RECORDS);
const find = (query, limit) => engine.search(index, query, limit);
const titles = (ids) => ids.map((id) => RECORDS[id].title);
const sorted = (ids) => [...ids].sort((a, b) => a - b);

test('a word is found by its beginning', () => {
  expect(sorted(find('manu'))).toEqual([6, 11]);
  expect(titles(find('manuscript'))).toEqual(['Manuscripts of the court']);
});

test('case does not matter', () => {
  expect(find('VIEWER')).toEqual(find('viewer'));
  expect(find('viewer')[0]).toBe(4);
});

test('accents do not matter, either way', () => {
  expect(find('haridwar')).toEqual([2]);
  expect(find('Haridwār')).toEqual([2]);
  expect(find('varanasi')).toEqual([7]);
  expect(find('francaises')).toEqual([3]);
  expect(find('mexico')).toEqual([11]);
  expect(find('méxico')).toEqual([11]);
});

test('every word of a query must be found', () => {
  expect(find('seated woman')).toEqual([8]);
  expect(sorted(find('seated'))).toEqual([8, 9]);
  expect(find('seated xyzzy')).toEqual([]);
});

test('repeated letters and long numbers are matched as written', () => {
  // FlexSearch's default encoder would find "if" for "iiif", and "1805" for "1800".
  expect(find('iiif')).toEqual([4]);
  expect(find('1800')).toEqual([7]);
  expect(sorted(find('180'))).toEqual([6, 7]);
});

test('a match in the title ranks above one further in', () => {
  expect(find('map')[0]).toBe(0);
  expect(find('search')[0]).toBe(10);
});

test('annotations are searched', () => {
  expect(find('binding')).toEqual([12]);
});

test('an empty query finds nothing, and the limit holds', () => {
  expect(find('')).toEqual([]);
  expect(find('   ')).toEqual([]);
  expect(find('m', 2)).toHaveLength(2);
});

test('a record is found by its title, metadata, summary and annotation, in that order', () => {
  expect(
    searchText({ title: 'T', metadata: ['M1', '', 'M2'], summary: 'S', annotation: 'A', href: '/x' }),
  ).toBe('T M1 M2 S A');
  expect(searchText(null)).toBe('');
});

const QUERIES = ['manu', 'viewer', 'haridwar', 'Haridwār', 'seated woman', 'iiif', '1800', '180', 'map', 'search', 'binding'];

test('an index exported to the cache and imported back finds the same', async () => {
  const back = await engine.importIndex(await engine.exportIndex(index));
  for (const query of QUERIES) {
    expect([query, engine.search(back, query)]).toEqual([query, find(query)]);
  }
});

test('the browser build, FlexSearch compact, finds the same as the package build', () => {
  const compact = resolveFlexSearchCompact();
  expect(fs.existsSync(compact)).toBe(true);
  const enginePath = require.resolve('../../../packages/app/lib/search/engine');
  const script = `
    import { createRequire } from 'node:module';
    const require = createRequire(${JSON.stringify(enginePath)});
    const { createEngine } = require(${JSON.stringify(enginePath)});
    const Flex = (await import(${JSON.stringify(pathToFileURL(compact).href)})).default;
    const engine = createEngine(Flex);
    const index = engine.buildIndex(${JSON.stringify(RECORDS)});
    const exported = await engine.exportIndex(index);
    const back = await engine.importIndex(exported);
    const queries = ${JSON.stringify(QUERIES)};
    console.log(JSON.stringify({
      hits: queries.map((q) => engine.search(index, q)),
      imported: queries.map((q) => engine.search(back, q)),
    }));
  `;
  const out = JSON.parse(
    execFileSync(process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf8' }),
  );
  const expected = QUERIES.map((query) => find(query));
  expect(out.hits).toEqual(expected);
  expect(out.imported).toEqual(expected);
});

test('the cache key names the engine and its settings', () => {
  expect(ENGINE_ID).toBe('flexsearch-0.8:forward:normalize');
  expect(engine.id).toBe(ENGINE_ID);
  // Pinned to FlexSearch's patches, as the compact build's file name and the settings
  // above are the 0.8 line's.
  const pkg = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, '../../../packages/app/package.json'), 'utf8'),
  );
  expect(pkg.dependencies.flexsearch).toBe('~0.8.212');
});

test('without FlexSearch the engine says so', () => {
  expect(() => createEngine(undefined)).toThrow(/FlexSearch 0\.8/);
  expect(() => createEngine({})).toThrow(/FlexSearch 0\.8/);
});
