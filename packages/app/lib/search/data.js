// What both search runtimes read from a site's `api/` folder, fetched and joined into
// one record per page or work. In the browser only. `search.js` writes the files:
//   index.json                    the index's version and the search settings
//   search-index.json             what each record is found by (title, metadata, summary)
//   search-records.json           what each shows (href, thumbnail, routes by locale)
//   search-index-annotations.json annotation text, when `search.index.annotations` is on
// The three are joined by each record's `id`.

'use strict';

function readBasePath() {
  const normalize = (value) => {
    const raw = typeof value === 'string' ? value.trim() : '';
    if (!raw) return '';
    const withLead = raw.startsWith('/') ? raw : `/${raw}`;
    return withLead.replace(/\/+$/, '');
  };
  try {
    if (typeof window !== 'undefined' && window.CANOPY_BASE_PATH != null) {
      const fromWindow = normalize(window.CANOPY_BASE_PATH);
      if (fromWindow) return fromWindow;
    }
  } catch (_) {}
  try {
    if (typeof globalThis !== 'undefined' && globalThis.CANOPY_BASE_PATH != null) {
      const fromGlobal = normalize(globalThis.CANOPY_BASE_PATH);
      if (fromGlobal) return fromGlobal;
    }
  } catch (_) {}
  return '';
}

// A root-relative href under the site's base path; any other href as it is.
function withBasePath(href) {
  try {
    const raw = typeof href === 'string' ? href.trim() : '';
    if (!raw) return href;
    if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(raw)) return raw;
    if (!raw.startsWith('/')) return raw;
    const base = readBasePath();
    if (!base || base === '/') return raw;
    if (raw === base || raw.startsWith(`${base}/`)) return raw;
    return `${base}${raw}`;
  } catch (_) {
    return href;
  }
}

function apiUrl(pathname) {
  const cleaned = typeof pathname === 'string' ? pathname.replace(/^\/+/, '') : '';
  return `${withBasePath('/api')}/${cleaned}`;
}

function readDocumentLocale() {
  try {
    const lang = document.documentElement && document.documentElement.lang;
    if (lang) return String(lang).trim();
  } catch (_) {}
  return '';
}

// A page written in several languages has a route for each; take the page's own.
function resolveRecordHrefForLocale(record, fallbackHref) {
  const routes = record && record.routes && typeof record.routes === 'object' ? record.routes : null;
  if (!routes) return fallbackHref;
  const docLocale = readDocumentLocale();
  const candidates = [];
  if (docLocale) candidates.push(docLocale);
  if (docLocale && docLocale.includes('-')) {
    const base = docLocale.split('-')[0];
    if (base && base !== docLocale) candidates.push(base);
  }
  if (record && typeof record.locale === 'string') {
    const localeCandidate = record.locale.trim();
    if (localeCandidate && !candidates.includes(localeCandidate)) candidates.push(localeCandidate);
  }
  for (const candidate of candidates) {
    if (!candidate) continue;
    if (routes[candidate]) return routes[candidate];
    const lower = candidate.toLowerCase();
    if (lower !== candidate && routes[lower]) return routes[lower];
  }
  const first = Object.values(routes).find((value) => value);
  return first || fallbackHref;
}

async function sha256Hex(str) {
  try {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
      return Array.from(new Uint8Array(digest))
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');
    }
  } catch (_) {}
  let hash = 5381;
  for (let i = 0; i < str.length; i += 1) hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
  return (hash >>> 0).toString(16);
}

function asRecords(json) {
  if (Array.isArray(json)) return json;
  if (json && Array.isArray(json.records)) return json.records;
  return [];
}

async function fetchJson(url) {
  try {
    const response = await fetch(url);
    if (!response || !response.ok) return null;
    return await response.json();
  } catch (_) {
    return null;
  }
}

async function fetchText(url) {
  try {
    const response = await fetch(url);
    if (!response || !response.ok) return '';
    return await response.text();
  } catch (_) {
    return '';
  }
}

// Resolves to { meta, searchMeta, version, records, annotationCount }. Each record keeps
// its position as `__docIndex`, which the facets' document lists refer to.
async function loadSearchData() {
  const meta = await fetchJson(apiUrl('index.json'));
  let version = meta && typeof meta.version === 'string' ? meta.version : '';
  const searchMeta = (meta && meta.search) || {};
  const annotationsAsset = searchMeta.assets && searchMeta.assets.annotations;
  const annotationsPath =
    annotationsAsset && annotationsAsset.path ? String(annotationsAsset.path).replace(/^\/+/, '') : '';
  const suffix = version ? `?v=${encodeURIComponent(version)}` : '';
  const [indexText, displayJson, annotationsJson] = await Promise.all([
    fetchText(`${apiUrl('search-index.json')}${suffix}`),
    fetchJson(`${apiUrl('search-records.json')}${suffix}`),
    annotationsPath ? fetchJson(`${apiUrl(annotationsPath)}${suffix}`) : Promise.resolve(null),
  ]);
  let parsed = null;
  try {
    parsed = indexText ? JSON.parse(indexText) : null;
  } catch (_) {
    parsed = null;
  }
  const displayRecords = asRecords(displayJson);
  let indexRecords = asRecords(parsed);
  // Without a search index, the display records are all there is to find things by.
  if (!indexRecords.length && displayRecords.length) indexRecords = displayRecords;

  const displayMap = new Map();
  displayRecords.forEach((record) => {
    if (!record || typeof record !== 'object') return;
    const key = record.id ? String(record.id) : record.href ? String(record.href) : '';
    if (key) displayMap.set(key, record);
  });
  const annotationsMap = new Map();
  asRecords(annotationsJson).forEach((record, position) => {
    if (!record || typeof record !== 'object') return;
    const key = record.id ? String(record.id) : String(position);
    const text = record.annotation
      ? String(record.annotation)
      : record.text
      ? String(record.text)
      : '';
    if (key && text) annotationsMap.set(key, text);
  });

  const records = indexRecords.map((record, position) => {
    const key = record && record.id ? String(record.id) : String(position);
    const display = displayMap.get(key) || null;
    const merged = { ...(display || {}), ...(record || {}), __docIndex: position };
    if (!merged.id) merged.id = key;
    const fallbackHref = merged.href || (display && display.href) || '';
    const localeAwareHref = resolveRecordHrefForLocale(display || merged, fallbackHref);
    if (localeAwareHref) merged.href = withBasePath(localeAwareHref);
    else if (fallbackHref) merged.href = withBasePath(fallbackHref);
    if (!merged.title) merged.title = merged.href || '';
    // A page's image is a path from the site's root; a work's, a URL.
    if (typeof merged.thumbnail === 'string' && merged.thumbnail.startsWith('/')) {
      merged.thumbnail = withBasePath(merged.thumbnail);
    }
    if (!Array.isArray(merged.metadata)) {
      merged.metadata = Array.isArray(record && record.metadata) ? record.metadata : [];
    }
    if (annotationsMap.has(key) && !merged.annotation) merged.annotation = annotationsMap.get(key);
    return merged;
  });

  if (!version) version = (parsed && parsed.version) || (await sha256Hex(indexText || ''));
  return { meta, searchMeta, version, records, annotationCount: annotationsMap.size };
}

module.exports = {
  apiUrl,
  loadSearchData,
  readBasePath,
  resolveRecordHrefForLocale,
  withBasePath,
};
