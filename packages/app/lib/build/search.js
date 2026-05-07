const { fs, fsp, path, OUT_DIR, ensureDirSync, absoluteUrl } = require('../common');
const slugify = require('slugify');

function normalizeMetadataLabel(label) {
  if (typeof label !== 'string') return '';
  return label
    .trim()
    .replace(/[:\s]+$/g, '')
    .toLowerCase();
}

function firstI18nString(x) {
  if (!x) return '';
  if (typeof x === 'string') return x;
  try {
    const keys = Object.keys(x || {});
    if (!keys.length) return '';
    const arr = x[keys[0]];
    if (Array.isArray(arr) && arr.length) return String(arr[0]);
  } catch (_) {}
  return '';
}

async function buildFacetsForWorks(combined, labelWhitelist) {
  const facetsDir = path.resolve('.cache/iiif');
  ensureDirSync(facetsDir);
  const map = new Map(); // label -> Map(value -> Set(docIdx))
  const normalizedLabels = new Set(
    (Array.isArray(labelWhitelist) ? labelWhitelist : [])
      .map((label) => normalizeMetadataLabel(String(label || '')))
      .filter(Boolean)
  );
  if (!Array.isArray(combined)) combined = [];
  for (let i = 0; i < combined.length; i++) {
    const rec = combined[i];
    if (!rec || String(rec.type) !== 'work') continue;
    const href = String(rec.href || '');
    const normalizedHref = href.replace(/^\/+/, '');
    const m = normalizedHref.match(/^works\/(.+)\.html$/i);
    if (!m) continue;
    const slug = m[1];
    const p = path.resolve('.cache/iiif/manifests', slug + '.json');
    if (!fs.existsSync(p)) continue;
    let manifest = null;
    try { manifest = JSON.parse(fs.readFileSync(p, 'utf8')); } catch (_) { manifest = null; }
    const meta = Array.isArray(manifest && manifest.metadata) ? manifest.metadata : [];
    for (const entry of meta) {
      if (!entry) continue;
      const label = firstI18nString(entry.label);
      const valueRaw = entry.value && (typeof entry.value === 'string' ? entry.value : firstI18nString(entry.value));
      if (!label || !valueRaw) continue;
      if (
        normalizedLabels.size &&
        !normalizedLabels.has(normalizeMetadataLabel(label))
      ) {
        continue; // only configured labels
      }
      const values = [];
      try {
        if (typeof entry.value === 'string') values.push(entry.value);
        else {
          const obj = entry.value || {};
          for (const k of Object.keys(obj)) {
            const arr = Array.isArray(obj[k]) ? obj[k] : [];
            for (const v of arr) if (v) values.push(String(v));
          }
        }
      } catch (_) { values.push(valueRaw); }
      if (!map.has(label)) map.set(label, new Map());
      const vmap = map.get(label);
      for (const v of values) {
        const key = String(v);
        if (!vmap.has(key)) vmap.set(key, new Set());
        vmap.get(key).add(i); // doc index in combined
      }
    }
  }
  const out = [];
  for (const [label, vmap] of map.entries()) {
    const labelSlug = slugify(label || 'label', { lower: true, strict: true, trim: true });
    const values = [];
    for (const [value, set] of vmap.entries()) {
      const docs = Array.from(set.values()).sort((a, b) => a - b);
      values.push({ value, slug: slugify(value || 'value', { lower: true, strict: true, trim: true }), doc_count: docs.length, docs });
    }
    values.sort((a, b) => b.doc_count - a.doc_count || String(a.value).localeCompare(String(b.value)));
    out.push({ label, slug: labelSlug, values });
  }
  out.sort((a, b) => String(a.label).localeCompare(String(b.label)));
  const dest = path.join(facetsDir, 'facets.json');
  await fsp.writeFile(dest, JSON.stringify(out, null, 2), 'utf8');
}

