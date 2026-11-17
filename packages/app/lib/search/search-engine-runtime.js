// The search engine for the header's suggestions, as `site/scripts/canopy-search-engine.js`.
// `search-form-runtime.js` loads it the first time a visitor searches from the header, so
// no page pays for FlexSearch or the index until then. The search page bundles the same
// modules into its own runtime (`search-app.jsx`).
//
//   window.CanopySearchEngine.open() resolves to { records, search(query, limit) }, the
//   records the query finds, best first.

'use strict';

const FlexSearch = require('flexsearch');
const { createEngine } = require('./engine');
const { loadSearchData } = require('./data');
const { openIndex } = require('./index-cache');

let opened = null;

function open() {
  if (!opened) {
    opened = (async () => {
      const engine = createEngine(FlexSearch);
      const { records, version } = await loadSearchData();
      const { index } = await openIndex({ engine, records, version });
      return {
        records,
        search(query, limit) {
          return engine
            .search(index, query, limit)
            .map((position) => records[position])
            .filter(Boolean);
        },
      };
    })();
    // A failure (offline, say) is tried again the next time.
    opened.catch(() => {
      opened = null;
    });
  }
  return opened;
}

if (typeof window !== 'undefined') window.CanopySearchEngine = { open };

module.exports = { open };
