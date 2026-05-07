const React = require('react');
const ReactDOMServer = require('react-dom/server');
const crypto = require('crypto');
const {
  fs,
  fsp,
  path,
  CONTENT_DIR,
  rootRelativeHref,
  ensureDirSync,
  OUT_DIR,
  htmlShell,
  canopyBodyClassForType,
  readSearchPageMetadata,
  resolveLocaleFromHref,
  getLocaleRouteEntries,
  getDefaultRoute,
  getDefaultLocaleCode,
  getSiteTitle,
} = require('../common');
const {buildLocaleRuntimeScript} = require('../locales');
const { resolveCanopyConfigPath } = require('../config-path');

const SEARCH_TEMPLATES_ALIAS = '__CANOPY_SEARCH_RESULT_TEMPLATES__';
const SEARCH_TEMPLATES_CACHE_DIR = path.resolve('.cache/search');
const SEARCH_TEMPLATE_FILES = [
  { key: 'figure', filename: '_result-figure.mdx' },
  { key: 'article', filename: '_result-article.mdx' },
];

function resolveSearchTemplatePath(filename) {
  try {
    const candidate = path.join(CONTENT_DIR, 'search', filename);
    if (fs.existsSync(candidate)) return candidate;
  } catch (_) {}
  return null;
}

async function buildSearchTemplatesModule() {
  ensureDirSync(SEARCH_TEMPLATES_CACHE_DIR);
  const outPath = path.join(SEARCH_TEMPLATES_CACHE_DIR, 'result-templates-entry.js');
  const fallback = resolveSearchTemplatePath('_result.mdx');
  const lines = [
    '// Auto-generated search result templates map',
  ];
  for (const spec of SEARCH_TEMPLATE_FILES) {
    const templateName = `${spec.key}Template`;
    const specific = resolveSearchTemplatePath(spec.filename);
    const resolved = specific || fallback;
    if (resolved) {
      lines.push(`import ${templateName} from ${JSON.stringify(resolved)};`);
    } else {
      lines.push(`const ${templateName} = null;`);
    }
    lines.push(`export const ${spec.key} = ${templateName};`);
  }
  lines.push(`export default { ${SEARCH_TEMPLATE_FILES.map((spec) => spec.key).join(', ')} };`);
  await fsp.writeFile(outPath, lines.join('\n'), 'utf8');
  return outPath;
}

