// What an MDX page is found by, and what its search result shows
// (packages/app/lib/build/search-text.js, through mdx.js's `extractSearchText`). Run in a
// child process: the MDX parser is ESM, which Node 24 requires and Jest 29 cannot.

const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { extractPlainText } = require('../../../packages/app/lib/build/mdx');

const repoRoot = path.resolve(__dirname, '../../..');
const mdxPath = path.join(repoRoot, 'packages/app/lib/build/mdx.js');

function extract(sources) {
  const script = `
    const { extractSearchText } = require(${JSON.stringify(mdxPath)});
    const sources = ${JSON.stringify(sources)};
    const out = {};
    for (const [name, source] of Object.entries(sources)) out[name] = extractSearchText(source);
    process.stdout.write(JSON.stringify(out));
  `;
  const result = spawnSync(process.execPath, ['-e', script], { cwd: repoRoot, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr);
  return JSON.parse(result.stdout);
}

const PAGE = [
  '---',
  'title: A page',
  '---',
  '',
  'import {Thing} from "./thing.js";',
  'export const meta = {a: 1};',
  '',
  '# The title',
  '',
  '`<Map>` draws a map. See [the docs](/docs/) for *more* and **much more**.',
  '',
  '<Map height="600px" geoReferences={["https://example.org/a"]}>',
  '  <MapPoint lat="1" lng="2" title="A point" />',
  '</Map>',
  '',
  '<Feature title="A feature">Words inside a component.</Feature>',
  '',
  '{props.title}',
  '',
  '```js',
  'const hidden = true;',
  '```',
  '',
  '| Prop | Type |',
  '| ---- | ---- |',
  '| `height` | string |',
  '',
  '- A list item',
  '',
  '> A quote',
  '',
  'A snake_case word, 5 * 3, and ![an image](/i.png) done.',
].join('\n');

const out = extract({ page: PAGE, broken: '# Broken\n\nA <b unclosed tag and [a link](/x).' });

test('the text a page is found by is its prose, headings included', () => {
  expect(out.page.text).toBe(
    'The title <Map> draws a map. See the docs for more and much more. ' +
      'Words inside a component. height · string A list item A quote ' +
      'A snake_case word, 5 * 3, and done.',
  );
});

test("a result's excerpt keeps inline code and emphasis, escapes the rest", () => {
  expect(out.page.markdown).toBe(
    '`<Map>` draws a map. See the docs for *more* and **much more**. ' +
      'Words inside a component. `height` · string A list item A quote ' +
      'A snake\\_case word, 5 \\* 3, and done.',
  );
});

test('code, components, expressions, imports and a table header are left out', () => {
  for (const words of ['hidden', 'geoReferences', 'A point', 'props', 'Thing', 'meta', 'Prop · Type']) {
    expect([words, out.page.text.includes(words)]).toEqual([words, false]);
  }
});

test('a page the parser cannot read falls back to the patterns, and keeps its links', () => {
  expect(out.broken.text).toMatch(/a link/);
  expect(out.broken.text).not.toMatch(/\$1/);
});

test('the patterns keep a link\'s words (they wrote "$1" for each)', () => {
  expect(extractPlainText('See [the docs](/docs/) now.')).toBe('See the docs now.');
});
