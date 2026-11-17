// What an MDX page's front matter gives search (`pageSearchRecord`, lib/build/search.js),
// as content/docs/user-guides/customize-the-search-index.mdx and
// content/docs/content/frontmatter.mdx promise: `search: false`, `searchType` (or `type`),
// `searchSummary`, `searchSummaryMarkdown`, `description` and `image`.

const { pageSearchRecord } = require('../../../packages/app/lib/build/search');

const page = (frontmatter, body = '# A title\n\nThe page’s own words.') =>
  `---\n${frontmatter}\n---\n\n${body}\n`;

const record = (frontmatter, options = {}, body) =>
  pageSearchRecord(page(frontmatter, body), { href: '/docs/a.html', ...options });

test('searchType sets the type, ahead of type, a layout and the default', () => {
  expect(record('searchType: docs\ntype: guide').searchType).toBe('docs');
  expect(record('type: guide').searchType).toBe('guide');
  expect(record('title: A', { layoutType: 'essay' }).searchType).toBe('essay');
  expect(record('title: A').searchType).toBe('page');
  expect(pageSearchRecord('# A\n\nWords.', { href: '/a.html' }).searchType).toBe('page');
});

test('search: false, an empty type and the search page itself are left out', () => {
  expect(record('search: false').searchInclude).toBe(false);
  expect(record('type: ""').searchInclude).toBe(false);
  expect(record('title: A', { href: '/search/index.html' }).searchInclude).toBe(false);
  expect(record('title: A').searchInclude).toBe(true);
});

test('a result shows searchSummaryMarkdown, else searchSummary, else description', () => {
  const both = 'searchSummaryMarkdown: Set `canopy.yml` first.\nsearchSummary: Plain words.\ndescription: A description.';
  expect(record(both).searchSummaryMarkdown).toBe('Set `canopy.yml` first.');
  expect(record('searchSummary: A snake_case name.\ndescription: Else.').searchSummaryMarkdown).toBe(
    'A snake\\_case name.',
  );
  expect(record('description: A description, *as written*.').searchSummaryMarkdown).toBe(
    'A description, \\*as written\\*.',
  );
});

test('without them, a result shows the page’s own words', () => {
  expect(record('title: A').searchSummaryMarkdown).toBe('The page’s own words.');
});

test('a summary’s or description’s words are searched, before the page’s own', () => {
  expect(record('searchSummary: Plain words.').searchSummary).toBe(
    'Plain words. A title The page’s own words.',
  );
  expect(record('description: A description.').searchSummary).toMatch(/^A description\. /);
});

test('image is the result’s image, from the site’s root or a URL', () => {
  expect(record('image: /images/a.jpg').thumbnail).toBe('/images/a.jpg');
  expect(record('image: images/a.jpg').thumbnail).toBe('/images/a.jpg');
  expect(record('image: https://example.org/a.jpg').thumbnail).toBe('https://example.org/a.jpg');
  expect(record('"og:image": /images/b.jpg').thumbnail).toBe('/images/b.jpg');
  expect(record('image: /a.jpg\n"og:image": /b.jpg').thumbnail).toBe('/a.jpg');
  expect(record('title: A').thumbnail).toBeUndefined();
});
