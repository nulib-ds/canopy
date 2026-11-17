// How the search runtimes are bundled: FlexSearch's compact build in place of the
// package's default, its full bundle. The compact build has the Index, the Encoder, and
// export and import for the IndexedDB cache, at 10.7 KB gzipped against 17.6; the light
// build (4.5 KB) has no export. FlexSearch's `exports` map does not name its other
// builds, so this resolves the file beside its main one, which `~0.8.212` keeps in place.

'use strict';

const path = require('path');

function resolveFlexSearchCompact() {
  const main = require.resolve('flexsearch');
  return path.join(path.dirname(main), 'flexsearch.compact.module.min.js');
}

function flexSearchPlugin() {
  return {
    name: 'canopy-flexsearch-compact',
    setup(build) {
      build.onResolve({ filter: /^flexsearch$/ }, () => ({ path: resolveFlexSearchCompact() }));
    },
  };
}

module.exports = { flexSearchPlugin, resolveFlexSearchCompact };
