// This package's name, and the name Canopy 1.x was published under, which sites' own
// files go on importing: `_app.mdx`, layouts, the search result templates, components.
// The MDX API is a contract (AGENTS.md), so wherever the build compiles or bundles a
// site's code it reads either name as this package. `@canopy-iiif/app` is published too,
// each of its entries passing through to this package (`packages/app-alias`), for what
// the build does not read: a site's stylesheet, its own scripts and its package.json.

'use strict';

const PACKAGE_NAME = require('../../package.json').name;
const LEGACY_NAMES = ['@canopy-iiif/app'];
const NAMES = [PACKAGE_NAME, ...LEGACY_NAMES];

const escape = (text) => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
const filterFor = (names) => new RegExp(`^(?:${names.map(escape).join('|')})(?:/|$)`);
const ANY_NAME = filterFor(NAMES);
const LEGACY_NAME = filterFor(LEGACY_NAMES);

function splitSpec(spec) {
  if (typeof spec !== 'string') return null;
  for (const name of NAMES) {
    if (spec === name) return {name, subpath: ''};
    if (spec.startsWith(`${name}/`)) return {name, subpath: spec.slice(name.length)};
  }
  return null;
}

// `@canopy-iiif/app/ui` → `@nulib/canopy/ui`; any other specifier as it is.
function currentSpec(spec) {
  const parts = splitSpec(spec);
  return parts ? `${PACKAGE_NAME}${parts.subpath}` : spec;
}

// As `currentSpec`, with the browser's UI entry read as the server's: a page and its
// components render on the server with the SSR-safe components (`ui/server`).
function serverSpec(spec) {
  const parts = splitSpec(spec);
  if (!parts) return spec;
  return `${PACKAGE_NAME}${parts.subpath === '/ui' ? '/ui/server' : parts.subpath}`;
}

// A recma plugin for `@mdx-js/mdx`: the page's own imports and re-exports of either name,
// as `serverSpec` (or `currentSpec`, with `server: false`) reads them. Only declarations
// are read, never the page's words, so a code example keeps the name it shows.
function recmaPackageImports(options = {}) {
  const read = options.server ? serverSpec : currentSpec;
  return (tree) => {
    for (const node of (tree && tree.body) || []) {
      if (
        !node ||
        (node.type !== 'ImportDeclaration' &&
          node.type !== 'ExportNamedDeclaration' &&
          node.type !== 'ExportAllDeclaration')
      ) {
        continue;
      }
      const source = node.source;
      if (!source || typeof source.value !== 'string') continue;
      const next = read(source.value);
      if (next === source.value) continue;
      source.value = next;
      source.raw = JSON.stringify(next);
    }
  };
}

// esbuild, for the browser: an import of the 1.x name, resolved as this package's.
function esbuildPackageNames() {
  return {
    name: 'canopy-package-names',
    setup(build) {
      build.onResolve({filter: LEGACY_NAME}, async (args) => {
        const result = await build.resolve(currentSpec(args.path), {
          kind: args.kind,
          importer: args.importer,
          resolveDir: args.resolveDir,
        });
        if (result.errors && result.errors.length) return {errors: result.errors};
        return {
          path: result.path,
          external: result.external,
          namespace: result.namespace,
          sideEffects: result.sideEffects,
        };
      });
    },
  };
}

// esbuild, for the server: an import of either name stays an import, for Node to load
// beside the build, as `serverSpec` reads it (or `currentSpec`, with `server: false`: a
// component loaded by its own path has always kept the UI entry it names).
function esbuildServerPackageNames(options = {}) {
  const read = options.server === false ? currentSpec : serverSpec;
  return {
    name: 'canopy-package-names-server',
    setup(build) {
      build.onResolve({filter: ANY_NAME}, (args) => ({path: read(args.path), external: true}));
    },
  };
}

module.exports = {
  PACKAGE_NAME,
  LEGACY_NAMES,
  currentSpec,
  serverSpec,
  recmaPackageImports,
  esbuildPackageNames,
  esbuildServerPackageNames,
};
