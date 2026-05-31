const React = require("react");
const ReactDOMServer = require("react-dom/server");
const crypto = require("crypto");
const slugify = require("slugify");
const yaml = require("js-yaml");
const {
  fs,
  fsp,
  path,
  OUT_DIR,
  CONTENT_DIR,
  ensureDirSync,
  htmlShell,
  rootRelativeHref,
  canopyBodyClassForType,
  readSiteMetadata,
  readPrimaryNavigation,
  withBase,
  resolveLocaleFromHref,
  getLocaleRouteEntries,
  getDefaultRoute,
  buildRouteRelativePath,
  getLocaleRouteConfig,
  getDefaultLocaleCode,
} = require("../common");
const {
  readCanopyLocalesWithMessages,
  readLocaleMessages,
  buildLocaleRuntimeScript,
} = require("../locales");
const {resolveCanopyConfigPath} = require("../config-path");
const mdx = require("./mdx");
const {log, logLine, logResponse} = require("./log");
const {getPageContext} = require("../page-context");
const PageContext = getPageContext();
const referenced = require("../components/referenced");
const navPlace = require("../components/nav-place");
const navigation = require("../components/navigation.js");
const {
  getThumbnail,
  getRepresentativeImage,
  buildIiifImageUrlFromService,
  buildIiifImageUrlForDimensions,
  findPrimaryCanvasImage,
  buildIiifImageSrcset,
  isLevel0Service,
} = require("../iiif/thumbnail");

const IIIF_CACHE_DIR = path.resolve(".cache/iiif");
const IIIF_CACHE_MANIFESTS_DIR = path.join(IIIF_CACHE_DIR, "manifests");
const IIIF_CACHE_COLLECTIONS_DIR = path.join(IIIF_CACHE_DIR, "collections");
const IIIF_CACHE_COLLECTION = path.join(IIIF_CACHE_DIR, "collection.json");
const IIIF_METADATA_INDEX_CACHE = path.join(
  IIIF_CACHE_DIR,
  "metadata-index.json",
);

function relativeRuntimeScript(outPath, filename, versioned = false) {
  if (!outPath || !filename) return null;
  const abs = path.join(OUT_DIR, "scripts", filename);
  let rel = path.relative(path.dirname(outPath), abs).split(path.sep).join("/");
  if (!versioned) return rel;
  try {
    const st = fs.statSync(abs);
    const version = Math.floor(st.mtimeMs || Date.now());
    if (version) rel += `?v=${version}`;
  } catch (_) {}
  return rel;
}
// Primary global index location
const IIIF_CACHE_INDEX = path.join(IIIF_CACHE_DIR, "index.json");
// Additional legacy locations kept for backward compatibility (read + optional write)
const IIIF_CACHE_INDEX_LEGACY = path.join(
  IIIF_CACHE_DIR,
  "manifest-index.json",
);
const IIIF_CACHE_INDEX_MANIFESTS = path.join(
  IIIF_CACHE_MANIFESTS_DIR,
  "manifest-index.json",
);

const DEFAULT_THUMBNAIL_SIZE = 400;
const DEFAULT_CHUNK_SIZE = 10;
const DEFAULT_FETCH_CONCURRENCY = 1;
const DEFAULT_FEATURED_FETCH_TIMEOUT_MS = 15000;
const HERO_THUMBNAIL_SIZE = 800;
const HERO_IMAGE_SIZES_ATTR = "(min-width: 1024px) 1280px, 100vw";
const OG_IMAGE_WIDTH = 1200;
const OG_IMAGE_HEIGHT = 630;
const HERO_REPRESENTATIVE_SIZE = Math.max(HERO_THUMBNAIL_SIZE, OG_IMAGE_WIDTH);
const MAX_ENTRY_SLUG_LENGTH = 50;
const DEBUG_IIIF = process.env.CANOPY_IIIF_DEBUG === "1";

function logDebug(message) {
  if (!DEBUG_IIIF) return;
  try {
    logLine(`[IIIF][debug] ${message}`, "magenta", {dim: true});
  } catch (_) {}
}

function resolvePositiveInteger(value, fallback, options = {}) {
  const allowZero = Boolean(options && options.allowZero);
  const num = Number(value);
  if (Number.isFinite(num)) {
    if (allowZero && num === 0) return 0;
    if (num > 0) return Math.max(1, Math.floor(num));
  }
  const normalizedFallback = Number(fallback);
  if (allowZero && normalizedFallback === 0) return 0;
  return Math.max(1, Math.floor(normalizedFallback));
}

