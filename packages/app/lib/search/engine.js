// The search engine both of Canopy's search runtimes use: the search page's
// (`search-app.jsx`) and the header's suggestions (`search-engine-runtime.js`, loaded by
// `search-form-runtime.js`). It is the one place that knows FlexSearch, so a change of
// engine, or of how words are matched, is a change to this file, and the relevance
// tests (`tests/unit/search/engine.test.js`) show what it changes.
//
// FlexSearch is passed in rather than required here: the browser bundles hand it the
// compact build (`bundle.js`), and Node and the tests the package's own.

'use strict';

// The cached index in a visitor's IndexedDB is keyed by this and the index's version
// (`index-cache.js`), so an index another engine, or these settings before a change,
// wrote is never read back. Change it whenever an option below changes.
const ENGINE_ID = 'flexsearch-0.8:forward:normalize';

// What a record is found by: its title first, as FlexSearch scores a match higher the
// earlier in the text it falls, then its metadata, summary and annotation.
function searchText(record) {
  if (!record || typeof record !== 'object') return '';
  const parts = [];
  if (record.title) parts.push(String(record.title));
  const metadata = Array.isArray(record.metadata) ? record.metadata : [];
  for (const value of metadata) {
    if (value) parts.push(String(value));
  }
  if (record.summary) parts.push(String(record.summary));
  if (record.annotation) parts.push(String(record.annotation));
  return parts.join(' ').trim();
}

function createEngine(FlexSearch) {
  const flex = FlexSearch && FlexSearch.Index ? FlexSearch : FlexSearch && FlexSearch.default;
  if (!flex || typeof flex.Index !== 'function' || typeof flex.Encoder !== 'function') {
    throw new Error('Canopy search: FlexSearch 0.8 did not load.');
  }

  // A word is found by its beginning ("manu" finds "manuscript"), in any case, with or
  // without its accents ("Haridwar" finds "Haridwār", and the other way). Every word of a
  // query must be found. FlexSearch's default encoder would also collapse repeated
  // letters and split numbers in threes, so that "iiif" found "if" and "1800" found
  // "1805": both are off.
  function createIndex() {
    return new flex.Index({
      tokenize: 'forward',
      encoder: new flex.Encoder({ normalize: true, dedupe: false, numeric: false }),
    });
  }

  // Each record is added by its position in `records`, which is what `search` returns.
  function buildIndex(records) {
    const index = createIndex();
    (Array.isArray(records) ? records : []).forEach((record, position) => {
      const text = searchText(record);
      if (text) index.add(position, text);
    });
    return index;
  }

  function search(index, query, limit = 200) {
    const text = typeof query === 'string' ? query.trim() : '';
    if (!index || !text) return [];
    const hits = index.search(text, { limit });
    return Array.isArray(hits) ? hits : [];
  }

  async function exportIndex(index) {
    const data = {};
    await index.export((key, value) => {
      data[key] = value;
    });
    return data;
  }

  async function importIndex(data) {
    const index = createIndex();
    for (const key of Object.keys(data || {})) {
      await index.import(key, data[key]);
    }
    return index;
  }

  return { id: ENGINE_ID, createIndex, buildIndex, search, exportIndex, importIndex };
}

module.exports = { ENGINE_ID, searchText, createEngine };