async function writeFacetCollections(labelWhitelist, combined) {
  const facetsPath = path.resolve('.cache/iiif/facets.json');
  if (!fs.existsSync(facetsPath)) return;
  let facets = [];
  try { facets = JSON.parse(fs.readFileSync(facetsPath, 'utf8')) || []; } catch (_) { facets = []; }
  const normalizedLabels = new Set(
    (Array.isArray(labelWhitelist) ? labelWhitelist : [])
      .map((label) => normalizeMetadataLabel(String(label || '')))
      .filter(Boolean)
  );
  const apiRoot = path.join(OUT_DIR, 'api');
  const facetRoot = path.join(apiRoot, 'facet');
  ensureDirSync(facetRoot);
  const list = (Array.isArray(facets) ? facets : []).filter((f) => {
    if (!normalizedLabels.size) return true;
    const normalized = normalizeMetadataLabel(String((f && f.label) || ''));
    return normalized ? normalizedLabels.has(normalized) : false;
  });
  const labelIndexItems = [];
  for (const f of list) {
    if (!f || !f.label || !Array.isArray(f.values)) continue;
    const label = String(f.label);
    const labelSlug = slugify(label || 'label', { lower: true, strict: true, trim: true });
    const labelDir = path.join(facetRoot, labelSlug);
    ensureDirSync(labelDir);
    for (const v of f.values) {
      if (!v || typeof v !== 'object') continue;
      const value = String(v.value || '');
      const valueSlug = slugify(value || 'value', { lower: true, strict: true, trim: true });
      const dest = path.join(labelDir, valueSlug + '.json');
      const docIdxs = Array.isArray(v.docs) ? v.docs : [];
      const items = [];
      for (const idx of docIdxs) {
        const rec = combined && Array.isArray(combined) ? combined[idx] : null;
        if (!rec || String(rec.type) !== 'work') continue;
        const id = String(rec.id || '');
        const title = String(rec.title || rec.href || '');
        const thumb = String(rec.thumbnail || '');
        const href = String(rec.href || '');
        const homepageId = absoluteUrl('/' + href.replace(/^\/?/, ''));
        const item = { id, type: 'Manifest', label: { none: [title] } };
        if (thumb) item.thumbnail = [{ id: thumb, type: 'Image' }];
        item.homepage = [{ id: homepageId, type: 'Text', label: { none: [title] } }];
        items.push(item);
      }
      const selfId = absoluteUrl(`/api/facet/${labelSlug}/${valueSlug}.json`);
      const parentId = absoluteUrl(`/api/facet/${labelSlug}.json`);
      const homepage = absoluteUrl(`/search/index.html?${encodeURIComponent(labelSlug)}=${encodeURIComponent(valueSlug)}`);
      const col = {
        '@context': 'https://iiif.io/api/presentation/3/context.json',
        id: selfId,
        type: 'Collection',
        label: { none: [value] },
        items,
        partOf: [{ id: parentId, type: 'Collection' }],
        summary: { none: [label] },
        homepage: [{ id: homepage, type: 'Text', label: { none: [value] } }],
      };
      await fsp.writeFile(dest, JSON.stringify(col, null, 2), 'utf8');
    }
    const labelIndexDest = path.join(facetRoot, labelSlug + '.json');
    const labelItems = (f.values || []).map((v) => ({
      id: absoluteUrl(`/api/facet/${labelSlug}/${slugify(String(v && v.value || ''), { lower: true, strict: true, trim: true })}.json`),
      type: 'Collection',
      label: { none: [String(v && v.value || '')] },
      summary: { none: [label] },
    }));
    const labelIndex = {
      '@context': 'https://iiif.io/api/presentation/3/context.json',
      id: absoluteUrl(`/api/facet/${labelSlug}.json`),
      type: 'Collection',
      label: { none: [label] },
      items: labelItems,
    };
    await fsp.writeFile(labelIndexDest, JSON.stringify(labelIndex, null, 2), 'utf8');
    labelIndexItems.push({ id: absoluteUrl(`/api/facet/${labelSlug}.json`), type: 'Collection', label: { none: [label] } });
  }
  const facetIndex = {
    '@context': 'https://iiif.io/api/presentation/3/context.json',
    id: absoluteUrl('/api/facet/index.json'),
    type: 'Collection',
    label: { none: ['Facets'] },
    items: labelIndexItems,
  };
  await fsp.writeFile(path.join(facetRoot, 'index.json'), JSON.stringify(facetIndex, null, 2), 'utf8');
}

async function writeFacetsSearchApi() {
  const src = path.resolve('.cache/iiif/facets.json');
  if (!fs.existsSync(src)) return;
  let data = null;
  try { data = JSON.parse(fs.readFileSync(src, 'utf8')); } catch (_) { data = null; }
  if (!data) return;
  const destDir = path.join(OUT_DIR, 'api', 'search');
  ensureDirSync(destDir);
  const dest = path.join(destDir, 'facets.json');
  await fsp.writeFile(dest, JSON.stringify(data, null, 2), 'utf8');
}

async function collectMdxPageRecords() {
  const { fs, fsp, path, CONTENT_DIR, rootRelativeHref } = require('../common');
  const mdx = require('./mdx');
  const pagesHelpers = require('./pages');
  const pages = [];
  async function walk(dir) {
    const entries = await fsp.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) await walk(p);
      else if (e.isFile() && /\.mdx$/i.test(p) && !mdx.isReservedFile(p)) {
        const base = path.basename(p).toLowerCase();
        const src = await fsp.readFile(p, 'utf8');
        const fm = mdx.parseFrontmatter(src);
        const titleRaw = mdx.extractTitle(src);
        const title = typeof titleRaw === 'string' ? titleRaw.trim() : '';
        const rel = path.relative(CONTENT_DIR, p).replace(/\.mdx$/i, '.html');
        if (base !== 'sitemap.mdx') {
          const href = rootRelativeHref(rel.split(path.sep).join('/'));
          const plainText = mdx.extractPlainText(src);
          const markdownSummary = mdx.extractMarkdownSummary(src);
          const summary = plainText || '';
          const underSearch = /^search\//i.test(href) || href.toLowerCase() === 'search.html';
          let include = !underSearch;
          let resolvedType = null;
          const pageFm = fm && fm.data ? fm.data : null;
          if (pageFm && pageFm.search === false) include = false;
          if (include && pageFm && Object.prototype.hasOwnProperty.call(pageFm, 'type')) {
            if (pageFm.type) resolvedType = String(pageFm.type);
            else include = false;
          }
          if (include && !resolvedType) {
            const layoutMeta = await pagesHelpers.getNearestDirLayoutMeta(p);
            if (layoutMeta && layoutMeta.type) resolvedType = String(layoutMeta.type);
          }
          if (include && !resolvedType) {
            resolvedType = 'page';
          }
          const trimmedType = resolvedType && String(resolvedType).trim();
          pages.push({
            title,
            href,
            searchInclude: include && !!trimmedType,
            searchType: trimmedType || undefined,
            searchSummary: summary,
            searchSummaryMarkdown: markdownSummary,
          });
        }
      }
    }
  }
  await walk(CONTENT_DIR);
  return pages;
}


module.exports = { buildFacetsForWorks, writeFacetCollections, writeFacetsSearchApi, collectMdxPageRecords };