function formatDurationMs(ms) {
  if (!Number.isFinite(ms) || ms < 0) return "0ms";
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms)}ms`;
}

function resolveBoolean(value) {
  if (typeof value === "boolean") return value;
  if (value === undefined || value === null) return false;
  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return false;
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

function normalizeCollectionUris(value) {
  if (value === undefined || value === null) return [];
  const rawValues = Array.isArray(value) ? value : [value];
  const seen = new Set();
  const uris = [];
  for (const entry of rawValues) {
    if (typeof entry !== "string") continue;
    const trimmed = entry.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    uris.push(trimmed);
  }
  return uris;
}

function normalizeManifestConfig(cfg) {
  if (!cfg || typeof cfg !== "object") return [];
  const entries = [];
  const push = (value) => {
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) entries.push(...value);
    else entries.push(value);
  };
  push(cfg.manifest);
  push(cfg.manifests);
  if (!entries.length) return [];
  return normalizeCollectionUris(entries);
}

function resolveIiifSources(cfg) {
  const safeCfg = cfg && typeof cfg === "object" ? cfg : {};
  let collectionUris = normalizeCollectionUris(safeCfg.collection);
  if (!collectionUris.length) {
    collectionUris = normalizeCollectionUris(
      process.env.CANOPY_COLLECTION_URI || "",
    );
  }
  const manifestUris = normalizeManifestConfig(safeCfg);
  return {collections: collectionUris, manifests: manifestUris};
}

function clampSlugLength(slug, limit = MAX_ENTRY_SLUG_LENGTH) {
  if (!slug) return "";
  const max = Math.max(1, limit);
  if (slug.length <= max) return slug;
  const slice = slug.slice(0, max);
  const trimmed = slice.replace(/-+$/g, "");
  return trimmed || slice || slug.slice(0, 1);
}

function isSlugTooLong(value) {
  return typeof value === "string" && value.length > MAX_ENTRY_SLUG_LENGTH;
}

function normalizeSlugBase(value, fallback) {
  const safeFallback = fallback || "entry";
  const base = typeof value === "string" ? value : String(value || "");
  const clamped = clampSlugLength(base, MAX_ENTRY_SLUG_LENGTH);
  if (clamped) return clamped;
  return clampSlugLength(safeFallback, MAX_ENTRY_SLUG_LENGTH) || safeFallback;
}

function manifestHrefFromSlug(slug, routePath) {
  if (!slug) return "";
  const rel = buildRouteRelativePath(routePath || getDefaultRoute("works"), `${String(slug).trim()}.html`);
  return rootRelativeHref(rel);
}

function extractHomepageId(resource) {
  if (!resource) return "";
  const homepageRaw = resource.homepage;
  const list = Array.isArray(homepageRaw)
    ? homepageRaw
    : homepageRaw
      ? [homepageRaw]
      : [];
  for (const entry of list) {
    if (!entry) continue;
    if (typeof entry === "string") {
      const trimmed = entry.trim();
      if (trimmed) return trimmed;
      continue;
    }
    if (typeof entry === "object") {
      const id = entry.id || entry["@id"];
      if (typeof id === "string" && id.trim()) return id.trim();
    }
  }
  return "";
}

function resolveManifestCanonical(manifest, slug, routePath) {
  const homepageId = extractHomepageId(manifest);
  if (homepageId) return homepageId;
  return manifestHrefFromSlug(slug, routePath);
}

function resolveCollectionCanonical(collection) {
  const homepageId = extractHomepageId(collection);
  if (homepageId) return homepageId;
  const id = collection && (collection.id || collection["@id"]);
  return typeof id === "string" ? id : "";
}

function assignEntryCanonical(entry, canonical) {
  if (!entry || typeof entry !== "object") return "";
  const value = canonical ? String(canonical) : "";
  entry.canonical = value;
  return value;
}

function applyManifestEntryCanonical(entry, manifest, slug, routePath) {
  if (!entry || entry.type !== "Manifest") return "";
  const canonical = resolveManifestCanonical(manifest, slug, routePath);
  return assignEntryCanonical(entry, canonical);
}

function applyCollectionEntryCanonical(entry, collection) {
  if (!entry || entry.type !== "Collection") return "";
  const canonical = resolveCollectionCanonical(collection);
  return assignEntryCanonical(entry, canonical);
}

function buildSlugWithSuffix(base, fallback, counter) {
  const suffix = `-${counter}`;
  const baseLimit = Math.max(1, MAX_ENTRY_SLUG_LENGTH - suffix.length);
  const trimmedBase =
    clampSlugLength(base, baseLimit) ||
    clampSlugLength(fallback, baseLimit) ||
    fallback.slice(0, baseLimit);
  return `${trimmedBase}${suffix}`;
}

function normalizeStringList(value) {
  if (value === undefined || value === null) return [];
  const rawValues = Array.isArray(value) ? value : [value];
  return rawValues
    .map((entry) => {
      if (typeof entry === "string") return entry.trim();
      if (entry === undefined || entry === null) return "";
      return String(entry).trim();
    })
    .filter(Boolean);
}

function resolveThumbnailPreferences() {
  return {
    size: resolvePositiveInteger(
      process.env.CANOPY_THUMBNAIL_SIZE,
      DEFAULT_THUMBNAIL_SIZE,
    ),
    unsafe: resolveBoolean(process.env.CANOPY_THUMBNAILS_UNSAFE),
  };
}

function ensureThumbnailValue(target, url, width, height) {
  if (!target) return false;
  const current = target.thumbnail;
  const hasCurrent =
    typeof current === "string" ? current.trim().length > 0 : Boolean(current);
  if (hasCurrent) return false;
  if (!url) return false;
  const normalized = String(url || "").trim();
  if (!normalized) return false;
  target.thumbnail = normalized;
  if (typeof width === "number" && Number.isFinite(width) && width > 0)
    target.thumbnailWidth = width;
  if (typeof height === "number" && Number.isFinite(height) && height > 0)
    target.thumbnailHeight = height;
  return true;
}

function extractResourceThumbnail(resource) {
  try {
    const rawThumb = resource && resource.thumbnail;
    const first = Array.isArray(rawThumb) ? rawThumb[0] : rawThumb;
    if (!first) return null;
    if (typeof first === "string") {
      const trimmed = first.trim();
      return trimmed ? {url: trimmed} : null;
    }
    const id = first.id || first["@id"];
    if (!id) return null;
    const width = typeof first.width === "number" ? first.width : undefined;
    const height = typeof first.height === "number" ? first.height : undefined;
    return {url: String(id), width, height};
  } catch (_) {
    return null;
  }
}

async function resolveHeroMedia(manifest) {
  if (!manifest) return null;
  try {
    const manifestThumb = extractResourceThumbnail(manifest);
    const heroSource = (() => {
      if (manifest && manifest.thumbnail) {
        const clone = {...manifest};
        try {
          delete clone.thumbnail;
        } catch (_) {
          clone.thumbnail = undefined;
        }
        return clone;
      }
      return manifest;
    })();
    const heroRep = await getRepresentativeImage(
      heroSource || manifest,
      HERO_REPRESENTATIVE_SIZE,
      true,
    );
    const canvasImage = findPrimaryCanvasImage(manifest);
    const heroService =
      (canvasImage && canvasImage.service) || (heroRep && heroRep.service);
    const serviceIsLevel0 = isLevel0Service(heroService);
    const heroPreferred = buildIiifImageUrlFromService(
      serviceIsLevel0 ? null : heroService,
      HERO_THUMBNAIL_SIZE,
    );
    const heroWidth = (() => {
      if (canvasImage && typeof canvasImage.width === "number")
        return canvasImage.width;
      if (heroRep && typeof heroRep.width === "number") return heroRep.width;
      return undefined;
    })();
    const heroHeight = (() => {
      if (canvasImage && typeof canvasImage.height === "number")
        return canvasImage.height;
      if (heroRep && typeof heroRep.height === "number") return heroRep.height;
      return undefined;
    })();
    const heroSrcset = serviceIsLevel0 ? "" : buildIiifImageSrcset(heroService);
    const ogFromService =
      !serviceIsLevel0 && heroService
        ? buildIiifImageUrlForDimensions(
            heroService,
            OG_IMAGE_WIDTH,
            OG_IMAGE_HEIGHT,
          )
        : "";
    const annotationImageId =
      canvasImage && canvasImage.isImageBody && canvasImage.id
        ? String(canvasImage.id)
        : "";
    let heroThumbnail = heroPreferred || "";
    let heroThumbWidth = heroWidth;
    let heroThumbHeight = heroHeight;
    if (!heroThumbnail && manifestThumb && manifestThumb.url) {
      heroThumbnail = manifestThumb.url;
      if (typeof manifestThumb.width === "number")
        heroThumbWidth = manifestThumb.width;
      if (typeof manifestThumb.height === "number")
        heroThumbHeight = manifestThumb.height;
    }
    if (!heroThumbnail) {
      if (annotationImageId) {
        heroThumbnail = annotationImageId;
      } else if (!serviceIsLevel0 && heroRep && heroRep.id) {
        heroThumbnail = String(heroRep.id);
      }
    }
    let ogImage = "";
    let ogImageWidth;
    let ogImageHeight;
    if (ogFromService) {
      ogImage = ogFromService;
      ogImageWidth = OG_IMAGE_WIDTH;
      ogImageHeight = OG_IMAGE_HEIGHT;
    } else if (heroThumbnail) {
      ogImage = heroThumbnail;
      if (typeof heroThumbWidth === "number") ogImageWidth = heroThumbWidth;
      if (typeof heroThumbHeight === "number") ogImageHeight = heroThumbHeight;
    }
    return {
      heroThumbnail: heroThumbnail || "",
      heroThumbnailWidth: heroThumbWidth,
      heroThumbnailHeight: heroThumbHeight,
      heroThumbnailSrcset: heroSrcset || "",
      heroThumbnailSizes: heroSrcset ? HERO_IMAGE_SIZES_ATTR : "",
      ogImage: ogImage || "",
      ogImageWidth,
      ogImageHeight,
    };
  } catch (_) {
    return null;
  }
}

function firstLabelString(label) {
  if (!label) return "Untitled";
  if (typeof label === "string") return label;
  const keys = Object.keys(label || {});
  if (!keys.length) return "Untitled";
  const arr = label[keys[0]];
  if (Array.isArray(arr) && arr.length) return String(arr[0]);
  return "Untitled";
}

function flattenMetadataValue(value, out, depth) {
  if (!value || depth > 5) return;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed) out.push(trimmed);
    return;
  }
  if (Array.isArray(value)) {
    for (const entry of value) flattenMetadataValue(entry, out, depth + 1);
    return;
  }
  if (typeof value === "object") {
    for (const key of Object.keys(value))
      flattenMetadataValue(value[key], out, depth + 1);
    return;
  }
  try {
    const str = String(value).trim();
    if (str) out.push(str);
  } catch (_) {}
}

function normalizeMetadataLabel(label) {
  if (typeof label !== "string") return "";
  const trimmed = label.trim().replace(/[:\s]+$/g, "");
  return trimmed.toLowerCase();
}

function resolveParentFromPartOf(resource) {
  try {
    const partOf = resource && resource.partOf;
    if (!partOf) return "";
    const arr = Array.isArray(partOf) ? partOf : [partOf];
    for (const entry of arr) {
      if (!entry) continue;
      const id = entry.id || entry["@id"];
      if (id) return String(id);
    }
  } catch (_) {}
  return "";
}

function extractSummaryValues(manifest) {
  const values = [];
  try {
    flattenMetadataValue(manifest && manifest.summary, values, 0);
  } catch (_) {}
  const unique = Array.from(
    new Set(values.map((val) => String(val || "").trim()).filter(Boolean)),
  );
  if (!unique.length) return "";
  return unique.join(" ");
}

function normalizeSummaryText(value) {
  if (!value) return "";
  return String(value).replace(/\s+/g, " ").trim();
}

function truncateSummary(value, max = 240) {
  const normalized = normalizeSummaryText(value);
  if (!normalized) return "";
  if (normalized.length <= max) return normalized;
  const slice = normalized.slice(0, Math.max(0, max - 3)).trimEnd();
  return `${slice}...`;
}

function stripHtml(value) {
  try {
    return String(value || "")
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  } catch (_) {
    return "";
  }
}

function collectTextualBody(body, out) {
  if (!body) return;
  if (Array.isArray(body)) {
    for (const entry of body) collectTextualBody(entry, out);
    return;
  }
  if (typeof body === "string") {
    const text = stripHtml(body);
    if (text) out.push(text);
    return;
  }
  if (typeof body !== "object") return;
  const type = String(body.type || "").toLowerCase();
  const format = String(body.format || "").toLowerCase();
  const isTextual =
    type === "textualbody" ||
    format.startsWith("text/") ||
    typeof body.value === "string" ||
    Array.isArray(body.value);
  if (!isTextual) return;
  if (body.value !== undefined) collectTextualBody(body.value, out);
  if (body.label !== undefined) collectTextualBody(body.label, out);
  if (body.body !== undefined) collectTextualBody(body.body, out);
  if (body.items !== undefined) collectTextualBody(body.items, out);
  if (body.text !== undefined) collectTextualBody(body.text, out);
}

async function extractAnnotationText(manifest, options = {}) {
  if (!manifest || typeof manifest !== "object") return "";
  if (!options.enabled) return "";
  const motivations =
    options.motivations instanceof Set ? options.motivations : new Set();
  const allowAll = motivations.size === 0;
  const results = [];
  const seenText = new Set();
  const seenNodes = new Set();

  function matchesMotivation(value) {
    if (allowAll) return true;
    if (!value) return false;
    if (Array.isArray(value)) {
      return value.some((entry) => matchesMotivation(entry));
    }
    try {
      const norm = String(value || "")
        .trim()
        .toLowerCase();
      return motivations.has(norm);
    } catch (_) {
      return false;
    }
  }

  async function handleAnnotation(annotation) {
    if (!annotation || typeof annotation !== "object") return;
    if (!matchesMotivation(annotation.motivation)) return;
    const body = annotation.body;
    const texts = [];
    collectTextualBody(body, texts);
    for (const text of texts) {
      if (!text) continue;
      if (seenText.has(text)) continue;
      seenText.add(text);
      results.push(text);
    }
  }

  async function walk(value) {
    if (!value) return;
    if (Array.isArray(value)) {
      for (const entry of value) await walk(entry);
      return;
    }
    if (typeof value !== "object") return;
    if (seenNodes.has(value)) return;
    seenNodes.add(value);
    if (Array.isArray(value.annotations)) {
      for (const page of value.annotations) {
        if (page && typeof page.id === 'string' && !page.items){
          const fetchedPage = await readJsonFromUri(page.id, { log: true });
          if (fetchedPage && Array.isArray(fetchedPage.items)) {
            for (const item of fetchedPage.items){
              handleAnnotation(item)
            }
          }
        } else if (page && Array.isArray(page.items)) {
          for (const item of page.items) handleAnnotation(item);
        }
        await walk(page);
      }
    }
    if (Array.isArray(value.items)) {
      for (const item of value.items) await walk(item);
    }
    for (const key of Object.keys(value)) {
      if (key === "annotations" || key === "items") continue;
      await walk(value[key]);
    }
  }

  await walk(manifest);
  if (!results.length) return "";
  return results.join(" ");
}

function extractMetadataValues(manifest, options = {}) {
  const meta = Array.isArray(manifest && manifest.metadata)
    ? manifest.metadata
    : [];
  if (!meta.length) return [];
  const includeAll = !!options.includeAll;
  const labelsSet = includeAll
    ? null
    : options && options.labelsSet instanceof Set
      ? options.labelsSet
      : new Set();
  const seen = new Set();
  const out = [];
  for (const entry of meta) {
    if (!entry) continue;
    const label = firstLabelString(entry.label);
    if (!label) continue;
    if (!includeAll && labelsSet && labelsSet.size) {
      const normLabel = normalizeMetadataLabel(label);
      if (!labelsSet.has(normLabel)) continue;
    }
    const values = [];
    flattenMetadataValue(entry.value, values, 0);
    for (const val of values) {
      const normalized = String(val || "").trim();
      if (!normalized) continue;
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      out.push(normalized);
    }
  }
  return out;
}

function extractMetadataEntries(manifest, options = {}) {
  const meta = Array.isArray(manifest && manifest.metadata)
    ? manifest.metadata
    : [];
  if (!meta.length) return [];
  const includeAll = !!options.includeAll;
  const labelsSet = includeAll
    ? null
    : options && options.labelsSet instanceof Set
      ? options.labelsSet
      : new Set();
  const map = new Map();
  const order = [];
  for (const entry of meta) {
    if (!entry) continue;
    const label = firstLabelString(entry.label);
    if (!label) continue;
    const normalized = normalizeMetadataLabel(label);
    if (!normalized) continue;
    if (!includeAll && labelsSet && labelsSet.size && !labelsSet.has(normalized)) continue;
    const values = [];
    flattenMetadataValue(entry.value, values, 0);
    const cleaned = [];
    for (const val of values) {
      const text = String(val || "").trim();
      if (text) cleaned.push(text);
    }
    if (!cleaned.length) continue;
    let record = map.get(normalized);
    if (!record) {
      record = {label, normalized, values: [], seen: new Set()};
      map.set(normalized, record);
      order.push(normalized);
    } else if (!record.label && label) {
      record.label = label;
    }
    for (const valueText of cleaned) {
      if (record.seen.has(valueText)) continue;
      record.seen.add(valueText);
      record.values.push(valueText);
    }
  }
  return order
    .map((normalized) => map.get(normalized))
    .filter(Boolean)
    .map((record) => ({
      label: record.label,
      normalized: record.normalized,
      values: record.values.slice(),
    }));
}

function buildMetadataIndexPayload(map, explicitOrder, fallbackOrder) {
  if (!map || !map.size) return [];
  const ordered = [];
  const seen = new Set();
  const primaryOrder = Array.isArray(explicitOrder) ? explicitOrder : [];
  const secondaryOrder = Array.isArray(fallbackOrder) ? fallbackOrder : [];
  for (const normalized of primaryOrder) {
    if (!normalized) continue;
    const record = map.get(normalized);
    if (!record) continue;
    ordered.push(record);
    seen.add(normalized);
  }
  for (const normalized of secondaryOrder) {
    if (!normalized || seen.has(normalized)) continue;
    const record = map.get(normalized);
    if (!record) continue;
    ordered.push(record);
    seen.add(normalized);
  }
  map.forEach((record, normalized) => {
    if (seen.has(normalized)) return;
    ordered.push(record);
  });
  const payload = [];
  for (const record of ordered) {
    if (!record || !record.values) continue;
    const values = Array.from(record.values.values()).sort((a, b) =>
      String(a && a.value ? a.value : "").localeCompare(
        String(b && b.value ? b.value : ""),
      ),
    );
    if (!values.length) continue;
    payload.push({
      label: record.label || record.slug || record.normalized,
      slug: record.slug || record.normalized,
      values,
    });
  }
  return payload;
}

async function writeMetadataIndexFile(payload) {
  if (!payload || !payload.length) {
    try {
      await fsp.rm(IIIF_METADATA_INDEX_CACHE, {force: true});
    } catch (_) {}
    return;
  }
  try {
    ensureDirSync(path.dirname(IIIF_METADATA_INDEX_CACHE));
    await fsp.writeFile(
      IIIF_METADATA_INDEX_CACHE,
      JSON.stringify(payload, null, 2),
      "utf8",
    );
  } catch (_) {}
}

async function normalizeToV3(resource) {
  try {
    const helpers = await import("@iiif/helpers");
    if (helpers && typeof helpers.toPresentation3 === "function") {
      return helpers.toPresentation3(resource);
    }
    if (helpers && typeof helpers.normalize === "function") {
      return helpers.normalize(resource);
    }
    if (helpers && typeof helpers.upgradeToV3 === "function") {
      return helpers.upgradeToV3(resource);
    }
  } catch (_) {}
  return resource;
}

let upgradeModulePromise = null;
async function loadUpgradeModule() {
  if (!upgradeModulePromise) {
    upgradeModulePromise = import("@iiif/parser/upgrader").catch(() => null);
  }
  return upgradeModulePromise;
}

async function upgradeIiifResource(resource) {
  if (!resource) return resource;
  try {
    const mod = await loadUpgradeModule();
    const upgrader = mod && (mod.upgrade || mod.default);
    if (typeof upgrader === "function") {
      let upgraded = upgrader(resource);
      if (upgraded && typeof upgraded.then === "function") {
        upgraded = await upgraded;
      }
      if (upgraded) return upgraded;
    }
  } catch (_) {}
  return normalizeToV3(resource);
}

async function ensurePresentation3Manifest(manifest) {
  const upgraded = await upgradeIiifResource(manifest);
  return {manifest: upgraded, changed: upgraded !== manifest};
}

async function readJson(p) {
  const raw = await fsp.readFile(p, "utf8");
  return JSON.parse(raw);
}

function normalizeIiifId(raw) {
  try {
    const s = String(raw || "");
    if (!/^https?:\/\//i.test(s)) return s;
    const u = new URL(s);
    const entries = Array.from(u.searchParams.entries()).sort(
      (a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]),
    );
    u.search = "";
    for (const [k, v] of entries) u.searchParams.append(k, v);
    return u.toString();
  } catch (_) {
    return String(raw || "");
  }
}

function normalizeIiifType(value) {
  try {
    const raw = String(value || "").trim();
    if (!raw) return "";
    const lower = raw.toLowerCase();
    const idx = lower.lastIndexOf(":");
    if (idx >= 0 && idx < lower.length - 1) return lower.slice(idx + 1);
    return lower;
  } catch (_) {
    return "";
  }
}

function extractCollectionEntries(collection) {
  if (!collection || typeof collection !== "object") return [];
  const entries = [];
  const seen = new Set();
  const pushEntry = (raw, fallbackType) => {
    if (!raw) return;
    let id = "";
    let type = "";
    if (typeof raw === "string") {
      id = raw;
      type = fallbackType || "";
    } else if (typeof raw === "object") {
      id = raw.id || raw["@id"] || fallbackType || "";
      type = raw.type || raw["@type"] || fallbackType || "";
    }
    const normalizedId = String(id || "").trim();
    if (!normalizedId) return;
    const normalizedType = normalizeIiifType(type || fallbackType || "");
    const fallback = normalizeIiifType(fallbackType || "");
    const key = `${normalizedType}::${normalizedId}`;
    if (seen.has(key)) return;
    seen.add(key);
    entries.push({
      id: normalizedId,
      type: normalizedType,
      fallback,
      raw,
    });
  };

  const sources = [
    {list: collection.items, fallback: ""},
    {list: collection.manifests, fallback: "manifest"},
    {list: collection.collections, fallback: "collection"},
    {list: collection.members, fallback: ""},
  ];
  for (const source of sources) {
    const arr = Array.isArray(source.list) ? source.list : [];
    for (const entry of arr) pushEntry(entry, source.fallback);
  }
  return entries;
}

async function readJsonFromUri(uri, options = {log: false}) {
  const opts = options && typeof options === "object" ? options : {};
  const shouldLog = Boolean(opts.log);
  const fetchSignal = opts.signal;
  try {
    if (/^https?:\/\//i.test(uri)) {
      if (typeof fetch !== "function") return null;
      let res = null;
      try {
        const fetchOptions = {headers: {Accept: "application/json"}};
        if (fetchSignal) fetchOptions.signal = fetchSignal;
        res = await fetch(uri, fetchOptions);
      } catch (error) {
        if (shouldLog) {
          try {
            const code = error && error.name === "AbortError" ? "ABORT" : "ERR";
            logLine(`⊘ ${String(uri)} → ${code}`, "red", {bright: true});
          } catch (_) {}
        }
        return null;
      }
      if (shouldLog) {
        try {
          if (res && res.ok) {
            logLine(`↓ ${String(uri)} → ${res.status}`, "yellow", {
              bright: true,
            });
          } else {
            const code = res ? res.status : "ERR";
            logLine(`⊘ ${String(uri)} → ${code}`, "red", {bright: true});
          }
        } catch (_) {}
      }
      if (!res || !res.ok) return null;
      return await res.json();
    }
    const p = uri.startsWith("file://") ? new URL(uri) : {pathname: uri};
    const localPath = uri.startsWith("file://")
      ? p.pathname
      : path.resolve(String(p.pathname));
    return await readJson(localPath);
  } catch (_) {
    return null;
  }
}

function computeHash(obj) {
  try {
    const json = JSON.stringify(deepSort(obj));
    return crypto.createHash("sha256").update(json).digest("hex");
  } catch (_) {
    return "";
  }
}

function deepSort(value) {
  if (Array.isArray(value)) return value.map(deepSort);
  if (value && typeof value === "object") {
    const out = {};
    for (const key of Object.keys(value).sort())
      out[key] = deepSort(value[key]);
    return out;
  }
  return value;
}

async function loadManifestIndex() {
  try {
    // Try primary path first
    if (fs.existsSync(IIIF_CACHE_INDEX)) {
      const idx = await readJson(IIIF_CACHE_INDEX);
      if (idx && typeof idx === "object") {
        const byId = Array.isArray(idx.byId)
          ? idx.byId
          : idx.byId && typeof idx.byId === "object"
            ? Object.keys(idx.byId).map((k) => ({
                id: k,
                type: "Manifest",
                slug: String(idx.byId[k] || ""),
                parent: (idx.parents && idx.parents[k]) || "",
              }))
            : [];
        return {byId, collection: idx.collection || null};
      }
    }
    // Legacy index location retained for backward compatibility
    if (fs.existsSync(IIIF_CACHE_INDEX_LEGACY)) {
      const idx = await readJson(IIIF_CACHE_INDEX_LEGACY);
      if (idx && typeof idx === "object") {
        const byId = Array.isArray(idx.byId)
          ? idx.byId
          : idx.byId && typeof idx.byId === "object"
            ? Object.keys(idx.byId).map((k) => ({
                id: k,
                type: "Manifest",
                slug: String(idx.byId[k] || ""),
                parent: (idx.parents && idx.parents[k]) || "",
              }))
            : [];
        return {byId, collection: idx.collection || null};
      }
    }
    // Legacy manifests index retained for backward compatibility
    if (fs.existsSync(IIIF_CACHE_INDEX_MANIFESTS)) {
      const idx = await readJson(IIIF_CACHE_INDEX_MANIFESTS);
      if (idx && typeof idx === "object") {
        const byId = Array.isArray(idx.byId)
          ? idx.byId
          : idx.byId && typeof idx.byId === "object"
            ? Object.keys(idx.byId).map((k) => ({
                id: k,
                type: "Manifest",
                slug: String(idx.byId[k] || ""),
                parent: (idx.parents && idx.parents[k]) || "",
              }))
            : [];
        return {byId, collection: idx.collection || null};
      }
    }
  } catch (_) {}
  return {byId: [], collection: null};
}

async function saveManifestIndex(index) {
  try {
    ensureDirSync(IIIF_CACHE_DIR);
    const out = {
      byId: Array.isArray(index.byId) ? index.byId : [],
      collection: index.collection || null,
      // Optional build/search version; consumers may ignore
      version: index.version || undefined,
    };
    await fsp.writeFile(IIIF_CACHE_INDEX, JSON.stringify(out, null, 2), "utf8");
    // Remove legacy files to avoid confusion
    try {
      await fsp.rm(IIIF_CACHE_INDEX_LEGACY, {force: true});
    } catch (_) {}
    try {
      await fsp.rm(IIIF_CACHE_INDEX_MANIFESTS, {force: true});
    } catch (_) {}
  } catch (_) {}
}

// In-memory memo to avoid repeated FS scans when index mapping is missing
const MEMO_ID_TO_SLUG = new Map();
// Track slugs chosen during this run to avoid collisions when multiple
// collections/manifests share the same base title but mappings aren't yet saved.
const RESERVED_SLUGS = {Manifest: new Set(), Collection: new Set()};

function resetReservedSlugs() {
  try {
    Object.keys(RESERVED_SLUGS).forEach((key) => {
      const set = RESERVED_SLUGS[key];
      if (set && typeof set.clear === "function") set.clear();
    });
  } catch (_) {}
}

function computeUniqueSlug(index, baseSlug, id, type) {
  const byId = Array.isArray(index && index.byId) ? index.byId : [];
  const normId = normalizeIiifId(String(id || ""));
  const fallbackBase = type === "Manifest" ? "untitled" : "collection";
  const normalizedBase = normalizeSlugBase(
    baseSlug || fallbackBase,
    fallbackBase,
  );
  const used = new Set(
    byId
      .filter((e) => e && e.slug && e.type === type)
      .map((e) => String(e.slug)),
  );
  const reserved = RESERVED_SLUGS[type] || new Set();
  let slug = normalizedBase;
  let i = 1;
  for (;;) {
    const existing = byId.find(
      (e) => e && e.type === type && String(e.slug) === String(slug),
    );
    if (existing) {
      // If this slug already maps to this id, reuse it and reserve.
      if (normalizeIiifId(existing.id) === normId) {
        reserved.add(slug);
        return slug;
      }
    }
    if (!used.has(slug) && !reserved.has(slug)) {
      reserved.add(slug);
      return slug;
    }
    slug = buildSlugWithSuffix(normalizedBase, fallbackBase, i++);
  }
}

function ensureBaseSlugFor(index, baseSlug, id, type) {
  try {
    const byId = Array.isArray(index && index.byId) ? index.byId : [];
    const normId = normalizeIiifId(String(id || ""));
    const fallbackBase = type === "Manifest" ? "untitled" : "collection";
    const normalizedBase = normalizeSlugBase(
      baseSlug || fallbackBase,
      fallbackBase,
    );
    const existingWithBase = byId.find(
      (e) => e && e.type === type && String(e.slug) === String(normalizedBase),
    );
    if (existingWithBase && normalizeIiifId(existingWithBase.id) !== normId) {
      // Reassign the existing entry to the next available suffix to free the base
      const newSlug = computeUniqueSlug(
        index,
        normalizedBase,
        existingWithBase.id,
        type,
      );
      if (newSlug && newSlug !== normalizedBase)
        existingWithBase.slug = newSlug;
    }
  } catch (_) {}
  return baseSlug;
}

async function findSlugByIdFromDisk(id) {
  try {
    if (!fs.existsSync(IIIF_CACHE_MANIFESTS_DIR)) return null;
    const files = await fsp.readdir(IIIF_CACHE_MANIFESTS_DIR);
    for (const name of files) {
      if (!name || !name.toLowerCase().endsWith(".json")) continue;
      const p = path.join(IIIF_CACHE_MANIFESTS_DIR, name);
      try {
        const raw = await fsp.readFile(p, "utf8");
        const obj = JSON.parse(raw);
        const mid = normalizeIiifId(
          String((obj && (obj.id || obj["@id"])) || ""),
        );
        if (mid && mid === normalizeIiifId(String(id))) {
          const slug = name.replace(/\.json$/i, "");
          return slug;
        }
      } catch (_) {}
    }
  } catch (_) {}
  return null;
}

async function loadCachedManifestById(id) {
  if (!id) return null;
  try {
    const index = await loadManifestIndex();
    let slug = null;
    if (Array.isArray(index.byId)) {
      const nid = normalizeIiifId(id);
      const entry = index.byId.find(
        (e) => e && normalizeIiifId(e.id) === nid && e.type === "Manifest",
      );
      slug = entry && entry.slug;
    }
    if (isSlugTooLong(slug)) slug = null;
    if (!slug) {
      // Try an on-disk scan to recover mapping if index is missing/out-of-sync
      const memo = MEMO_ID_TO_SLUG.get(String(id));
      if (memo) slug = memo;
      if (isSlugTooLong(slug)) slug = null;
      if (!slug) {
        const found = await findSlugByIdFromDisk(id);
        if (found && !isSlugTooLong(found)) {
          slug = found;
          MEMO_ID_TO_SLUG.set(String(id), slug);
          try {
            // Heal index mapping for future runs
            index.byId = Array.isArray(index.byId) ? index.byId : [];
            const nid = normalizeIiifId(id);
            const existingEntryIdx = index.byId.findIndex(
              (e) =>
                e && normalizeIiifId(e.id) === nid && e.type === "Manifest",
            );
            const entry = {
              id: String(nid),
              type: "Manifest",
              slug,
              parent: "",
            };
            applyManifestEntryCanonical(entry, null, slug, getDefaultRoute("works"));
            if (existingEntryIdx >= 0) index.byId[existingEntryIdx] = entry;
            else index.byId.push(entry);
            await saveManifestIndex(index);
          } catch (_) {}
        }
      }
    }
    if (!slug) return null;
    const p = path.join(IIIF_CACHE_MANIFESTS_DIR, slug + ".json");
    if (!fs.existsSync(p)) return null;
    const raw = await readJson(p);
    const {manifest: normalized, changed} =
      await ensurePresentation3Manifest(raw);
    if (changed) {
      try {
        await fsp.writeFile(p, JSON.stringify(normalized, null, 2), "utf8");
      } catch (_) {}
    }
    try {
      index.byId = Array.isArray(index.byId) ? index.byId : [];
      const nid = normalizeIiifId(id);
      const existingEntryIdx = index.byId.findIndex(
        (e) => e && normalizeIiifId(e.id) === nid && e.type === "Manifest",
      );
      if (existingEntryIdx >= 0) {
        const entry = index.byId[existingEntryIdx];
        const prevCanonical =
          entry && entry.canonical ? String(entry.canonical) : "";
        const nextCanonical = applyManifestEntryCanonical(
          entry,
          normalized,
          slug,
          getDefaultRoute("works"),
        );
        if (nextCanonical !== prevCanonical) {
          await saveManifestIndex(index);
        }
      }
    } catch (_) {}
    return normalized;
  } catch (_) {
    return null;
  }
}

async function saveCachedManifest(manifest, id, parentId) {
  const {manifest: normalizedManifest} =
    await ensurePresentation3Manifest(manifest);
  try {
    const index = await loadManifestIndex();
    const title = firstLabelString(
      normalizedManifest && normalizedManifest.label,
    );
    const baseSlug =
      slugify(title || "untitled", {lower: true, strict: true, trim: true}) ||
      "untitled";
    const slug = computeUniqueSlug(index, baseSlug, id, "Manifest");
    ensureDirSync(IIIF_CACHE_MANIFESTS_DIR);
    const dest = path.join(IIIF_CACHE_MANIFESTS_DIR, slug + ".json");
    await fsp.writeFile(
      dest,
      JSON.stringify(normalizedManifest, null, 2),
      "utf8",
    );
    index.byId = Array.isArray(index.byId) ? index.byId : [];
    const nid = normalizeIiifId(id);
    const existingEntryIdx = index.byId.findIndex(
      (e) => e && normalizeIiifId(e.id) === nid && e.type === "Manifest",
    );
    const entry = {
      id: String(nid),
      type: "Manifest",
      slug,
      parent: parentId ? String(parentId) : "",
    };
    applyManifestEntryCanonical(entry, normalizedManifest, slug, getDefaultRoute("works"));
    if (existingEntryIdx >= 0) index.byId[existingEntryIdx] = entry;
    else index.byId.push(entry);
    await saveManifestIndex(index);
    return normalizedManifest;
  } catch (_) {
    return normalizedManifest;
  }
}

// Ensure any configured featured manifests are present in the local cache
// (and have thumbnails computed) so interstitial heroes can read them.
async function ensureFeaturedInCache(cfg) {
  try {
    const CONFIG = cfg || (await loadConfig());
    const featured = Array.isArray(CONFIG && CONFIG.featured)
      ? CONFIG.featured
      : [];
    if (!featured.length) return;
    const {size: thumbSize, unsafe: unsafeThumbs} =
      resolveThumbnailPreferences();
    const fetchTimeoutMs = resolvePositiveInteger(
      process.env.CANOPY_FEATURED_FETCH_TIMEOUT_MS,
      DEFAULT_FEATURED_FETCH_TIMEOUT_MS,
      {allowZero: true},
    );
    const canAbortFetches =
      typeof AbortController === "function" && Number(fetchTimeoutMs) > 0;
    for (const rawId of featured) {
      const id = normalizeIiifId(String(rawId || ""));
      if (!id) continue;
      let manifest = await loadCachedManifestById(id);
      if (!manifest) {
        let controller = null;
        let timeoutId = null;
        let fetched = null;
        try {
          if (canAbortFetches) {
            controller = new AbortController();
            timeoutId = setTimeout(
              () => controller.abort(),
              Math.max(1, fetchTimeoutMs),
            );
          }
          fetched = await readJsonFromUri(id, {
            log: true,
            signal: controller ? controller.signal : undefined,
          });
        } catch (_) {
          fetched = null;
        } finally {
          if (timeoutId) clearTimeout(timeoutId);
        }
        if (!fetched) {
          if (controller && controller.signal && controller.signal.aborted) {
            try {
              logLine(
                `[iiif] Featured manifest timed out after ${formatDurationMs(
                  fetchTimeoutMs,
                )}: ${id}`,
                "red",
                {dim: true},
              );
            } catch (_) {}
          }
          continue;
        }
        const upgraded = await upgradeIiifResource(fetched);
        if (!upgraded || !upgraded.id) continue;
        manifest = (await saveCachedManifest(upgraded, id, "")) || upgraded;
        manifest = (await loadCachedManifestById(id)) || manifest;
      }
      // Ensure thumbnail fields exist in index for this manifest (if computable)
      try {
        const t = await getThumbnail(manifest, thumbSize, unsafeThumbs);
        const idx = await loadManifestIndex();
        if (!Array.isArray(idx.byId)) continue;
        const entry = idx.byId.find(
          (e) =>
            e &&
            e.type === "Manifest" &&
            normalizeIiifId(String(e.id)) ===
              normalizeIiifId(String(manifest.id)),
        );
        if (!entry) continue;

        let touched = false;
        if (t && t.url) {
          const nextUrl = String(t.url);
          if (entry.thumbnail !== nextUrl) {
            entry.thumbnail = nextUrl;
            touched = true;
          }
          if (typeof t.width === "number") {
            if (entry.thumbnailWidth !== t.width) touched = true;
            entry.thumbnailWidth = t.width;
          }
          if (typeof t.height === "number") {
            if (entry.thumbnailHeight !== t.height) touched = true;
            entry.thumbnailHeight = t.height;
          }
        }

        try {
          const heroMedia = await resolveHeroMedia(manifest);
          if (heroMedia && heroMedia.heroThumbnail) {
            if (entry.heroThumbnail !== heroMedia.heroThumbnail) {
              entry.heroThumbnail = heroMedia.heroThumbnail;
              touched = true;
            }
          } else if (entry.heroThumbnail !== undefined) {
            delete entry.heroThumbnail;
            touched = true;
          }
          if (heroMedia && typeof heroMedia.heroThumbnailWidth === "number") {
            if (entry.heroThumbnailWidth !== heroMedia.heroThumbnailWidth)
              touched = true;
            entry.heroThumbnailWidth = heroMedia.heroThumbnailWidth;
          } else if (entry.heroThumbnailWidth !== undefined) {
            delete entry.heroThumbnailWidth;
            touched = true;
          }
          if (heroMedia && typeof heroMedia.heroThumbnailHeight === "number") {
            if (entry.heroThumbnailHeight !== heroMedia.heroThumbnailHeight)
              touched = true;
            entry.heroThumbnailHeight = heroMedia.heroThumbnailHeight;
          } else if (entry.heroThumbnailHeight !== undefined) {
            delete entry.heroThumbnailHeight;
            touched = true;
          }
          if (heroMedia && heroMedia.heroThumbnailSrcset) {
            if (entry.heroThumbnailSrcset !== heroMedia.heroThumbnailSrcset)
              touched = true;
            entry.heroThumbnailSrcset = heroMedia.heroThumbnailSrcset;
            if (entry.heroThumbnailSizes !== HERO_IMAGE_SIZES_ATTR)
              touched = true;
            entry.heroThumbnailSizes = HERO_IMAGE_SIZES_ATTR;
          } else {
            if (entry.heroThumbnailSrcset !== undefined) {
              delete entry.heroThumbnailSrcset;
              touched = true;
            }
            if (entry.heroThumbnailSizes !== undefined) {
              delete entry.heroThumbnailSizes;
              touched = true;
            }
          }
          if (heroMedia && heroMedia.ogImage) {
            if (entry.ogImage !== heroMedia.ogImage) {
              entry.ogImage = heroMedia.ogImage;
              touched = true;
            }
            if (typeof heroMedia.ogImageWidth === "number") {
              if (entry.ogImageWidth !== heroMedia.ogImageWidth) touched = true;
              entry.ogImageWidth = heroMedia.ogImageWidth;
            } else if (entry.ogImageWidth !== undefined) {
              delete entry.ogImageWidth;
              touched = true;
            }
            if (typeof heroMedia.ogImageHeight === "number") {
              if (entry.ogImageHeight !== heroMedia.ogImageHeight)
                touched = true;
              entry.ogImageHeight = heroMedia.ogImageHeight;
            } else if (entry.ogImageHeight !== undefined) {
              delete entry.ogImageHeight;
              touched = true;
            }
          } else if (entry.ogImage !== undefined) {
            delete entry.ogImage;
            if (entry.ogImageWidth !== undefined) delete entry.ogImageWidth;
            if (entry.ogImageHeight !== undefined) delete entry.ogImageHeight;
            touched = true;
          }
          if (
            ensureThumbnailValue(
              entry,
              heroMedia && heroMedia.heroThumbnail,
              heroMedia && heroMedia.heroThumbnailWidth,
              heroMedia && heroMedia.heroThumbnailHeight,
            )
          ) {
            touched = true;
          }
        } catch (_) {}

        if (touched) await saveManifestIndex(idx);
      } catch (_) {}
    }
  } catch (err) {
    const message = err && err.message ? err.message : err;
    throw new Error(`[iiif] Failed to populate featured cache: ${message}`);
  }
}

async function flushManifestCache() {
  try {
    await fsp.rm(IIIF_CACHE_MANIFESTS_DIR, {recursive: true, force: true});
  } catch (_) {}
  ensureDirSync(IIIF_CACHE_MANIFESTS_DIR);
  ensureDirSync(IIIF_CACHE_COLLECTIONS_DIR);
  try {
    await fsp.rm(IIIF_CACHE_COLLECTIONS_DIR, {recursive: true, force: true});
  } catch (_) {}
  ensureDirSync(IIIF_CACHE_COLLECTIONS_DIR);
}

// Collections cache helpers
async function loadCachedCollectionById(id) {
  if (!id) return null;
  try {
    const index = await loadManifestIndex();
    let slug = null;
    if (Array.isArray(index.byId)) {
      const nid = normalizeIiifId(id);
      const entry = index.byId.find(
        (e) => e && normalizeIiifId(e.id) === nid && e.type === "Collection",
      );
      slug = entry && entry.slug;
    }
    if (isSlugTooLong(slug)) slug = null;
    if (!slug) {
      // Scan collections dir if mapping missing
      try {
        if (fs.existsSync(IIIF_CACHE_COLLECTIONS_DIR)) {
          const files = await fsp.readdir(IIIF_CACHE_COLLECTIONS_DIR);
          for (const name of files) {
            if (!name || !name.toLowerCase().endsWith(".json")) continue;
            const p = path.join(IIIF_CACHE_COLLECTIONS_DIR, name);
            try {
              const raw = await fsp.readFile(p, "utf8");
              const obj = JSON.parse(raw);
              const cid = normalizeIiifId(
                String((obj && (obj.id || obj["@id"])) || ""),
              );
              if (cid && cid === normalizeIiifId(String(id))) {
                const candidate = name.replace(/\.json$/i, "");
                if (isSlugTooLong(candidate)) {
                  slug = null;
                  break;
                }
                slug = candidate;
                // heal mapping
                try {
                  index.byId = Array.isArray(index.byId) ? index.byId : [];
                  const nid = normalizeIiifId(id);
                  const existing = index.byId.findIndex(
                    (e) =>
                      e &&
                      normalizeIiifId(e.id) === nid &&
                      e.type === "Collection",
                  );
                  const entry = {
                    id: String(nid),
                    type: "Collection",
                    slug,
                    parent: "",
                  };
                  applyCollectionEntryCanonical(entry, null);
                  if (existing >= 0) index.byId[existing] = entry;
                  else index.byId.push(entry);
                  await saveManifestIndex(index);
                } catch (_) {}
                break;
              }
            } catch (_) {}
          }
        }
      } catch (_) {}
    }
    if (!slug) return null;
    const p = path.join(IIIF_CACHE_COLLECTIONS_DIR, slug + ".json");
    if (!fs.existsSync(p)) return null;
    const data = await readJson(p);
    try {
      index.byId = Array.isArray(index.byId) ? index.byId : [];
      const nid = normalizeIiifId(id);
      const existingEntryIdx = index.byId.findIndex(
        (e) => e && normalizeIiifId(e.id) === nid && e.type === "Collection",
      );
      if (existingEntryIdx >= 0) {
        const entry = index.byId[existingEntryIdx];
        const prevCanonical =
          entry && entry.canonical ? String(entry.canonical) : "";
        const nextCanonical = applyCollectionEntryCanonical(entry, data);
        if (nextCanonical !== prevCanonical) {
          await saveManifestIndex(index);
        }
      }
    } catch (_) {}
    return data;
  } catch (_) {
    return null;
  }
}

async function saveCachedCollection(collection, id, parentId) {
  try {
    const normalizedCollection = await upgradeIiifResource(collection);
    ensureDirSync(IIIF_CACHE_COLLECTIONS_DIR);
    const index = await loadManifestIndex();
    const title = firstLabelString(
      normalizedCollection && normalizedCollection.label,
    );
    const baseSlug =
      slugify(title || "collection", {
        lower: true,
        strict: true,
        trim: true,
      }) || "collection";
    const slug = computeUniqueSlug(index, baseSlug, id, "Collection");
    const dest = path.join(IIIF_CACHE_COLLECTIONS_DIR, slug + ".json");
    await fsp.writeFile(
      dest,
      JSON.stringify(normalizedCollection, null, 2),
      "utf8",
    );
    try {
      if (process.env.CANOPY_IIIF_DEBUG === "1") {
        const {logLine} = require("./log");
        logLine(`IIIF: saved collection → ${slug}.json`, "cyan", {dim: true});
      }
    } catch (_) {}
    index.byId = Array.isArray(index.byId) ? index.byId : [];
    const nid = normalizeIiifId(id);
    const existingEntryIdx = index.byId.findIndex(
      (e) => e && normalizeIiifId(e.id) === nid && e.type === "Collection",
    );
    const entry = {
      id: String(nid),
      type: "Collection",
      slug,
      parent: parentId ? String(parentId) : "",
    };
    applyCollectionEntryCanonical(entry, normalizedCollection);
    if (existingEntryIdx >= 0) index.byId[existingEntryIdx] = entry;
    else index.byId.push(entry);
    await saveManifestIndex(index);
  } catch (_) {}
}

async function cleanupIiifCache(options = {}) {
  const allowedManifestIds = Array.isArray(options.allowedManifestIds)
    ? options.allowedManifestIds
    : [];
  const allowedCollectionIds = Array.isArray(options.allowedCollectionIds)
    ? options.allowedCollectionIds
    : [];
  const keepManifestIds = Array.isArray(options.keepManifestIds)
    ? options.keepManifestIds
    : [];
  const manifestSet = new Set(
    allowedManifestIds
      .map((id) => normalizeIiifId(String(id || "")))
      .filter(Boolean),
  );
  for (const keepId of keepManifestIds) {
    const normalized = normalizeIiifId(String(keepId || ""));
    if (normalized) manifestSet.add(normalized);
  }
  const collectionSet = new Set(
    allowedCollectionIds
      .map((id) => normalizeIiifId(String(id || "")))
      .filter(Boolean),
  );
  if (!manifestSet.size && !collectionSet.size) return;

  let removedManifestFiles = 0;
  if (fs.existsSync(IIIF_CACHE_MANIFESTS_DIR)) {
    const files = await fsp.readdir(IIIF_CACHE_MANIFESTS_DIR);
    for (const name of files) {
      if (!name || !name.toLowerCase().endsWith(".json")) continue;
      const fp = path.join(IIIF_CACHE_MANIFESTS_DIR, name);
      let manifest = null;
      try {
        manifest = await readJson(fp);
      } catch (_) {}
      const nid = normalizeIiifId(
        String(
          (manifest && (manifest.id || manifest["@id"])) ||
            name.replace(/\.json$/i, ""),
        ),
      );
      if (!manifestSet.has(nid)) {
        try {
          await fsp.rm(fp, {force: true});
          removedManifestFiles += 1;
        } catch (_) {}
      }
    }
  }

  let removedCollectionFiles = 0;
  if (fs.existsSync(IIIF_CACHE_COLLECTIONS_DIR)) {
    const files = await fsp.readdir(IIIF_CACHE_COLLECTIONS_DIR);
    for (const name of files) {
      if (!name || !name.toLowerCase().endsWith(".json")) continue;
      const fp = path.join(IIIF_CACHE_COLLECTIONS_DIR, name);
      let collection = null;
      try {
        collection = await readJson(fp);
      } catch (_) {}
      const nid = normalizeIiifId(
        String(
          (collection && (collection.id || collection["@id"])) ||
            name.replace(/\.json$/i, ""),
        ),
      );
      if (!collectionSet.has(nid)) {
        try {
          await fsp.rm(fp, {force: true});
          removedCollectionFiles += 1;
        } catch (_) {}
      }
    }
  }

  try {
    const index = await loadManifestIndex();
    if (Array.isArray(index.byId)) {
      index.byId = index.byId.filter((entry) => {
        if (!entry || !entry.id) return false;
        const nid = normalizeIiifId(String(entry.id));
        if (entry.type === "Manifest") return manifestSet.has(nid);
        if (entry.type === "Collection") return collectionSet.has(nid);
        return true;
      });
      await saveManifestIndex(index);
    }
  } catch (_) {}

  try {
    logLine(
      `• Cleaned IIIF cache (${removedManifestFiles} Manifest file(s) removed, ${removedCollectionFiles} Collection file(s) removed)`,
      "blue",
      {dim: true},
    );
  } catch (_) {}
}

async function loadConfig() {
  const cfgPath = resolveCanopyConfigPath();
  if (!fs.existsSync(cfgPath)) return {};
  const raw = await fsp.readFile(cfgPath, "utf8");
  let cfg = {};
  try {
    cfg = yaml.load(raw) || {};
  } catch (_) {
    cfg = {};
  }
  return cfg || {};
}

// Traverse IIIF collection, cache manifests/collections, and render pages
async function buildIiifCollectionPages(CONFIG) {
  const cfg = CONFIG || (await loadConfig());

  const {collections: collectionUris, manifests: manifestUris} =
    resolveIiifSources(cfg);
  if (!collectionUris.length && !manifestUris.length) return {iiifRecords: []};

  const searchIndexCfg = (cfg && cfg.search && cfg.search.index) || {};
  const metadataCfg = (searchIndexCfg && searchIndexCfg.metadata) || {};
  const summaryCfg = (searchIndexCfg && searchIndexCfg.summary) || {};
  const annotationsCfg = (searchIndexCfg && searchIndexCfg.annotations) || {};
  const metadataEnabled =
    metadataCfg && Object.prototype.hasOwnProperty.call(metadataCfg, "enabled")
      ? resolveBoolean(metadataCfg.enabled)
      : true;
  const summaryEnabled =
    summaryCfg && Object.prototype.hasOwnProperty.call(summaryCfg, "enabled")
      ? resolveBoolean(summaryCfg.enabled)
      : true;
  const annotationsEnabled =
    annotationsCfg &&
    Object.prototype.hasOwnProperty.call(annotationsCfg, "enabled")
      ? resolveBoolean(annotationsCfg.enabled)
      : false;
  const metadataIncludeAll = metadataEnabled && resolveBoolean(metadataCfg.all);
  const metadataLabelsRaw = Array.isArray(cfg && cfg.metadata)
    ? cfg.metadata
    : [];
  const metadataLabelsNormalized = metadataLabelsRaw
    .map((label) => normalizeMetadataLabel(String(label || "")))
    .filter(Boolean);
  const metadataLabelSet = new Set(metadataLabelsNormalized);
  const metadataFacetLabels = (() => {
    if (!Array.isArray(metadataLabelsRaw) || !metadataLabelsRaw.length)
      return [];
    const seen = new Set();
    const entries = [];
    for (const label of metadataLabelsRaw) {
      const raw =
        typeof label === "string" ? label.trim() : String(label || "");
      if (!raw) continue;
      const normalized = normalizeMetadataLabel(raw);
      if (!normalized || seen.has(normalized)) continue;
      const slug = slugify(raw, {lower: true, strict: true, trim: true});
      if (!slug) continue;
      seen.add(normalized);
      entries.push({label: raw, slug, normalized});
    }
    return entries;
  })();
  const metadataLabelSlugMap = new Map();
  for (const entry of metadataFacetLabels) {
    if (!entry || !entry.normalized) continue;
    metadataLabelSlugMap.set(entry.normalized, entry.slug || "");
  }
  const metadataOptions = {
    enabled:
      metadataEnabled &&
      (metadataIncludeAll || (metadataLabelSet && metadataLabelSet.size > 0)),
    includeAll: metadataIncludeAll,
    labelsSet: metadataIncludeAll ? null : metadataLabelSet,
  };
  const metadataIndexMap = new Map();
  const metadataDynamicOrder = [];
  const metadataDynamicOrderSet = new Set();
  const metadataCollectAllLabels = metadataLabelsNormalized.length === 0;
  function recordMetadataIndexEntry(entry) {
    if (!entry || !entry.normalized || !Array.isArray(entry.values)) return;
    if (!entry.values.length) return;
    const normalized = entry.normalized;
    if (!metadataCollectAllLabels && !metadataLabelSet.has(normalized)) return;
    let record = metadataIndexMap.get(normalized);
    const labelText = entry.label || normalized;
    if (!record) {
      const labelSlug =
        metadataLabelSlugMap.get(normalized) ||
        slugify(labelText, {lower: true, strict: true, trim: true}) ||
        normalized;
      record = {
        normalized,
        label: labelText,
        slug: labelSlug || normalized,
        values: new Map(),
      };
      metadataIndexMap.set(normalized, record);
      if (metadataCollectAllLabels && !metadataDynamicOrderSet.has(normalized)) {
        metadataDynamicOrderSet.add(normalized);
        metadataDynamicOrder.push(normalized);
      }
    } else if (!record.label && labelText) {
      record.label = labelText;
    }
    const valueMap = record.values;
    for (const text of entry.values) {
      const trimmed = String(text || "").trim();
      if (!trimmed) continue;
      const valueSlug =
        slugify(trimmed, {lower: true, strict: true, trim: true}) ||
        trimmed.toLowerCase().replace(/[^a-z0-9]+/g, "-") ||
        trimmed;
      if (!valueSlug) continue;
      if (valueMap.has(valueSlug)) {
        valueMap.get(valueSlug).count += 1;
      } else {
        valueMap.set(valueSlug, {value: trimmed, slug: valueSlug, count: 1});
      }
    }
  }

  const summaryOptions = {
    enabled: summaryEnabled,
  };
  const annotationMotivations = new Set(
    normalizeStringList(annotationsCfg && annotationsCfg.motivation).map((m) =>
      m.toLowerCase(),
    ),
  );
  const annotationsOptions = {
    enabled: annotationsEnabled,
    motivations: annotationMotivations,
  };

  // Recursively traverse Collections and gather all Manifest tasks
  const tasks = [];
  let manifestTasksFromCollections = 0;
  let manifestTasksFromConfig = 0;
  const queuedManifestIds = new Set();
  const visitedCollections = new Set(); // normalized ids
  const renderedManifestIds = new Set();
  const norm = (x) => {
    try {
      return normalizeIiifId(String(x || ""));
    } catch (_) {
      return String(x || "");
    }
  };
  async function gatherFromCollection(colLike, parentId) {
    try {
      // Resolve the URI we were asked to fetch. Some providers (e.g. Internet Archive)
      // return paged collections where the JSON payload's `id` does not match the
      // URI that served it. We rely on the requested URI as the stable, unique key
      // so pagination continues even when `id` flips back to the root collection.
      const uri =
        typeof colLike === "string"
          ? colLike
          : (colLike && (colLike.id || colLike["@id"])) || "";
      const col =
        typeof colLike === "object" && colLike && colLike.items
          ? colLike
          : await readJsonFromUri(uri, {log: true});
      if (!col) return;
      const ncol = await upgradeIiifResource(col);
      const reportedId = String(
        (ncol && (ncol.id || ncol["@id"])) ||
          (typeof colLike === "object" && (colLike.id || colLike["@id"])) ||
          "",
      );
      const effectiveId = String(uri || reportedId || "");
      const collectionKey = effectiveId || reportedId || uri || "";
      const visitKey = norm(collectionKey) || collectionKey;
      if (visitedCollections.has(visitKey)) return; // avoid cycles
      visitedCollections.add(visitKey);
      try {
        await saveCachedCollection(ncol, collectionKey, parentId || "");
      } catch (_) {}
      const childEntries = extractCollectionEntries(ncol);
      for (const entry of childEntries) {
        const entryId = entry && entry.id;
        if (!entryId) continue;
        const entryType = normalizeIiifType(entry.type || entry.fallback || "");
        const dedupeKey = norm(entryId) || String(entryId || "");
        if (!dedupeKey) continue;
        if (entryType === "manifest") {
          if (queuedManifestIds.has(dedupeKey)) continue;
          queuedManifestIds.add(dedupeKey);
          tasks.push({id: entryId, parent: collectionKey});
          manifestTasksFromCollections += 1;
        } else if (entryType === "collection") {
          await gatherFromCollection(entry.raw || entryId, collectionKey);
        }
      }
      // Handle IIIF Presentation 2 paged collections (first/next pattern).
      // The root of a paged v2 collection carries a `first` link instead of
      // embedding items; each page carries a `next` link to the following page.
      const resolvePageUrl = (val) => {
        if (!val) return "";
        if (typeof val === "string") return val.trim();
        const id = val["@id"] || val.id;
        return typeof id === "string" ? id.trim() : "";
      };
      // Start from `first` if present (root collection), otherwise `next` (current is a page).
      let pageUrl =
        resolvePageUrl(col && col.first) ||
        resolvePageUrl(ncol && ncol.first) ||
        resolvePageUrl(col && col.next) ||
        resolvePageUrl(ncol && ncol.next);
      while (pageUrl) {
        const pageKey = norm(pageUrl) || pageUrl;
        if (visitedCollections.has(pageKey)) break;
        visitedCollections.add(pageKey);
        const page = await readJsonFromUri(pageUrl, {log: true});
        if (!page) break;
        const npage = await upgradeIiifResource(page);
        const pageEntries = extractCollectionEntries(npage);
        for (const entry of pageEntries) {
          const entryId = entry && entry.id;
          if (!entryId) continue;
          const entryType = normalizeIiifType(entry.type || entry.fallback || "");
          const dedupeKey = norm(entryId) || String(entryId || "");
          if (!dedupeKey) continue;
          if (entryType === "manifest") {
            if (queuedManifestIds.has(dedupeKey)) continue;
            queuedManifestIds.add(dedupeKey);
            tasks.push({id: entryId, parent: collectionKey});
            manifestTasksFromCollections += 1;
          } else if (entryType === "collection") {
            await gatherFromCollection(entry.raw || entryId, collectionKey);
          }
        }
        // Advance to the next page.
        pageUrl = resolvePageUrl((page && page.next) || (npage && npage.next));
      }
      // Traverse strictly by parent/child hierarchy (Presentation 3): items → Manifest or Collection
    } catch (_) {}
  }
  // Fetch each configured collection and queue manifests from all of them
  logLine("• Traversing IIIF Collection(s)", "blue", {dim: true});
  for (const uri of collectionUris) {
    let root = null;
    try {
      root = await readJsonFromUri(uri, {log: true});
    } catch (_) {
      root = null;
    }
    if (!root) {
      try {
        logLine(`IIIF: Failed to fetch collection → ${uri}`, "red");
      } catch (_) {}
      continue;
    }
    const normalizedRoot = await upgradeIiifResource(root);
    try {
      await saveCachedCollection(normalizedRoot, normalizedRoot.id || uri, "");
    } catch (_) {}
    await gatherFromCollection(normalizedRoot, "");
  }
  if (manifestUris.length) {
    for (const uri of manifestUris) {
      const dedupeKey = norm(uri) || String(uri || "");
      if (!dedupeKey || queuedManifestIds.has(dedupeKey)) continue;
      queuedManifestIds.add(dedupeKey);
      tasks.push({id: uri, parent: ""});
      manifestTasksFromConfig += 1;
    }
  }
  if (!tasks.length) return {iiifRecords: []};
  try {
    logLine(
      `• Processing ${tasks.length} Manifest(s) (${manifestTasksFromCollections} from collections, ${manifestTasksFromConfig} direct)`,
      "blue",
      {dim: true},
    );
  } catch (_) {}
  logDebug(
    `Queued ${tasks.length} Manifest task(s) (${manifestTasksFromCollections} from collections, ${manifestTasksFromConfig} direct)`,
  );

  // Split into chunks and process with limited concurrency
  const chunkSize = resolvePositiveInteger(
    process.env.CANOPY_CHUNK_SIZE,
    DEFAULT_CHUNK_SIZE,
  );
  const chunks = Math.ceil(tasks.length / chunkSize);
  const requestedConcurrency = resolvePositiveInteger(
    process.env.CANOPY_FETCH_CONCURRENCY,
    DEFAULT_FETCH_CONCURRENCY,
    {allowZero: true},
  );
  // Summary before processing chunks
  try {
    logLine(
      `• Fetching ${tasks.length} Manifest(s) in ${chunks} chunk(s)`,
      "blue",
      {dim: true},
    );
    const concurrencySummary =
      requestedConcurrency === 0
        ? "auto (no explicit cap)"
        : String(requestedConcurrency);
    logLine(`• Fetch concurrency: ${concurrencySummary}`, "blue", {dim: true});
  } catch (_) {}
  const iiifRecords = [];
  const navPlaceRecords = [];
  const {size: thumbSize, unsafe: unsafeThumbs} = resolveThumbnailPreferences();
  let workRouteEntries = getLocaleRouteEntries("works");
  if (!workRouteEntries.length) {
    workRouteEntries = [
      {
        locale: getDefaultLocaleCode(),
        route: getDefaultRoute("works"),
        isDefault: true,
      },
    ];
  }

  // Compile the works layout component once per run
  const worksLayoutPath = path.join(CONTENT_DIR, "works", "_layout.mdx");
  if (!fs.existsSync(worksLayoutPath)) {
    throw new Error(
      "IIIF build requires content/works/_layout.mdx. Create the layout instead of relying on generated output.",
    );
  }
  let WorksLayoutComp = null;
  try {
    WorksLayoutComp = await mdx.compileMdxToComponent(worksLayoutPath);
  } catch (err) {
    const message = err && err.message ? err.message : err;
    throw new Error(`Failed to compile content/works/_layout.mdx: ${message}`);
  }

  referenced.ensureReferenceIndex();

  const chunkMetrics = [];
  for (let ci = 0; ci < chunks; ci++) {
    const chunk = tasks.slice(ci * chunkSize, (ci + 1) * chunkSize);
    logLine(`• Chunk ${ci + 1}/${chunks}`, "blue", {dim: true});
    const chunkStart = Date.now();

    const concurrency =
      requestedConcurrency === 0
        ? Math.max(1, chunk.length)
        : requestedConcurrency;
    let next = 0;
    const logs = new Array(chunk.length);
    let nextPrint = 0;
    function tryFlush() {
      try {
        while (nextPrint < logs.length && logs[nextPrint]) {
          const lines = logs[nextPrint];
          for (const [txt, color, opts] of lines) {
            try {
              logLine(txt, color, opts);
            } catch (_) {}
          }
          logs[nextPrint] = null;
          nextPrint++;
        }
      } catch (_) {}
    }
    async function worker() {
      for (;;) {
        const it = chunk[next++];
        if (!it) break;
        const idx = next - 1;
        const id = it.id || it["@id"] || "";
        let manifest = await loadCachedManifestById(id);
        const lns = [];
        if (manifest) {
          lns.push([`↓ ${String(id)} → Cached`, "yellow"]);
        } else if (/^https?:\/\//i.test(String(id || ""))) {
          try {
            const res = await fetch(String(id), {
              headers: {Accept: "application/json"},
            }).catch(() => null);
            if (res && res.ok) {
              lns.push([`↓ ${String(id)} → ${res.status}`, "yellow"]);
              const remote = await res.json();
              manifest = await upgradeIiifResource(remote);
              const saved = await saveCachedManifest(
                manifest,
                String(id),
                String(it.parent || ""),
              );
              manifest = saved || manifest;
              const cached = await loadCachedManifestById(String(id));
              if (cached) manifest = cached;
            } else {
              lns.push([
                `⊘ ${String(id)} → ${res ? res.status : "ERR"}`,
                "red",
              ]);
              continue;
            }
          } catch (e) {
            lns.push([`⊘ ${String(id)} → ERR`, "red"]);
            continue;
          }
        } else if (/^file:\/\//i.test(String(id || ""))) {
          try {
            const local = await readJsonFromUri(String(id), {log: false});
            if (!local) {
              lns.push([`⊘ ${String(id)} → ERR`, "red"]);
              continue;
            }
            manifest = await upgradeIiifResource(local);
            const saved = await saveCachedManifest(
              manifest,
              String(id),
              String(it.parent || ""),
            );
            manifest = saved || manifest;
            const cached = await loadCachedManifestById(String(id));
            if (cached) manifest = cached;
            lns.push([`↓ ${String(id)} → Cached`, "yellow"]);
          } catch (_) {
            lns.push([`⊘ ${String(id)} → ERR`, "red"]);
            continue;
          }
        } else if (!/^[a-zA-Z][a-zA-Z0-9+\-.]*:/.test(String(id || ""))) {
          // Relative or bare file path (no scheme) — resolve against cwd
          try {
            const local = await readJsonFromUri(String(id), {log: false});
            if (!local) {
              lns.push([`⊘ ${String(id)} → ERR`, "red"]);
              continue;
            }
            manifest = await upgradeIiifResource(local);
            const saved = await saveCachedManifest(
              manifest,
              String(id),
              String(it.parent || ""),
            );
            manifest = saved || manifest;
            const cached = await loadCachedManifestById(String(id));
            if (cached) manifest = cached;
            lns.push([`↓ ${String(id)} → Cached`, "yellow"]);
          } catch (_) {
            lns.push([`⊘ ${String(id)} → ERR`, "red"]);
            continue;
          }
        } else {
          lns.push([`⊘ ${String(id)} → SKIP`, "red"]);
          continue;
        }
        if (!manifest) continue;
        const ensured = await ensurePresentation3Manifest(manifest);
        manifest = ensured.manifest;
        const title = firstLabelString(manifest.label);
        const manifestLabel = title || String(manifest.id || id);
        logDebug(`Preparing manifest ${manifestLabel}`);
        let summaryRaw = "";
        try {
          summaryRaw = extractSummaryValues(manifest);
        } catch (_) {
          summaryRaw = "";
        }
        const summaryForMeta = truncateSummary(summaryRaw || title);
        const baseSlug =
          slugify(title || "untitled", {
            lower: true,
            strict: true,
            trim: true,
          }) || "untitled";
        const nid = normalizeIiifId(String(manifest.id || id));
        let idxMap = await loadManifestIndex();
        idxMap.byId = Array.isArray(idxMap.byId) ? idxMap.byId : [];
        let mEntry = idxMap.byId.find(
          (e) => e && e.type === "Manifest" && normalizeIiifId(e.id) === nid,
        );
        let slug = mEntry && mEntry.slug;
        if (isSlugTooLong(slug)) slug = null;
        if (!slug) {
          slug = computeUniqueSlug(idxMap, baseSlug, nid, "Manifest");
          const parentNorm = normalizeIiifId(String(it.parent || ""));
          const newEntry = {
            id: nid,
            type: "Manifest",
            slug,
            parent: parentNorm,
          };
          applyManifestEntryCanonical(newEntry, manifest, slug);
          const existingIdx = idxMap.byId.findIndex(
            (e) => e && e.type === "Manifest" && normalizeIiifId(e.id) === nid,
          );
          if (existingIdx >= 0) idxMap.byId[existingIdx] = newEntry;
          else idxMap.byId.push(newEntry);
          await saveManifestIndex(idxMap);
          mEntry = newEntry;
        } else if (mEntry) {
          const prevCanonical = mEntry.canonical || "";
          const nextCanonical = applyManifestEntryCanonical(
            mEntry,
            manifest,
            slug,
          );
          if (nextCanonical !== prevCanonical) {
            await saveManifestIndex(idxMap);
          }
        }
        const manifestId = manifest && manifest.id ? manifest.id : id;
        const normalizedManifestId = normalizeIiifId(String(manifestId || id));
        if (normalizedManifestId) renderedManifestIds.add(normalizedManifestId);
        logDebug(`Resolved slug ${slug} for ${manifestLabel}`);
        const references = referenced.getReferencesForManifest(manifestId);
        for (const routeEntry of workRouteEntries) {
          const routeBase =
            routeEntry && routeEntry.route
              ? routeEntry.route
              : getDefaultRoute("works");
          const isDefaultRoute = routeEntry && routeEntry.isDefault === true;
          const localeFromRoute =
            routeEntry && routeEntry.locale
              ? routeEntry.locale
              : getDefaultLocaleCode();
          const href = buildRouteRelativePath(routeBase, `${slug}.html`);
          const outPath = path.join(OUT_DIR, href);
          ensureDirSync(path.dirname(outPath));
          try {
          let components = {};
          try {
            components = await mdx.loadUiComponents();
          } catch (_) {
            components = {};
          }
          const Anchor = function A(props) {
            let {href = "", ...rest} = props || {};
            href = withBase(href);
            return React.createElement("a", {href, ...rest}, props.children);
          };
          // Map exported UI components into MDX and add anchor helper
          const compMap = {...components, a: Anchor};
          let MDXProvider = null;
          try {
            const mod = await import("@mdx-js/react");
            MDXProvider = mod.MDXProvider || mod.default || null;
          } catch (_) {
            MDXProvider = null;
          }
          const app = await mdx.loadAppWrapper();

          let heroMedia = null;
          try {
            heroMedia = await resolveHeroMedia(manifest);
          } catch (_) {
            heroMedia = null;
          }
          const normalizedHref = href.split(path.sep).join("/");
          const pageHref = rootRelativeHref(normalizedHref);
          const pageLocale = localeFromRoute || resolveLocaleFromHref(pageHref);
          const pageDescription = summaryForMeta || title;
          const canonical = resolveManifestCanonical(manifest, slug, routeBase);
          const pageDetails = {
            title,
            href: pageHref,
            url: pageHref,
            slug,
            type: "work",
            description: pageDescription,
            manifestId,
            referencedBy: references,
            canonical,
            locale: pageLocale,
            meta: {
              title,
              description: pageDescription,
              type: "work",
              url: pageHref,
              canonical,
              locale: pageLocale,
            },
          };
          const ogImageForPage =
            heroMedia && heroMedia.ogImage ? heroMedia.ogImage : "";
          if (ogImageForPage) {
            pageDetails.image = ogImageForPage;
            pageDetails.ogImage = ogImageForPage;
            pageDetails.meta.image = ogImageForPage;
            pageDetails.meta.ogImage = ogImageForPage;
          }
          const navigationRoots = navigation.buildNavigationRoots(slug || "");
          const navigationContext =
            navigationRoots && Object.keys(navigationRoots).length
              ? {allRoots: navigationRoots}
              : null;
          const primaryNav = readPrimaryNavigation(pageLocale);
          const siteMeta = readSiteMetadata ? {...readSiteMetadata()} : null;
          const siteLanguageToggle = (() => {
            try {
              const data = readCanopyLocalesWithMessages();
              if (data && Array.isArray(data.locales) && data.locales.length) {
                return {locales: data.locales, messages: data.messages || {}};
              }
            } catch (_) {}
            return null;
          })();
          const siteContext = siteMeta ? {...siteMeta} : {};
          if (siteLanguageToggle) {
            siteContext.languageToggle = siteLanguageToggle;
          }
          try {
            const localeMessages = readLocaleMessages(pageLocale);
            if (localeMessages) siteContext.localeMessages = localeMessages;
          } catch (_) {}
          try {
            const localeRoutes = getLocaleRouteConfig(pageLocale);
            if (localeRoutes) siteContext.routes = localeRoutes;
          } catch (_) {}
          try {
            const defaultRoutes = getLocaleRouteConfig(getDefaultLocaleCode());
            if (defaultRoutes) siteContext.routesDefault = defaultRoutes;
          } catch (_) {}
          const pageContextValue = {
            navigation: navigationContext,
            page: pageDetails,
            site: siteContext && Object.keys(siteContext).length ? siteContext : null,
            primaryNavigation: Array.isArray(primaryNav) ? primaryNav : [],
          };
          if (
            metadataFacetLabels.length &&
            manifest &&
            typeof manifest === "object"
          ) {
            try {
              Object.defineProperty(manifest, "__canopyMetadataFacets", {
                configurable: true,
                enumerable: false,
                writable: true,
                value: metadataFacetLabels,
              });
            } catch (_) {
              manifest.__canopyMetadataFacets = metadataFacetLabels;
            }
          }
          const mdxContent = React.createElement(WorksLayoutComp, {
            manifest,
            references,
            manifestId,
          });
          const siteTree = mdxContent;
          const wrappedApp =
            app && app.App
              ? React.createElement(app.App, null, siteTree)
              : siteTree;
          const withContext =
            PageContext && pageContextValue
              ? React.createElement(
                  PageContext.Provider,
                  {value: pageContextValue},
                  wrappedApp,
                )
              : wrappedApp;
          const page = MDXProvider
            ? React.createElement(
                MDXProvider,
                {components: compMap},
                withContext,
              )
            : withContext;
          const body = ReactDOMServer.renderToStaticMarkup(page);
          let head = "";
          if (app && app.Head) {
            const headElement = React.createElement(app.Head, {
              page: pageContextValue.page,
              navigation: pageContextValue.navigation,
            });
            const wrappedHead = PageContext
              ? React.createElement(
                  PageContext.Provider,
                  {value: pageContextValue},
                  headElement,
                )
              : headElement;
            head = ReactDOMServer.renderToStaticMarkup(wrappedHead);
          }
          const needsHydrateViewer =
            body.includes("data-canopy-viewer") ||
            body.includes("data-canopy-scroll") ||
            body.includes("data-canopy-image");
          const needsRelated = body.includes("data-canopy-related-items");
          const needsImageStory = body.includes("data-canopy-image-story");
          const needsHeroSlider = body.includes("data-canopy-hero-slider");
          const needsTimeline = body.includes("data-canopy-timeline");
          const needsMap = body.includes("data-canopy-map");
          const needsSearchForm = body.includes("data-canopy-search-form");
          const needsCustomClients = body.includes(
            "data-canopy-client-component",
          );
          const needsHydrate =
            body.includes("data-canopy-hydrate") ||
            needsHydrateViewer ||
            needsRelated ||
            needsSearchForm;

          const viewerRel = needsHydrateViewer
            ? relativeRuntimeScript(outPath, "canopy-viewer.js", true)
            : null;
          const sliderRel = needsRelated
            ? relativeRuntimeScript(outPath, "canopy-slider.js", true)
            : null;
          const imageStoryRel = needsImageStory
            ? relativeRuntimeScript(outPath, "canopy-image-story.js", true)
            : null;
          const timelineRel = needsTimeline
            ? relativeRuntimeScript(outPath, "canopy-timeline.js", true)
            : null;
          const mapRel = needsMap
            ? relativeRuntimeScript(outPath, "canopy-map.js", true)
            : null;
          const mapCssRel = needsMap
            ? path
                .relative(
                  path.dirname(outPath),
                  path.join(OUT_DIR, "scripts", "canopy-map.css"),
                )
                .split(path.sep)
                .join("/")
            : null;
          const heroRel = needsHeroSlider
            ? relativeRuntimeScript(outPath, "canopy-hero-slider.js", true)
            : null;
          const relatedRel = needsRelated
            ? relativeRuntimeScript(outPath, "canopy-related-items.js", true)
            : null;
          const searchFormRel = needsSearchForm
            ? relativeRuntimeScript(outPath, "canopy-search-form.js", true)
            : null;
          let customClientRel = null;
          if (needsCustomClients) {
            try {
              await mdx.ensureCustomClientRuntime();
              const customAbs = path.join(
                OUT_DIR,
                "scripts",
                "canopy-custom-components.js",
              );
              let rel = path
                .relative(path.dirname(outPath), customAbs)
                .split(path.sep)
                .join("/");
              try {
                const st = fs.statSync(customAbs);
                rel += `?v=${Math.floor(st.mtimeMs || Date.now())}`;
              } catch (_) {}
              customClientRel = rel;
            } catch (e) {
              try {
                console.warn(
                  "[canopy][mdx] failed to build custom client runtime:",
                  e && e.message ? e.message : e,
                );
              } catch (_) {}
            }
          }

          const moduleScriptRels = [];
          if (viewerRel) moduleScriptRels.push(viewerRel);
          if (sliderRel) moduleScriptRels.push(sliderRel);
          if (imageStoryRel) moduleScriptRels.push(imageStoryRel);
          if (customClientRel) moduleScriptRels.push(customClientRel);
          const primaryClassicScripts = [];
          if (heroRel) primaryClassicScripts.push(heroRel);
          if (relatedRel) primaryClassicScripts.push(relatedRel);
          if (timelineRel) primaryClassicScripts.push(timelineRel);
          if (mapRel) primaryClassicScripts.push(mapRel);
          const secondaryClassicScripts = [];
          if (searchFormRel) secondaryClassicScripts.push(searchFormRel);
          let jsRel = null;
          if (primaryClassicScripts.length) {
            jsRel = primaryClassicScripts.shift();
          }
          const classicScriptRels = primaryClassicScripts.concat(
            secondaryClassicScripts,
          );

          const headSegments = [head];
          try {
            const localeScript = buildLocaleRuntimeScript(pageLocale);
            if (localeScript) headSegments.push(localeScript);
          } catch (_) {}
          const needsReact = !!(
            needsHydrateViewer ||
            needsRelated ||
            needsTimeline ||
            needsMap ||
            (customClientRel && needsCustomClients)
          );
          let vendorTag = "";
          if (needsReact) {
            try {
              const vendorAbs = path.join(
                OUT_DIR,
                "scripts",
                "react-globals.js",
              );
              let vendorRel = path
                .relative(path.dirname(outPath), vendorAbs)
                .split(path.sep)
                .join("/");
              try {
                const stv = fs.statSync(vendorAbs);
                vendorRel += `?v=${Math.floor(stv.mtimeMs || Date.now())}`;
              } catch (_) {}
              vendorTag = `<script src="${vendorRel}"></script>`;
            } catch (_) {}
          }
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
          moduleScriptRels.forEach((src) => pushModuleScript(src));
          try {
            const {BASE_PATH} = require("../common");
            if (BASE_PATH)
              vendorTag =
                `<script>window.CANOPY_BASE_PATH=${JSON.stringify(
                  BASE_PATH,
                )}</script>` + vendorTag;
          } catch (_) {}
          let pageBody = body;
          const extraStyles = [];
          if (mapCssRel) {
            let rel = mapCssRel;
            try {
              const mapCssAbs = path.join(OUT_DIR, "scripts", "canopy-map.css");
              const st = fs.statSync(mapCssAbs);
              rel += `?v=${Math.floor(st.mtimeMs || Date.now())}`;
            } catch (_) {}
            extraStyles.push(`<link rel="stylesheet" href="${rel}">`);
          }
          if (extraStyles.length) headSegments.push(extraStyles.join(""));
          if (vendorTag) headSegments.push(vendorTag);
          if (extraScripts.length) headSegments.push(extraScripts.join(""));
          const headExtra = headSegments.join("");
          const pageType = (pageDetails && pageDetails.type) || "work";
          const bodyClass = canopyBodyClassForType(pageType);
          let html = htmlShell({
            title,
            body: pageBody,
            cssHref: null,
            scriptHref: jsRel,
            headExtra,
            bodyClass,
            lang: pageLocale,
          });
          try {
            html = require("../common").applyBaseToHtml(html);
          } catch (_) {}
          await fsp.writeFile(outPath, html, "utf8");
          logDebug(
            `Wrote work page → ${path.relative(process.cwd(), outPath)}`,
          );
          lns.push([
            `✔ Created ${path.relative(process.cwd(), outPath)}`,
            "green",
          ]);
          let thumbUrl = "";
          let thumbWidth = undefined;
          let thumbHeight = undefined;
          try {
            const t = await getThumbnail(manifest, thumbSize, unsafeThumbs);
            if (t && t.url) {
              thumbUrl = String(t.url);
              thumbWidth = typeof t.width === "number" ? t.width : undefined;
              thumbHeight = typeof t.height === "number" ? t.height : undefined;
              logDebug(
                `Thumbnail resolved for ${manifestLabel}: ${thumbUrl} (${thumbWidth || "auto"}×${thumbHeight || "auto"})`,
              );
            }
          } catch (_) {}
          try {
            const idx = await loadManifestIndex();
            if (Array.isArray(idx.byId)) {
              const entry = idx.byId.find(
                (e) =>
                  e &&
                  e.id === String(manifest.id || id) &&
                  e.type === "Manifest",
              );
              if (entry) {
                let touched = false;
                if (thumbUrl) {
                  const nextThumb = String(thumbUrl);
                  if (entry.thumbnail !== nextThumb) {
                    entry.thumbnail = nextThumb;
                    touched = true;
                  }
                  if (
                    typeof thumbWidth === "number" &&
                    entry.thumbnailWidth !== thumbWidth
                  ) {
                    entry.thumbnailWidth = thumbWidth;
                    touched = true;
                  }
                  if (
                    typeof thumbHeight === "number" &&
                    entry.thumbnailHeight !== thumbHeight
                  ) {
                    entry.thumbnailHeight = thumbHeight;
                    touched = true;
                  }
                }
                if (heroMedia && heroMedia.heroThumbnail) {
                  logDebug(
                    `Hero thumbnail cached for ${manifestLabel}: ${heroMedia.heroThumbnail}`,
                  );
                  if (entry.heroThumbnail !== heroMedia.heroThumbnail) {
                    entry.heroThumbnail = heroMedia.heroThumbnail;
                    touched = true;
                  }
                  if (
                    typeof heroMedia.heroThumbnailWidth === "number" &&
                    entry.heroThumbnailWidth !== heroMedia.heroThumbnailWidth
                  ) {
                    entry.heroThumbnailWidth = heroMedia.heroThumbnailWidth;
                    touched = true;
                  }
                  if (
                    typeof heroMedia.heroThumbnailHeight === "number" &&
                    entry.heroThumbnailHeight !== heroMedia.heroThumbnailHeight
                  ) {
                    entry.heroThumbnailHeight = heroMedia.heroThumbnailHeight;
                    touched = true;
                  }
                  if (heroMedia.heroThumbnailSrcset) {
                    if (
                      entry.heroThumbnailSrcset !==
                      heroMedia.heroThumbnailSrcset
                    ) {
                      entry.heroThumbnailSrcset = heroMedia.heroThumbnailSrcset;
                      touched = true;
                    }
                    if (entry.heroThumbnailSizes !== HERO_IMAGE_SIZES_ATTR) {
                      entry.heroThumbnailSizes = HERO_IMAGE_SIZES_ATTR;
                      touched = true;
                    }
                    logDebug(
                      `Hero srcset cached for ${manifestLabel} (${heroMedia.heroThumbnailSrcset.length} chars)`,
                    );
                  }
                } else {
                  if (entry.heroThumbnail !== undefined) {
                    delete entry.heroThumbnail;
                    touched = true;
                  }
                  if (entry.heroThumbnailWidth !== undefined) {
                    delete entry.heroThumbnailWidth;
                    touched = true;
                  }
                  if (entry.heroThumbnailHeight !== undefined) {
                    delete entry.heroThumbnailHeight;
                    touched = true;
                  }
                  if (entry.heroThumbnailSrcset !== undefined) {
                    delete entry.heroThumbnailSrcset;
                    touched = true;
                  }
                  if (entry.heroThumbnailSizes !== undefined) {
                    delete entry.heroThumbnailSizes;
                    touched = true;
                  }
                }
                if (heroMedia && heroMedia.ogImage) {
                  logDebug(
                    `OG image cached for ${manifestLabel}: ${heroMedia.ogImage}`,
                  );
                  if (entry.ogImage !== heroMedia.ogImage) {
                    entry.ogImage = heroMedia.ogImage;
                    touched = true;
                  }
                  if (typeof heroMedia.ogImageWidth === "number") {
                    if (entry.ogImageWidth !== heroMedia.ogImageWidth)
                      touched = true;
                    entry.ogImageWidth = heroMedia.ogImageWidth;
                  } else if (entry.ogImageWidth !== undefined) {
                    delete entry.ogImageWidth;
                    touched = true;
                  }
                  if (typeof heroMedia.ogImageHeight === "number") {
                    if (entry.ogImageHeight !== heroMedia.ogImageHeight)
                      touched = true;
                    entry.ogImageHeight = heroMedia.ogImageHeight;
                  } else if (entry.ogImageHeight !== undefined) {
                    delete entry.ogImageHeight;
                    touched = true;
                  }
                } else {
                  try {
                    if (entry.ogImage !== undefined) {
                      delete entry.ogImage;
                      touched = true;
                    }
                    if (entry.ogImageWidth !== undefined) {
                      delete entry.ogImageWidth;
                      touched = true;
                    }
                    if (entry.ogImageHeight !== undefined) {
                      delete entry.ogImageHeight;
                      touched = true;
                    }
                  } catch (_) {}
                }
                if (
                  ensureThumbnailValue(
                    entry,
                    heroMedia && heroMedia.heroThumbnail,
                    heroMedia && heroMedia.heroThumbnailWidth,
                    heroMedia && heroMedia.heroThumbnailHeight,
                  )
                ) {
                  touched = true;
                }
                if (touched) await saveManifestIndex(idx);
              }
            }
          } catch (_) {}
          if (isDefaultRoute) {
            let metadataValues = [];
            let summaryValue = "";
            let annotationValue = "";
            try {
              const metadataEntries = extractMetadataEntries(manifest, {
                includeAll: metadataCollectAllLabels,
                labelsSet: metadataLabelSet,
              });
              if (metadataEntries && metadataEntries.length) {
                for (const entry of metadataEntries) recordMetadataIndexEntry(entry);
              }
            } catch (_) {}
            if (metadataOptions && metadataOptions.enabled) {
              try {
                metadataValues = extractMetadataValues(manifest, metadataOptions);
              } catch (_) {
                metadataValues = [];
              }
            }
            if (summaryOptions && summaryOptions.enabled) {
              summaryValue = summaryRaw || "";
            }
            if (annotationsOptions && annotationsOptions.enabled) {
              try {
                annotationValue = await extractAnnotationText(
                  manifest,
                  annotationsOptions,
                );
              } catch (_) {
                annotationValue = "";
              }
            }
            const fallbackThumbnail =
              (heroMedia && heroMedia.heroThumbnail) || "";
            const fallbackThumbWidth =
              heroMedia && typeof heroMedia.heroThumbnailWidth === "number"
                ? heroMedia.heroThumbnailWidth
                : undefined;
            const fallbackThumbHeight =
              heroMedia && typeof heroMedia.heroThumbnailHeight === "number"
                ? heroMedia.heroThumbnailHeight
                : undefined;
            const navThumbnail = thumbUrl || fallbackThumbnail;
            const navThumbWidth =
              typeof thumbWidth === "number" ? thumbWidth : fallbackThumbWidth;
            const navThumbHeight =
              typeof thumbHeight === "number" ? thumbHeight : fallbackThumbHeight;
            const navRecord = navPlace.buildManifestNavPlaceRecord({
              manifest,
              slug,
              href: pageHref,
              title,
              summary: summaryRaw,
              thumbnail: navThumbnail,
              thumbnailWidth: navThumbWidth,
              thumbnailHeight: navThumbHeight,
            });
            if (navRecord) navPlaceRecords.push(navRecord);

            const recordThumbnail = navThumbnail;
            const recordThumbWidth = navThumbWidth;
            const recordThumbHeight = navThumbHeight;
            const localeHrefMap = {};
            for (const entry of workRouteEntries) {
              const targetBase =
                entry && entry.route ? entry.route : getDefaultRoute("works");
              const targetLocale =
                entry && entry.locale ? entry.locale : getDefaultLocaleCode();
              const relHref = buildRouteRelativePath(
                targetBase,
                `${slug}.html`,
              );
              localeHrefMap[targetLocale] = rootRelativeHref(
                relHref.split(path.sep).join("/"),
              );
            }
            iiifRecords.push({
              id: String(manifest.id || id),
              title,
              href: pageHref,
              type: "work",
               slug,
               locale: pageLocale,
              thumbnail: recordThumbnail || undefined,
              thumbnailWidth:
                typeof recordThumbWidth === "number"
                  ? recordThumbWidth
                  : undefined,
              thumbnailHeight:
                typeof recordThumbHeight === "number"
                  ? recordThumbHeight
                  : undefined,
              searchMetadataValues:
                metadataValues && metadataValues.length
                  ? metadataValues
                  : undefined,
              searchSummary:
                summaryValue && summaryValue.length ? summaryValue : undefined,
              searchAnnotation:
                annotationValue && annotationValue.length
                  ? annotationValue
                  : undefined,
              routes: localeHrefMap,
            });
            logDebug(
              `Search record queued for ${manifestLabel}: ${pageHref} (metadata values ${
                metadataValues ? metadataValues.length : 0
              })`,
            );
          }
        } catch (e) {
          lns.push([
            `IIIF: failed to render for ${id || "<unknown>"} — ${e.message}`,
            "red",
          ]);
        }
        }
        logs[idx] = lns;
        tryFlush();
      }
    }
    const workers = Array.from(
      {length: Math.min(concurrency, chunk.length)},
      () => worker(),
    );
    await Promise.all(workers);
    tryFlush();
    const chunkDuration = Date.now() - chunkStart;
    chunkMetrics.push({
      index: ci + 1,
      count: chunk.length,
      durationMs: chunkDuration,
    });
    try {
      logLine(
        `⏱ Chunk ${ci + 1}/${chunks}: processed ${chunk.length} Manifest(s) in ${formatDurationMs(chunkDuration)}`,
        "cyan",
        {dim: true},
      );
    } catch (_) {}
  }
  if (chunkMetrics.length) {
    const totalDuration = chunkMetrics.reduce(
      (sum, entry) => sum + (entry.durationMs || 0),
      0,
    );
    const totalItems = chunkMetrics.reduce(
      (sum, entry) => sum + (entry.count || 0),
      0,
    );
    const avgDuration = chunkMetrics.length
      ? totalDuration / chunkMetrics.length
      : 0;
    const rate = totalDuration > 0 ? totalItems / (totalDuration / 1000) : 0;
    try {
      const rateLabel = rate ? `${rate.toFixed(1)} manifest(s)/s` : "n/a";
      logLine(
        `IIIF chunk summary: ${totalItems} Manifest(s) in ${formatDurationMs(totalDuration)} (avg chunk ${formatDurationMs(avgDuration)}, ${rateLabel})`,
        "cyan",
      {dim: true},
      );
    } catch (_) {}
  }
  try {
    const metadataIndexPayload = buildMetadataIndexPayload(
      metadataIndexMap,
      metadataLabelsNormalized,
      metadataDynamicOrder,
    );
    await writeMetadataIndexFile(metadataIndexPayload);
  } catch (_) {}
  try {
    await navPlace.writeNavPlaceDataset(navPlaceRecords);
    try {
      logLine(
        `✓ Wrote navPlace dataset (${navPlaceRecords.length} record(s))`,
        "cyan",
      );
    } catch (_) {}
  } catch (error) {
    try {
      console.warn(
        "[canopy][navPlace] failed to write dataset:",
        error && error.message ? error.message : error,
      );
    } catch (_) {}
  }
  return {
    iiifRecords,
    manifestIds: Array.from(renderedManifestIds),
    collectionIds: Array.from(visitedCollections),
  };
}

module.exports = {
  buildIiifCollectionPages,
  loadConfig,
  loadManifestIndex,
  saveManifestIndex,
  resolveIiifSources,
  // Expose helpers used by build for cache warming
  loadCachedManifestById,
  saveCachedManifest,
  ensureFeaturedInCache,
  cleanupIiifCache,
};

// Expose a stable set of pure helper utilities for unit testing.
module.exports.__TESTING__ = {
  resolvePositiveInteger,
  formatDurationMs,
  resolveBoolean,
  normalizeCollectionUris,
  normalizeManifestConfig,
  clampSlugLength,
  isSlugTooLong,
  normalizeSlugBase,
  buildSlugWithSuffix,
  normalizeStringList,
  ensureThumbnailValue,
  extractSummaryValues,
  truncateSummary,
  extractMetadataValues,
  extractMetadataEntries,
  extractAnnotationText,
  normalizeIiifId,
  normalizeIiifType,
  resolveParentFromPartOf,
  computeUniqueSlug,
  ensureBaseSlugFor,
  resetReservedSlugs,
  resolveThumbnailPreferences,
  loadManifestIndex,
  saveManifestIndex,
  paths: {
    IIIF_CACHE_INDEX,
    IIIF_CACHE_INDEX_LEGACY,
    IIIF_CACHE_INDEX_MANIFESTS,
  },
};

// Debug: list collections cache after traversal
try {
  if (process.env.CANOPY_IIIF_DEBUG === "1") {
    const {logLine} = require("./log");
    try {
      const files = fs.existsSync(IIIF_CACHE_COLLECTIONS_DIR)
        ? fs
            .readdirSync(IIIF_CACHE_COLLECTIONS_DIR)
            .filter((n) => /\.json$/i.test(n))
        : [];
      const head = files.slice(0, 8).join(", ");
      logLine(
        `IIIF: cache/collections (end): ${files.length} file(s)` +
          (head ? ` [${head}${files.length > 8 ? ", …" : ""}]` : ""),
        "blue",
        {dim: true},
      );
    } catch (_) {}
  }
} catch (_) {}
