const { fsp, path, OUT_DIR, absoluteUrl, rootRelativeHref } = require('../common');
const { logLine } = require('./log');

const DEFAULT_CHANGEFREQ = 'monthly';
const DEFAULT_PRIORITY = '0.5';
const MAX_URLS_PER_SITEMAP = 1000;
const SITEMAP_INDEX_BASENAME = 'sitemap.xml';

function escapeXml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function normalizeHref(href) {
  if (!href && href !== 0) return '';
  const rel = rootRelativeHref(href);
  if (!rel || rel === '#') return '';
  if (rel.startsWith('?') || rel.startsWith('#')) return '';
  return rel;
}

function collectAbsoluteUrls(iiifRecords, pageRecords) {
  const urls = new Set();
  const push = (href) => {
    const rel = normalizeHref(href);
    if (!rel) return;
    try {
      const abs = absoluteUrl(rel);
      if (abs) urls.add(abs);
    } catch (_) {}
  };
  (Array.isArray(pageRecords) ? pageRecords : []).forEach((page) => {
    if (!page || !page.href) return;
    push(page.href);
  });
  (Array.isArray(iiifRecords) ? iiifRecords : []).forEach((record) => {
    if (!record || !record.href) return;
    push(record.href);
  });
  // Ensure the search page is always present even though it is generated separately
  push('/search/index.html');
  return Array.from(urls.values()).sort((a, b) => a.localeCompare(b));
}

function buildUrlsetXml(urls) {
  const rows = urls.map((loc) => {
    const escapedLoc = escapeXml(loc);
    return [
      '  <url>',
      `    <loc>${escapedLoc}</loc>`,
      `    <changefreq>${DEFAULT_CHANGEFREQ}</changefreq>`,
      `    <priority>${DEFAULT_PRIORITY}</priority>`,
      '  </url>',
    ].join('\n');
  });
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    rows.join('\n'),
    '</urlset>',
    '',
  ].join('\n');
}

function buildSitemapIndexXml(entries) {
  const rows = entries.map((entry) => {
    const escapedLoc = escapeXml(entry.loc);
    return ['  <sitemap>', `    <loc>${escapedLoc}</loc>`, '  </sitemap>'].join('\n');
  });
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    rows.join('\n'),
    '</sitemapindex>',
    '',
  ].join('\n');
}

function chunkList(list, chunkSize) {
  const chunks = [];
  if (!Array.isArray(list) || chunkSize <= 0) return chunks;
  for (let i = 0; i < list.length; i += chunkSize) {
    chunks.push(list.slice(i, i + chunkSize));
  }
  return chunks;
}

async function cleanupLegacySitemaps() {
  let entries;
  try {
    entries = await fsp.readdir(OUT_DIR);
  } catch (_) {
    return;
  }
  const deletions = entries
    .filter((name) => /^sitemap-\d+\.xml$/i.test(name))
    .map((name) =>
      fsp
        .unlink(path.join(OUT_DIR, name))
        .catch(() => {})
    );
  await Promise.all(deletions);
}

async function ensureNoExtensionGuards(fileNames) {
  const guards = new Map();
  (Array.isArray(fileNames) ? fileNames : []).forEach((file) => {
    const raw = typeof file === 'string' ? file.trim() : '';
    if (!raw || !/\.xml$/i.test(raw)) return;
    const base = raw.replace(/\.xml$/i, '');
    if (!base || base === raw) return;
    guards.set(base, raw);
  });

  let entries;
  try {
    entries = await fsp.readdir(OUT_DIR, { withFileTypes: true });
  } catch (_) {
    entries = [];
  }

  const markerName = '.canopy-xml-guard';
  const staleRemovals = [];
  for (const entry of entries) {
    if (!entry || !entry.isDirectory()) continue;
    const dirName = entry.name;
    const dirPath = path.join(OUT_DIR, dirName);
    const markerPath = path.join(dirPath, markerName);
    let hasMarker = false;
    try {
      const stat = await fsp.stat(markerPath);
      hasMarker = stat.isFile();
    } catch (_) {}
    if (!hasMarker) continue;
    if (guards.has(dirName)) {
      guards.delete(dirName);
      continue;
    }
    staleRemovals.push(
      fsp
        .rm(dirPath, { recursive: true, force: true })
        .catch(() => {})
    );
  }
  await Promise.all(staleRemovals);

  if (!guards.size) return;

  const creations = [];
  for (const base of guards.keys()) {
    const dirPath = path.join(OUT_DIR, base);
    const markerPath = path.join(dirPath, markerName);
    creations.push(
      fsp
        .mkdir(dirPath, { recursive: true })
        .then(() => fsp.writeFile(markerPath, '', 'utf8').catch(() => {}))
    );
  }
  await Promise.all(creations);
}

async function writeSitemap(iiifRecords, pageRecords) {
  const urls = collectAbsoluteUrls(iiifRecords, pageRecords);
  if (!urls.length) {
    await cleanupLegacySitemaps();
    await ensureNoExtensionGuards([]);
    logLine('• No URLs to write to sitemap', 'yellow');
    return;
  }
  await cleanupLegacySitemaps();

  const chunks = chunkList(urls, MAX_URLS_PER_SITEMAP);
  const indexEntries = [];
  const writtenFiles = [];
  for (let i = 0; i < chunks.length; i += 1) {
    const fileName = `sitemap-${i + 1}.xml`;
    const dest = path.join(OUT_DIR, fileName);
    await fsp.writeFile(dest, buildUrlsetXml(chunks[i]), 'utf8');
    indexEntries.push({ loc: absoluteUrl(fileName) });
    writtenFiles.push(fileName);
  }

  const indexDest = path.join(OUT_DIR, SITEMAP_INDEX_BASENAME);
  await fsp.writeFile(indexDest, buildSitemapIndexXml(indexEntries), 'utf8');
  writtenFiles.push(SITEMAP_INDEX_BASENAME);
  await ensureNoExtensionGuards(writtenFiles);
  logLine(
    `✓ Wrote sitemap index (${chunks.length} files, ${urls.length} urls total)`,
    'cyan'
  );
}

module.exports = { writeSitemap };