function createResultTemplatesAliasPlugin(entryPath) {
  return {
    name: 'canopy-search-result-templates',
    setup(build) {
      build.onResolve({ filter: new RegExp(`^${SEARCH_TEMPLATES_ALIAS.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) }, () => ({
        path: entryPath,
      }));
    },
  };
}

function createSearchMdxPlugin() {
  return {
    name: 'canopy-search-mdx',
    setup(build) {
      build.onResolve({ filter: /\.mdx$/ }, (args) => ({
        path: path.resolve(args.resolveDir, args.path),
        namespace: 'canopy-search-mdx',
      }));
      build.onLoad({ filter: /.*/, namespace: 'canopy-search-mdx' }, async (args) => {
        const { compile } = await import('@mdx-js/mdx');
        const source = await fsp.readFile(args.path, 'utf8');
        const compiled = await compile(source, {
          jsx: true,
          development: false,
          providerImportSource: '@mdx-js/react',
          format: 'mdx',
        });
        return {
          contents: String(compiled),
          loader: 'jsx',
          resolveDir: path.dirname(args.path),
        };
      });
    },
  };
}

function getSearchRouteEntries() {
  let entries = getLocaleRouteEntries('search');
  if (!entries.length) {
    entries = [
      {
        locale: getDefaultLocaleCode(),
        route: getDefaultRoute('search'),
        isDefault: true,
      },
    ];
  }
  return entries;
}

function resolveSearchOutputRelative(routeValue) {
  const defaultRoute = getDefaultRoute('search') || 'search';
  const trimmed = typeof routeValue === 'string' ? routeValue.trim().replace(/^\/+|\/+$/g, '') : '';
  return path.join(trimmed || defaultRoute, 'index.html');
}

async function ensureSearchRuntime() {
  ensureDirSync(OUT_DIR);
  let esbuild = null;
  try { esbuild = require('../../ui/node_modules/esbuild'); } catch (_) { try { esbuild = require('esbuild'); } catch (_) {} }
  if (!esbuild) throw new Error('Search runtime bundling requires esbuild. Install dependencies before building.');
  const entry = path.join(__dirname, 'search-app.jsx');
  const scriptsDir = path.join(OUT_DIR, 'scripts');
  ensureDirSync(scriptsDir);
  const outFile = path.join(scriptsDir, 'search.js');
  const templatesEntry = await buildSearchTemplatesModule();
  const templatesPlugin = createResultTemplatesAliasPlugin(templatesEntry);
  const mdxPlugin = createSearchMdxPlugin();
  // Ensure a global React shim is available to reduce search.js size
  try {
    const scriptsDir = path.join(OUT_DIR, 'scripts');
    ensureDirSync(scriptsDir);
    const vendorFile = path.join(scriptsDir, 'react-globals.js');
    const globalsEntry = `
      import React from 'react';
      import * as ReactDOM from 'react-dom';
      import { createRoot, hydrateRoot } from 'react-dom/client';
      (function(){ try{ window.React = React; window.ReactDOM = ReactDOM; window.ReactDOMClient = { createRoot, hydrateRoot }; }catch(e){} })();
    `;
    await esbuild.build({
      stdin: { contents: globalsEntry, resolveDir: process.cwd(), loader: 'js', sourcefile: 'react-globals-entry.js' },
      outfile: vendorFile,
      platform: 'browser',
      format: 'iife',
      bundle: true,
      sourcemap: false,
      target: ['es2018'],
      logLevel: 'silent',
      minify: true,
      define: { 'process.env.NODE_ENV': '"production"' },
    });
    // Build FlexSearch globals shim
    const flexFile = path.join(scriptsDir, 'flexsearch-globals.js');
    const flexEntry = `import Flex from 'flexsearch';(function(){try{window.FlexSearch=Flex;}catch(e){}})();`;
    await esbuild.build({
      stdin: { contents: flexEntry, resolveDir: process.cwd(), loader: 'js', sourcefile: 'flexsearch-globals-entry.js' },
      outfile: flexFile,
      platform: 'browser',
      format: 'iife',
      bundle: true,
      sourcemap: false,
      target: ['es2018'],
      logLevel: 'silent',
      minify: true,
      external: [],
    });
  } catch (_) {}
  const shimReactPlugin = {
    name: 'shim-react-globals',
    setup(build) {
      build.onResolve({ filter: /^react$/ }, () => ({ path: 'react', namespace: 'react-shim' }));
      build.onLoad({ filter: /.*/, namespace: 'react-shim' }, () => ({
        contents: [
          "const R = (typeof window!=='undefined' && window.React) || {};\n",
          "export default R;\n",
          // Common hooks and APIs used by deps
          "export const Children = R.Children;\n",
          "export const Component = R.Component;\n",
          "export const Fragment = R.Fragment;\n",
          "export const createElement = R.createElement;\n",
          "export const cloneElement = R.cloneElement;\n",
          "export const createContext = R.createContext;\n",
          "export const forwardRef = R.forwardRef;\n",
          "export const memo = R.memo;\n",
          "export const startTransition = R.startTransition;\n",
          "export const isValidElement = R.isValidElement;\n",
          "export const useEffect = R.useEffect;\n",
          "export const useLayoutEffect = R.useLayoutEffect;\n",
          "export const useMemo = R.useMemo;\n",
          "export const useState = R.useState;\n",
          "export const useRef = R.useRef;\n",
          "export const useCallback = R.useCallback;\n",
          "export const useContext = R.useContext;\n",
          "export const useReducer = R.useReducer;\n",
          "export const useId = R.useId;\n",
          "export const useSyncExternalStore = R.useSyncExternalStore;\n",
        ].join(''),
        loader: 'js',
      }));
      build.onResolve({ filter: /^react\/jsx-runtime$/ }, () => ({ path: 'react/jsx-runtime', namespace: 'react-jsx-shim' }));
      build.onResolve({ filter: /^react\/jsx-dev-runtime$/ }, () => ({ path: 'react/jsx-dev-runtime', namespace: 'react-jsx-shim' }));
      build.onLoad({ filter: /.*/, namespace: 'react-jsx-shim' }, () => ({
        contents: [
          "const R = (typeof window!=='undefined' && window.React) || {};\n",
          "const Fragment = R.Fragment || 'div';\n",
          "const createElement = typeof R.createElement === 'function' ? R.createElement.bind(R) : null;\n",
          "function normalizeProps(props, key){\n",
          "  if (key !== undefined && key !== null) {\n",
          "    props = props && typeof props === 'object' ? { ...props, key } : { key };\n",
          "  }\n",
          "  return props || {};\n",
          "}\n",
          "function jsx(type, props, key){\n",
          "  if (!createElement) return null;\n",
          "  return createElement(type, normalizeProps(props, key));\n",
          "}\n",
          "const jsxs = jsx;\n",
          "const jsxDEV = jsx;\n",
          "export { jsx, jsxs, jsxDEV, Fragment };\n",
          "export default { jsx, jsxs, jsxDEV, Fragment };\n",
        ].join(''),
        loader: 'js',
      }));
      build.onResolve({ filter: /^react-dom\/client$/ }, () => ({ path: 'react-dom/client', namespace: 'rdc-shim' }));
      build.onLoad({ filter: /.*/, namespace: 'rdc-shim' }, () => ({
        contents: [
          "const C = (typeof window!=='undefined' && window.ReactDOMClient) || {};\n",
          "export const createRoot = C.createRoot;\n",
          "export const hydrateRoot = C.hydrateRoot;\n",
        ].join(''),
        loader: 'js',
      }));
      build.onResolve({ filter: /^react-dom$/ }, () => ({ path: 'react-dom', namespace: 'rd-shim' }));
      build.onLoad({ filter: /.*/, namespace: 'rd-shim' }, () => ({
        contents: "export default (typeof window!=='undefined' && window.ReactDOM) || {};\n",
        loader: 'js',
      }));
      build.onResolve({ filter: /^flexsearch$/ }, () => ({ path: 'flexsearch', namespace: 'flex-shim' }));
      build.onLoad({ filter: /.*/, namespace: 'flex-shim' }, () => ({
        contents: "export default (typeof window!=='undefined' && window.FlexSearch) || {};\n",
        loader: 'js',
      }));
    }
  };
  try {
    const entryExists = (() => { try { return require('fs').existsSync(entry); } catch (_) { return false; } })();
    const commonBuild = {
      outfile: outFile,
      platform: 'browser',
      format: 'iife',
      bundle: true,
      sourcemap: true,
      target: ['es2018'],
      logLevel: 'silent',
      plugins: [shimReactPlugin, templatesPlugin, mdxPlugin],
      external: ['@samvera/clover-iiif/*'],
    };
    if (!entryExists) throw new Error('Search runtime entry missing: ' + entry);
    await esbuild.build({ entryPoints: [entry], ...commonBuild });
  } catch (e) {
    console.error('Search: bundle error:', e && e.message ? e.message : e);
    return;
  }
  try {
    const { logLine } = require('../build/log');
    let size = 0; try { const st = fs.statSync(outFile); size = st.size || 0; } catch (_) {}
    const kb = size ? ` (${(size/1024).toFixed(1)} KB)` : '';
    const rel = path.relative(process.cwd(), outFile).split(path.sep).join('/');
    logLine(`✓ Wrote ${rel}${kb}`, 'cyan');
  } catch (_) {}
}

async function buildSearchPage() {
  for (const entry of getSearchRouteEntries()) {
    await buildSearchPageForEntry(entry);
  }
}

async function buildSearchPageForEntry(routeEntry) {
  try {
    const defaultRoute = getDefaultRoute('search') || 'search';
    const routeBase =
      routeEntry && typeof routeEntry.route === 'string'
        ? routeEntry.route
        : defaultRoute;
    const relativeOutput = resolveSearchOutputRelative(routeBase);
    const outPath = path.join(OUT_DIR, relativeOutput);
    ensureDirSync(path.dirname(outPath));
    const searchLayoutPath = path.join(path.resolve('content'), 'search', '_layout.mdx');
    if (!require('../common').fs.existsSync(searchLayoutPath)) {
      throw new Error('Missing required file: content/search/_layout.mdx');
    }
    const mdx = require('../build/mdx');
    const normalizedRoute = routeBase ? routeBase.replace(/^\/+|\/+$/g, '') : '';
    const fileHref = rootRelativeHref(relativeOutput.split(path.sep).join('/'));
    const prettyHref =
      normalizedRoute && normalizedRoute !== defaultRoute
        ? rootRelativeHref(`${normalizedRoute}/`)
        : fileHref;
    const searchPageMeta = readSearchPageMetadata() || {};
    const pageTitle =
      typeof searchPageMeta.title === 'string' && searchPageMeta.title.trim()
        ? searchPageMeta.title.trim()
        : 'Search';
    const pageDescription =
      typeof searchPageMeta.description === 'string'
        ? searchPageMeta.description
        : '';
    const siteTitle = typeof getSiteTitle === 'function' ? getSiteTitle() : '';
    const pageDetails = {
      title: pageTitle,
      description: pageDescription,
      href: prettyHref,
      url: prettyHref,
      type: 'search',
      canonical: prettyHref,
      meta: {
        title: pageTitle,
        description: pageDescription,
        type: 'search',
        url: prettyHref,
        canonical: prettyHref,
      },
    };
    const fallbackLocale = resolveLocaleFromHref(prettyHref);
    const pageLocale =
      (routeEntry && routeEntry.locale) ||
      fallbackLocale ||
      getDefaultLocaleCode();
    pageDetails.locale = pageLocale;
    if (pageDetails.meta) pageDetails.meta.locale = pageLocale;
    const rendered = await mdx.compileMdxFile(searchLayoutPath, outPath, null, {
      page: pageDetails,
    });
    const body = rendered && rendered.body ? rendered.body : '';
    const head = rendered && rendered.head ? rendered.head : '';
    if (!body) throw new Error('Search: content/search/_layout.mdx produced empty output');
    const importMap = '';
    const jsAbs = path.join(OUT_DIR, 'scripts', 'search.js');
    let jsRel = path.relative(path.dirname(outPath), jsAbs).split(path.sep).join('/');
    let v = '';
    try { const st = require('fs').statSync(jsAbs); v = `?v=${Math.floor(st.mtimeMs || Date.now())}`; } catch (_) {}
    jsRel = jsRel + v;
    const vendorReactAbs = path.join(OUT_DIR, 'scripts', 'react-globals.js');
    const vendorFlexAbs = path.join(OUT_DIR, 'scripts', 'flexsearch-globals.js');
    const vendorSearchFormAbs = path.join(OUT_DIR, 'scripts', 'canopy-search-form.js');
    function verRel(abs) {
      let rel = path.relative(path.dirname(outPath), abs).split(path.sep).join('/');
      try { const st = require('fs').statSync(abs); rel += `?v=${Math.floor(st.mtimeMs || Date.now())}`; } catch (_) {}
      return rel;
    }
    const vendorTags = `<script src="${verRel(vendorReactAbs)}"></script><script src="${verRel(vendorFlexAbs)}"></script><script src="${verRel(vendorSearchFormAbs)}"></script>`;
    let customRuntimeTag = '';
    if (body && body.indexOf('data-canopy-client-component') !== -1) {
      try {
        await mdx.ensureCustomClientRuntime();
        const runtimeAbs = path.join(OUT_DIR, 'scripts', 'canopy-custom-components.js');
        let rel = path.relative(path.dirname(outPath), runtimeAbs).split(path.sep).join('/');
        try { const st = require('fs').statSync(runtimeAbs); rel += `?v=${Math.floor(st.mtimeMs || Date.now())}`; } catch (_) {}
        customRuntimeTag = `<script type="module" src="${rel}"></script>`;
      } catch (e) {
        console.warn('[search] failed to build custom client runtime:', e && (e.message || e));
      }
    }
    let headExtra = vendorTags + head + importMap + customRuntimeTag;
    try {
      const localeScript = buildLocaleRuntimeScript(pageLocale);
      if (localeScript) headExtra = localeScript + headExtra;
    } catch (_) {}
    if (siteTitle && typeof siteTitle === 'string') {
      const siteTitleScript = `<script>window.CANOPY_SITE_TITLE=${JSON.stringify(siteTitle)}</script>`;
      headExtra = siteTitleScript + headExtra;
    }
    try {
      const { BASE_PATH } = require('../common');
      if (BASE_PATH) {
        headExtra = `<script>window.CANOPY_BASE_PATH=${JSON.stringify(BASE_PATH)}</script>` + headExtra;
      }
    } catch (_) {}
    const bodyClass = canopyBodyClassForType('search');
    let html = htmlShell({ title: pageTitle, body, cssHref: null, scriptHref: jsRel, headExtra, bodyClass, lang: pageLocale });
    try { html = require('../common').applyBaseToHtml(html); } catch (_) {}
    await fsp.writeFile(outPath, html, 'utf8');
    console.log('Search: Built', path.relative(process.cwd(), outPath));
  } catch (e) {
    console.warn('Search: Failed to build page', e && (e.message || e));
    throw e;
  }
}

function toSafeString(val, defaultValue = '') {
  try { return String(val == null ? defaultValue : val); } catch (_) { return defaultValue; }
}

function sanitizeMetadataValues(list) {
  const arr = Array.isArray(list) ? list : [];
  const out = [];
  const seen = new Set();
  for (const val of arr) {
    if (val && typeof val === 'object' && Array.isArray(val.values)) {
      for (const v of val.values) {
        const str = toSafeString(v, '').trim();
        if (!str) continue;
        const clipped = str.length > 500 ? str.slice(0, 500) + '…' : str;
        if (seen.has(clipped)) continue;
        seen.add(clipped);
        out.push(clipped);
      }
      continue;
    }
    const str = toSafeString(val, '').trim();
    if (!str) continue;
    const clipped = str.length > 500 ? str.slice(0, 500) + '…' : str;
    if (seen.has(clipped)) continue;
    seen.add(clipped);
    out.push(clipped);
  }
  return out;
}

function sanitizeRecordForIndex(r) {
  const title = toSafeString(r && r.title, '');
  const type = toSafeString(r && r.type, 'page');
  const safeTitle = title.length > 300 ? title.slice(0, 300) + '…' : title;
  const out = { title: safeTitle, type };
  const metadataSource =
    (r && r.metadataValues) ||
    (r && r.searchMetadataValues) ||
    (r && r.search && r.search.metadata) ||
    [];
  const metadata = sanitizeMetadataValues(metadataSource);
  if (metadata.length) out.metadata = metadata;
  const summaryVal = toSafeString(
    (r && r.summaryValue) ||
      (r && r.searchSummary) ||
      (r && r.search && r.search.summary),
    ''
  ).trim();
  if (summaryVal) {
    out.summary = summaryVal;
  }
  return out;
}

function sanitizeRecordForDisplay(r) {
  const base = sanitizeRecordForIndex(r);
  const out = { ...base };
  if (out.metadata) delete out.metadata;
  if (out.summary) out.summary = toSafeString(out.summary, '');
  const locale = toSafeString(r && r.locale, '').trim();
  if (locale) out.locale = locale;
  if (r && r.routes && typeof r.routes === 'object') {
    const normalizedRoutes = {};
    Object.keys(r.routes).forEach((key) => {
      const routeHref = toSafeString(r.routes[key], '');
      if (!routeHref) return;
      normalizedRoutes[key] = rootRelativeHref(routeHref);
    });
    if (Object.keys(normalizedRoutes).length) out.routes = normalizedRoutes;
  }
  const summaryMarkdown = toSafeString(
    (r && r.summaryMarkdown) ||
      (r && r.searchSummaryMarkdown) ||
      (r && r.search && r.search.summaryMarkdown),
    ''
  ).trim();
  if (summaryMarkdown) {
    out.summaryMarkdown = summaryMarkdown;
  }
  const hrefRaw = toSafeString(r && r.href, '');
  if (hrefRaw) {
    out.href = rootRelativeHref(hrefRaw);
  }
  const thumbnail = toSafeString(r && r.thumbnail, '');
  if (thumbnail) out.thumbnail = thumbnail;
  // Preserve optional thumbnail dimensions for aspect ratio calculations in the UI
  try {
    const tw = Number(r && r.thumbnailWidth);
    const th = Number(r && r.thumbnailHeight);
    if (Number.isFinite(tw) && tw > 0) out.thumbnailWidth = tw;
    if (Number.isFinite(th) && th > 0) out.thumbnailHeight = th;
  } catch (_) {}
  return out;
}

/**
 * Write search datasets consumed by the runtime layers.
 *
 * Outputs:
 * - search-index.json: compact payload (title/href/type/metadata + stable id) for FlexSearch
 * - search-records.json: richer display data (thumbnail/dimensions + id) for UI rendering
 */
async function writeSearchIndex(records) {
  const apiDir = path.join(OUT_DIR, 'api');
  ensureDirSync(apiDir);
  const idxPath = path.join(apiDir, 'search-index.json');
  const list = Array.isArray(records) ? records : [];
  const indexRecords = list.map(sanitizeRecordForIndex);
  const displayRecords = list.map(sanitizeRecordForDisplay);
  for (let i = 0; i < indexRecords.length; i += 1) {
    const id = String(i);
    if (indexRecords[i]) indexRecords[i].id = id;
    if (displayRecords[i]) displayRecords[i].id = id;
    if (displayRecords[i] && !displayRecords[i].href) {
      const original = list[i];
      const href = original && original.href ? rootRelativeHref(String(original.href)) : '';
      if (href) displayRecords[i].href = href;
    }
  }
  const annotationsPath = path.join(apiDir, 'search-index-annotations.json');
  const annotationRecords = [];
  for (let i = 0; i < list.length; i += 1) {
    const raw = list[i];
    const annotationVal = toSafeString(
      (raw && raw.annotationValue) ||
        (raw && raw.searchAnnotation) ||
        (raw && raw.search && raw.search.annotation),
      ''
    ).trim();
    if (!annotationVal) continue;
    annotationRecords.push({ id: String(i), annotation: annotationVal });
  }

  const indexJson = JSON.stringify(indexRecords);
  const approxBytes = Buffer.byteLength(indexJson, 'utf8');
  if (approxBytes > 10 * 1024 * 1024) {
    console.warn('Search: index size is large (', Math.round(approxBytes / (1024 * 1024)), 'MB ). Consider narrowing sources.');
  }
  await fsp.writeFile(idxPath, indexJson, 'utf8');
  try {
    const { logLine } = require('./log');
    const approxKb = Math.round(approxBytes / 1024);
    logLine(
      `• search-index.json written (${indexRecords.length} records, ${approxKb} KB)`,
      'blue',
      { dim: true }
    );
  } catch (_) {}

  const displayPath = path.join(apiDir, 'search-records.json');
  const displayJson = JSON.stringify(displayRecords);
  const displayBytes = Buffer.byteLength(displayJson, 'utf8');
  await fsp.writeFile(displayPath, displayJson, 'utf8');
  try {
    const { logLine } = require('./log');
    const approxKb = Math.round(displayBytes / 1024);
    logLine(
      `• search-records.json written (${displayRecords.length} entries, ${approxKb} KB)`,
      'blue',
      { dim: true }
    );
  } catch (_) {}
  let annotationsBytes = 0;
  if (annotationRecords.length) {
    const annotationsJson = JSON.stringify(annotationRecords);
    annotationsBytes = Buffer.byteLength(annotationsJson, 'utf8');
    await fsp.writeFile(annotationsPath, annotationsJson, 'utf8');
    try {
      const { logLine } = require('./log');
      const approxKb = Math.round(annotationsBytes / 1024);
      logLine(
        `• search-index-annotations.json written (${annotationRecords.length} entries, ${approxKb} KB)`,
        'blue',
        { dim: true }
      );
    } catch (_) {}
  } else {
    try {
      if (fs.existsSync(annotationsPath)) await fsp.unlink(annotationsPath);
    } catch (_) {}
  }
  // Also write a small metadata file with a stable version hash for cache-busting and IDB keying
  try {
    const version = crypto.createHash('sha256').update(indexJson).digest('hex');
    // Read optional search configuration from canopy.yml
    let tabsOrder = [];
    let resultsConfigEntries = [];
    try {
      const yaml = require('js-yaml');
      const cfgPath = resolveCanopyConfigPath();
      if (fs.existsSync(cfgPath)) {
        const raw = fs.readFileSync(cfgPath, 'utf8');
        const data = yaml.load(raw) || {};
        const searchCfg = data && data.search ? data.search : {};
        const tabs = searchCfg && searchCfg.tabs ? searchCfg.tabs : {};
        const order = Array.isArray(tabs && tabs.order) ? tabs.order : [];
        tabsOrder = order
          .map((s) => String(s).trim().toLowerCase())
          .filter(Boolean);
        const resultsCfg =
          searchCfg && searchCfg.results && typeof searchCfg.results === 'object'
            ? searchCfg.results
            : null;
        if (resultsCfg) {
          const entries = [];
          Object.keys(resultsCfg).forEach((key) => {
            if (!key) return;
            const type = String(key).trim().toLowerCase();
            if (!type) return;
            if (entries.find((entry) => entry.type === type)) return;
            const cfg = resultsCfg[key] && typeof resultsCfg[key] === 'object' ? resultsCfg[key] : {};
            const layoutRaw = cfg && cfg.layout ? String(cfg.layout).toLowerCase() : '';
            const resultRaw = cfg && cfg.result ? String(cfg.result).toLowerCase() : '';
            const layout = layoutRaw === 'grid' ? 'grid' : 'list';
            const result = resultRaw === 'figure' ? 'figure' : 'article';
            entries.push({ type, layout, result });
          });
          if (entries.length) {
            resultsConfigEntries = entries;
            tabsOrder = entries.map((entry) => entry.type);
          }
        }
      }
    } catch (_) {}
    const searchMeta = {
      tabs: { order: tabsOrder },
      assets: {
        display: { path: 'search-records.json', bytes: displayBytes },
        ...(annotationRecords.length
          ? { annotations: { path: 'search-index-annotations.json', bytes: annotationsBytes } }
          : {}),
      },
    };
    if (resultsConfigEntries.length) {
      const resultSettings = resultsConfigEntries.reduce((acc, entry) => {
        acc[entry.type] = { layout: entry.layout, result: entry.result };
        return acc;
      }, {});
      searchMeta.results = {
        order: resultsConfigEntries.map((entry) => entry.type),
        settings: resultSettings,
      };
    }
    const meta = {
      version,
      records: indexRecords.length,
      bytes: approxBytes,
      updatedAt: new Date().toISOString(),
      // Expose optional search config to the client runtime
      search: searchMeta,
    };
    const metaPath = path.join(apiDir, 'index.json');
    await fsp.writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf8');
    try {
      const { logLine } = require('./log');
      logLine(`✓ Search index version ${version.slice(0, 8)} (${indexRecords.length} records)`, 'cyan');
    } catch (_) {}
    // Propagate version into IIIF cache index for a single, shared build identifier
    try {
      const { loadManifestIndex, saveManifestIndex } = require('./iiif');
      const iiifIdx = await loadManifestIndex();
      iiifIdx.version = version;
      await saveManifestIndex(iiifIdx);
      try {
        const { logLine } = require('./log');
        logLine(`• IIIF cache updated with version ${version.slice(0, 8)}`, 'blue');
      } catch (_) {}
    } catch (_) {}
  } catch (_) {}
}

// Compatibility: keep ensureResultTemplate as a no-op builder (template unused by React search)
async function ensureResultTemplate() {
  try {
    const { path } = require('../common');
    const p = path.join(OUT_DIR, 'search-result.html');
    await fsp.writeFile(p, '', 'utf8');
  } catch (_) {}
}

module.exports = {
  ensureSearchRuntime,
  ensureResultTemplate,
  buildSearchPage,
  writeSearchIndex,
  resolveSearchOutputRelative,
};
