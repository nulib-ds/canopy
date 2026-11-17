jest.mock('../packages/app/lib/search/search', () => ({
  writeSearchIndex: jest.fn(async () => {}),
}));

const { buildSearchIndex } = require('../packages/app/lib/build/search-index');
const search = require('../packages/app/lib/search/search');

describe('buildSearchIndex()', () => {
  beforeEach(() => {
    search.writeSearchIndex.mockClear();
  });

  it('merges IIIF and MDX records and preserves page summaries without truncation', async () => {
    const iiifRecords = [
      { id: '1', title: 'Work A', href: 'works/a.html', type: 'work' },
    ];

    const longSummary = 'Lorem ipsum dolor sit amet '.repeat(120).trim();

    const pageRecords = [
      {
        title: 'Getting Started',
        href: 'docs/getting-started.html',
        searchInclude: true,
        searchType: 'docs',
        searchSummary: longSummary,
      },
      {
        title: 'Draft Page',
        href: 'draft.html',
        searchInclude: false,
        searchType: 'page',
        searchSummary: 'should be ignored',
      },
      {
        title: 'With an image',
        href: 'pictured.html',
        searchInclude: true,
        searchType: 'page',
        thumbnail: '/images/pictured.jpg',
      },
    ];

    const combined = await buildSearchIndex(iiifRecords, pageRecords);

    expect(Array.isArray(combined)).toBe(true);
    expect(combined).toHaveLength(3);
    expect(combined.find((r) => r && r.title === 'With an image')).toMatchObject({
      href: '/pictured.html',
      thumbnail: '/images/pictured.jpg',
    });

    const workRecord = combined.find((r) => r && r.type === 'work');
    expect(workRecord).toMatchObject({
      title: 'Work A',
      href: 'works/a.html',
      type: 'work',
    });

    const pageRecord = combined.find((r) => r && r.type === 'docs');
    expect(pageRecord).toMatchObject({
      title: 'Getting Started',
      href: '/docs/getting-started.html',
      type: 'docs',
      summaryValue: longSummary,
    });
    expect(pageRecord.summaryValue.length).toBe(longSummary.length);

    expect(combined.find((r) => r && r.title === 'Draft Page')).toBeUndefined();

    expect(search.writeSearchIndex).toHaveBeenCalledTimes(1);
    expect(search.writeSearchIndex).toHaveBeenCalledWith(combined);
  });
});
