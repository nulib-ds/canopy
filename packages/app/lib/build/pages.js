const {
  fs,
  fsp,
  path,
  CONTENT_DIR,
  OUT_DIR,
  ensureDirSync,
  htmlShell,
  canopyBodyClassForType,
  rootRelativeHref,
  resolveLocaleFromContentPath,
  canonicalizeLocaleCode,
  getDefaultLocaleCode,
} = require('../common');
const { log } = require('./log');
const mdx = require('./mdx');
const {buildLocaleRuntimeScript} = require('../locales');
const navigation = require('../components/navigation');
const referenced = require('../components/referenced');

function relativeRuntimeScript(outPath, filename, versioned = false) {
  if (!outPath || !filename) return null;
  const abs = path.join(OUT_DIR, 'scripts', filename);
  let rel = path.relative(path.dirname(outPath), abs).split(path.sep).join('/');
  if (!versioned) return rel;
  try {
    const st = fs.statSync(abs);
    const version = Math.floor(st.mtimeMs || Date.now());
    if (version) rel += `?v=${version}`;
  } catch (_) {}
  return rel;
}

function normalizeWhitespace(value) {
  if (!value) return '';
  return String(value).replace(/\s+/g, ' ').trim();
}

function truncateDescription(value, max = 240) {
  const normalized = normalizeWhitespace(value);
  if (!normalized) return '';
  if (normalized.length <= max) return normalized;
  const slice = normalized.slice(0, Math.max(0, max - 3)).trimEnd();
  return `${slice}...`;
}

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function readFrontmatterString(data, key) {
  if (!data) return '';
  const raw = data[key];
  if (raw == null) return '';
  if (typeof raw === 'string') return raw.trim();
  return '';
}

// Cache: dir -> frontmatter data for _layout.mdx in that dir
const LAYOUT_META = new Map();

