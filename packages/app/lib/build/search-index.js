
const { logLine } = require('./log');
const { rootRelativeHref, buildRouteRelativePath, getDefaultRoute } = require('../common');

function pagesToRecords(pageRecords) {
  const list = Array.isArray(pageRecords) ? pageRecords : [];
  return list
    .filter((p) => p && p.href && p.searchInclude)
    .map((p) => {
      const summary = typeof p.searchSummary === 'string' ? p.searchSummary.trim() : '';
      const summaryMarkdown =
        typeof p.searchSummaryMarkdown === 'string'
          ? p.searchSummaryMarkdown.trim()
          : '';
      const record = {
        title: p.title || p.href,
        href: rootRelativeHref(p.href),
        type: p.searchType || 'page',
      };
      if (summary) record.summaryValue = summary;
      if (summaryMarkdown) record.summaryMarkdown = summaryMarkdown;
      if (typeof p.thumbnail === 'string' && p.thumbnail.trim()) record.thumbnail = p.thumbnail.trim();
      return record;
    });
}

function maybeMockRecords() {
  if (process.env.CANOPY_MOCK_SEARCH !== '1') return null;
  const mock = [];
  const svg = encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="#dbeafe"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="Arial" font-size="24" fill="#1d4ed8">Mock</text></svg>');
  const thumb = `data:image/svg+xml;charset=utf-8,${svg}`;
  for (let i = 1; i <= 120; i++) {
    const rel = buildRouteRelativePath(getDefaultRoute('works'), `mock-${i}.html`);
    mock.push({ title: `Mock Work #${i}`, href: rootRelativeHref(rel), type: 'work', thumbnail: thumb });
  }
  mock.push({ title: 'Mock Doc A', href: rootRelativeHref('getting-started/index.html'), type: 'docs' });
  mock.push({ title: 'Mock Doc B', href: rootRelativeHref('getting-started/example.html'), type: 'docs' });
  mock.push({ title: 'Mock Page', href: rootRelativeHref('index.html'), type: 'page' });
  return mock;
}

async function buildSearchIndex(iiifRecords, pageRecords) {
  const search = require('../search/search');
  const iiif = Array.isArray(iiifRecords) ? iiifRecords : [];
  const mdx = pagesToRecords(pageRecords);
  let combined = [...iiif, ...mdx];
  const mock = maybeMockRecords();
  if (mock) combined = mock;
  try { logLine(`• Building search index (${combined.length})...`, 'blue'); } catch (_) {}
  await search.writeSearchIndex(combined);
  try { logLine('✓ Search index built', 'cyan'); } catch (_) {}
  return combined;
}

module.exports = { buildSearchIndex };