async function getNearestDirLayoutMeta(filePath) {
  const startDir = path.dirname(filePath);
  let dir = startDir;
  while (dir && dir.startsWith(CONTENT_DIR)) {
    const key = path.resolve(dir);
    if (LAYOUT_META.has(key)) {
      const cached = LAYOUT_META.get(key);
      if (cached) return cached;
    }
    const candidate = path.join(dir, '_layout.mdx');
    if (fs.existsSync(candidate)) {
      try {
        const raw = await fsp.readFile(candidate, 'utf8');
        const fm = mdx.parseFrontmatter(raw);
        const data = fm && fm.data ? fm.data : null;
        LAYOUT_META.set(key, data);
        if (data) return data;
      } catch (_) {
        LAYOUT_META.set(key, null);
      }
    } else {
      LAYOUT_META.set(key, null);
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function mapContentPathToOutput(filePath) {
  const rel = path.relative(CONTENT_DIR, filePath);
  const outRel = rel.replace(/\.mdx$/i, '.html');
  return path.join(OUT_DIR, outRel);
}

async function renderContentMdxToHtml(filePath, outPath, extraProps = {}, sourceOverride = null) {
  const sourceRaw = sourceOverride != null ? sourceOverride : await fsp.readFile(filePath, 'utf8');
  const source = typeof sourceRaw === 'string' ? sourceRaw : String(sourceRaw || '');
  const title = mdx.extractTitle(source);
  const relContentPath = path.relative(CONTENT_DIR, filePath);
  const relOutputPath = relContentPath.replace(/\.mdx$/i, '.html');
  const normalizedRel = navigation.normalizeRelativePath(relContentPath);
  const pageInfo = navigation.getPageInfo(normalizedRel);
  const navData = navigation.buildNavigationForFile(normalizedRel);
  const allNavigationRoots = navigation.buildNavigationRoots(
    pageInfo && pageInfo.slug ? pageInfo.slug : ""
  );
  const mergedProps = { ...(extraProps || {}) };
  const frontmatter =
    typeof mdx.parseFrontmatter === 'function'
      ? mdx.parseFrontmatter(source)
      : { data: null, content: source };
  const frontmatterData = frontmatter && isPlainObject(frontmatter.data) ? frontmatter.data : null;
  const frontmatterLocaleRaw = readFrontmatterString(frontmatterData, 'locale');
  const frontmatterLocale = canonicalizeLocaleCode(frontmatterLocaleRaw);
  const pageLocale =
    frontmatterLocale ||
    resolveLocaleFromContentPath(relContentPath) ||
    getDefaultLocaleCode();
  const referencedManifestIdsRaw = frontmatterData ? frontmatterData.referencedManifests : null;
  const referencedManifestIds = referenced.normalizeReferencedManifestList(
    referencedManifestIdsRaw
  );
  const referencedItems = referencedManifestIds.length
    ? referenced.buildReferencedItems(referencedManifestIds, {
        locale: pageLocale,
      })
    : [];
  let layoutMeta = null;
  try {
    layoutMeta = await getNearestDirLayoutMeta(filePath);
  } catch (_) {
    layoutMeta = null;
  }
  const directType = frontmatterData && typeof frontmatterData.type === 'string' ? frontmatterData.type.trim() : '';
  const layoutType = layoutMeta && typeof layoutMeta.type === 'string' ? String(layoutMeta.type).trim() : '';
  const resolvedType = directType || layoutType || (!frontmatterData ? 'page' : '');
  const frontmatterDescription = frontmatterData && typeof frontmatterData.description === 'string'
    ? truncateDescription(frontmatterData.description)
    : '';
  const extractedPlain = typeof mdx.extractPlainText === 'function'
    ? mdx.extractPlainText(source)
    : '';
  const derivedDescription = truncateDescription(extractedPlain);
  const resolvedDescription = frontmatterDescription || derivedDescription;
  const ogImageFrontmatter =
    readFrontmatterString(frontmatterData, 'og:image') ||
    readFrontmatterString(frontmatterData, 'ogImage');
  const genericImage = readFrontmatterString(frontmatterData, 'image');
  const resolvedImage = ogImageFrontmatter || genericImage;
  const frontmatterMeta = frontmatterData && isPlainObject(frontmatterData.meta) ? frontmatterData.meta : null;
  const headings = mdx.extractHeadings(source);
  const basePage = pageInfo ? { ...pageInfo } : {};
  if (pageLocale) basePage.locale = pageLocale;
  if (title) basePage.title = title;
  if (resolvedType) basePage.type = resolvedType;
  if (resolvedDescription) basePage.description = resolvedDescription;
  if (basePage.href && !basePage.url) basePage.url = basePage.href;
  const frontmatterCanonical = readFrontmatterString(frontmatterData, 'canonical');
  const fallbackCanonical = rootRelativeHref(
    relOutputPath.split(path.sep).join('/')
  );
  const canonicalValue =
    frontmatterCanonical ||
    (basePage && basePage.canonical) ||
    basePage.url ||
    basePage.href ||
    fallbackCanonical;
  if (canonicalValue) basePage.canonical = canonicalValue;
  if (resolvedImage) {
    basePage.image = resolvedImage;
    basePage.ogImage = ogImageFrontmatter || resolvedImage;
  }
  const existingMeta = basePage.meta && typeof basePage.meta === 'object' ? basePage.meta : {};
  const pageMeta = { ...existingMeta };
  if (title) pageMeta.title = title;
  if (resolvedDescription) pageMeta.description = resolvedDescription;
  if (resolvedType) pageMeta.type = resolvedType;
  if (basePage.url || basePage.href) pageMeta.url = basePage.url || basePage.href || pageMeta.url;
  if (canonicalValue) pageMeta.canonical = canonicalValue;
  if (resolvedImage) {
    pageMeta.image = resolvedImage;
    if (!pageMeta.ogImage) pageMeta.ogImage = resolvedImage;
  }
  if (pageLocale) pageMeta.locale = pageLocale;
  if (frontmatterMeta) Object.assign(pageMeta, frontmatterMeta);
  if (Object.keys(pageMeta).length) basePage.meta = pageMeta;
  if (referencedManifestIds.length) {
    basePage.referencedManifests = referencedManifestIds;
  }
  if (referencedItems.length) {
    basePage.referencedItems = referencedItems;
  }
  if (Object.keys(basePage).length) {
    mergedProps.page = mergedProps.page
      ? { ...basePage, ...mergedProps.page }
      : basePage;
  }
  if (referencedManifestIds.length) {
    mergedProps.referencedManifests = referencedManifestIds;
  }
  if (referencedItems.length) {
    mergedProps.referencedItems = referencedItems;
  }
  if (!mergedProps.navigation) {
    if (navData || (allNavigationRoots && Object.keys(allNavigationRoots).length)) {
      const navigationPayload = navData ? {...navData} : {};
      if (allNavigationRoots && Object.keys(allNavigationRoots).length) {
        navigationPayload.allRoots = allNavigationRoots;
      }
      mergedProps.navigation = Object.keys(navigationPayload).length
        ? navigationPayload
        : null;
    }
  } else if (
    mergedProps.navigation &&
    allNavigationRoots &&
    Object.keys(allNavigationRoots).length &&
    !mergedProps.navigation.allRoots
  ) {
    mergedProps.navigation.allRoots = allNavigationRoots;
  }
  if (headings && headings.length) {
    mergedProps.page = mergedProps.page
      ? { ...mergedProps.page, headings }
      : { headings };
  }
  const { body, head } = await mdx.compileMdxFile(filePath, outPath, null, mergedProps);
  const needsHydrateViewer =
    body.includes('data-canopy-viewer') ||
    body.includes('data-canopy-scroll') ||
    body.includes('data-canopy-image');
  const needsHydrateSlider = body.includes('data-canopy-slider');
  const needsImageStory = body.includes('data-canopy-image-story');
  const needsHeroSlider = body.includes('data-canopy-hero-slider');
  const needsTimeline = body.includes('data-canopy-timeline');
  const needsMap = body.includes('data-canopy-map');
  const needsSearchForm = true; // search form runtime is global
  const needsFacets = body.includes('data-canopy-related-items');
  const needsCustomClients = body.includes('data-canopy-client-component');
  const viewerRel = needsHydrateViewer
    ? relativeRuntimeScript(outPath, 'canopy-viewer.js', true)
    : null;
  const sliderRel = (needsHydrateSlider || needsFacets)
    ? relativeRuntimeScript(outPath, 'canopy-slider.js', true)
    : null;
  const imageStoryRel = needsImageStory
    ? relativeRuntimeScript(outPath, 'canopy-image-story.js', true)
    : null;
  const heroRel = needsHeroSlider
    ? relativeRuntimeScript(outPath, 'canopy-hero-slider.js', true)
    : null;
  const timelineRel = needsTimeline
    ? relativeRuntimeScript(outPath, 'canopy-timeline.js', true)
    : null;
  const mapRel = needsMap
    ? relativeRuntimeScript(outPath, 'canopy-map.js', true)
    : null;
  const mapCssRel = needsMap
    ? path.relative(path.dirname(outPath), path.join(OUT_DIR, 'scripts', 'canopy-map.css')).split(path.sep).join('/')
    : null;
  const facetsRel = needsFacets
    ? relativeRuntimeScript(outPath, 'canopy-related-items.js', true)
    : null;
  let searchFormRel = null;
  if (needsSearchForm) {
    searchFormRel = relativeRuntimeScript(outPath, 'canopy-search-form.js', true);
  }
  let customClientRel = null;
  if (needsCustomClients) {
    try {
      await mdx.ensureCustomClientRuntime();
      const customAbs = path.join(OUT_DIR, 'scripts', 'canopy-custom-components.js');
      let rel = path.relative(path.dirname(outPath), customAbs).split(path.sep).join('/');
      try {
        const st = fs.statSync(customAbs);
        rel += `?v=${Math.floor(st.mtimeMs || Date.now())}`;
      } catch (_) {}
      customClientRel = rel;
    } catch (e) {
      console.warn('[canopy][mdx] failed to build custom client runtime:', e && e.message ? e.message : e);
    }
  }
  const moduleScriptRels = [];
  if (viewerRel) moduleScriptRels.push(viewerRel);
  if (sliderRel) moduleScriptRels.push(sliderRel);
  if (imageStoryRel) moduleScriptRels.push(imageStoryRel);
  if (customClientRel) moduleScriptRels.push(customClientRel);
  const primaryClassicScripts = [];
  if (heroRel) primaryClassicScripts.push(heroRel);
  if (timelineRel) primaryClassicScripts.push(timelineRel);
  if (mapRel) primaryClassicScripts.push(mapRel);
  if (facetsRel) primaryClassicScripts.push(facetsRel);
  const secondaryClassicScripts = [];
  if (searchFormRel) secondaryClassicScripts.push(searchFormRel);
  let jsRel = null;
  if (primaryClassicScripts.length) {
    jsRel = primaryClassicScripts.shift();
  }
  const classicScriptRels = primaryClassicScripts.concat(secondaryClassicScripts);
  const needsReact = !!(
    needsHydrateViewer ||
    needsHydrateSlider ||
    needsFacets ||
    needsTimeline ||
    needsMap ||
    (customClientRel && needsCustomClients)
  );
  let vendorTag = '';
  if (needsReact) {
    try {
      await mdx.ensureReactGlobals();
      const vendorAbs = path.join(OUT_DIR, 'scripts', 'react-globals.js');
      let vendorRel = path.relative(path.dirname(outPath), vendorAbs).split(path.sep).join('/');
      try { const stv = fs.statSync(vendorAbs); vendorRel += `?v=${Math.floor(stv.mtimeMs || Date.now())}`; } catch (_) {}
      vendorTag = `<script src="${vendorRel}"></script>`;
    } catch (_) {}
  }
  try {
    const { BASE_PATH } = require('../common');
    if (BASE_PATH) vendorTag = `<script>window.CANOPY_BASE_PATH=${JSON.stringify(BASE_PATH)}</script>` + vendorTag;
  } catch (_) {}
  const headSegments = [head];
  try {
    const localeScript = buildLocaleRuntimeScript(pageLocale);
    if (localeScript) headSegments.push(localeScript);
  } catch (_) {}
  const extraScripts = [];
  const pushClassicScript = (src) => {
    if (!src || src === jsRel) return;
    extraScripts.push(`<script defer src="${src}"></script>`);
  };
  const pushModuleScript = (src) => {
    if (!src) return;
    extraScripts.push(`<script type="module" src="${src}"></script>`);
  };
  classicScriptRels.forEach((src) => pushClassicScript(src));
  if (moduleScriptRels.length) {
    moduleScriptRels.forEach((src) => pushModuleScript(src));
  }
  // The hero runtime (Embla) ships no CSS; its styles live in the UI
  // stylesheet, so only the map needs a runtime stylesheet.
  const extraStyles = [];
  if (mapCssRel) {
    let rel = mapCssRel;
    try {
      const mapCssAbs = path.join(OUT_DIR, 'scripts', 'canopy-map.css');
      const st = fs.statSync(mapCssAbs);
      rel += `?v=${Math.floor(st.mtimeMs || Date.now())}`;
    } catch (_) {}
    extraStyles.push(`<link rel="stylesheet" href="${rel}">`);
  }
  if (extraStyles.length) headSegments.push(extraStyles.join(''));
  if (vendorTag) headSegments.push(vendorTag);
  if (extraScripts.length) headSegments.push(extraScripts.join(''));
  const headExtra = headSegments.join('');
  const typeForClass = resolvedType || 'page';
  const bodyClass = canopyBodyClassForType(typeForClass);
  const html = htmlShell({
    title,
    body,
    cssHref: null,
    scriptHref: jsRel,
    headExtra,
    bodyClass,
    lang: pageLocale,
  });
  const { applyBaseToHtml } = require('../common');
  return applyBaseToHtml(html);
}

async function processContentEntry(absPath, pagesMetadata = []) {
  const stat = await fsp.stat(absPath);
  if (stat.isDirectory()) return;
  if (/\.mdx$/i.test(absPath)) {
    if (mdx.isReservedFile(absPath)) return;
    const outPath = mapContentPathToOutput(absPath);
    try {
      const source = await fsp.readFile(absPath, 'utf8');
      const frontmatter = typeof mdx.parseFrontmatter === 'function'
        ? mdx.parseFrontmatter(source)
        : { data: null };
      const frontmatterData = frontmatter && isPlainObject(frontmatter.data) ? frontmatter.data : null;
      ensureDirSync(path.dirname(outPath));
      try { log(`• Processing MDX ${absPath}\n`, 'blue'); } catch (_) {}
      const base = path.basename(absPath);
      const extra = base.toLowerCase() === 'sitemap.mdx' ? { pages: pagesMetadata } : {};
      const html = await renderContentMdxToHtml(absPath, outPath, extra, source);
      await fsp.writeFile(outPath, html || '', 'utf8');
      try { log(`✓ Built ${path.relative(process.cwd(), outPath)}\n`, 'green'); } catch (_) {}
    } catch (err) {
      console.error('MDX build failed for', absPath, '\n', err.message);
    }
  } else {
    const rel = path.relative(CONTENT_DIR, absPath);
    const outPath = path.join(OUT_DIR, rel);
    ensureDirSync(path.dirname(outPath));
    await fsp.copyFile(absPath, outPath);
    try { log(`• Copied ${path.relative(process.cwd(), outPath)}\n`, 'cyan', { dim: true }); } catch (_) {}
  }
}

async function buildContentTree(dir, pagesMetadata = []) {
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) await buildContentTree(p, pagesMetadata);
    else if (e.isFile()) await processContentEntry(p, pagesMetadata);
  }
}

module.exports = {
  getNearestDirLayoutMeta,
  mapContentPathToOutput,
  renderContentMdxToHtml,
  processContentEntry,
  buildContentTree,
};
