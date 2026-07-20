const {
  fs,
  path,
  CONTENT_DIR,
  rootRelativeHref,
  canonicalizeLocaleCode,
} = require("../common");
const mdx = require("../build/mdx.js");
const {getPageContext} = require("../page-context");

const EXCLUDED_ROOTS = new Set(["works", "search"]);

let NAV_CACHE = null;

function normalizeRelativePath(rel) {
  if (!rel) return "";
  let normalized = String(rel).replace(/\\+/g, "/");
  while (normalized.startsWith("./")) normalized = normalized.slice(2);
  while (normalized.startsWith("../")) normalized = normalized.slice(3);
  if (normalized.startsWith("/")) {
    normalized = normalized.replace(/^\/+/, "");
  }
  return normalized;
}

function humanizeSegment(seg) {
  if (!seg) return "";
  const cleaned = String(seg).replace(/[-_]+/g, " ");
  return cleaned.replace(/(^|\s)([a-z])/g, (match) => match.toUpperCase());
}

function slugFromRelative(relativePath) {
  const normalized = normalizeRelativePath(relativePath);
  if (!normalized) {
    return {slug: "", segments: [], isIndex: false};
  }
  const parts = normalized.split("/");
  const fileName = parts.pop() || "";
  const baseName = fileName.replace(/\.mdx$/i, "");
  const isIndex = baseName.toLowerCase() === "index";
  const dirSegments = parts.filter(Boolean);
  const segments = isIndex ? dirSegments : dirSegments.concat(baseName);
  const slug = segments.join("/");
  return {slug, segments, isIndex};
}

// Returns true when the segment is a configured (non-default) locale code that
// prefixes content routes, e.g. "fr" for content/fr/...
function isLocaleSegment(segment) {
  if (!segment) return false;
  try {
    return !!canonicalizeLocaleCode(segment);
  } catch (_) {
    return false;
  }
}

// Depth (number of leading segments) that identifies a navigation section root
// for a page. Locale-prefixed routes root at <locale>/<section>; everything else
// roots at <section>.
function rootDepthForSegments(segments) {
  if (!Array.isArray(segments) || !segments.length) return 0;
  if (segments.length > 1 && isLocaleSegment(segments[0])) return 2;
  return 1;
}

// Slug of the section root for a page's segments (locale-aware).
function rootSegmentForSegments(segments) {
  const depth = rootDepthForSegments(segments);
  if (!depth) return "";
  return segments.slice(0, depth).join("/");
}

function pageSortKey(relativePath) {
  const normalized = normalizeRelativePath(relativePath).toLowerCase();
  if (!normalized) return "";
  const withoutExtension = normalized.replace(/\.mdx$/i, "");
  return withoutExtension.replace(/(^|\/)index$/i, "$1-index");
}

function extractTitleSafe(raw) {
  try {
    return mdx.extractTitle(raw);
  } catch (_) {
    return "Untitled";
  }
}

function collectPagesSync() {
  const pages = [];

  function walk(dir) {
    let entries = [];
    try {
      entries = fs.readdirSync(dir, {withFileTypes: true});
    } catch (_) {
      return;
    }
    for (const entry of entries) {
      if (!entry) continue;
      const name = entry.name || "";
      if (!name) continue;
      if (name.startsWith(".")) continue;
      const absPath = path.join(dir, name);
      const relPath = path.relative(CONTENT_DIR, absPath);
      const normalizedRel = normalizeRelativePath(relPath);
      if (!normalizedRel) continue;
      const segments = normalizedRel.split("/");
      const firstRaw = segments[0] || "";
      const firstSegment = firstRaw.replace(/\.mdx$/i, "");
      if (EXCLUDED_ROOTS.has(firstSegment)) continue;
      if (segments.some((segment) => segment.startsWith("_"))) continue;
      if (entry.isDirectory()) {
        walk(absPath);
        continue;
      }
      if (!entry.isFile()) continue;
      if (!/\.mdx$/i.test(name)) continue;
      let raw = "";
      try {
        raw = fs.readFileSync(absPath, "utf8");
      } catch (_) {
        raw = "";
      }
      let frontmatterData = null;
      if (raw && typeof mdx.parseFrontmatter === "function") {
        try {
          const parsed = mdx.parseFrontmatter(raw);
          if (parsed && parsed.data && typeof parsed.data === "object") {
            frontmatterData = parsed.data;
          }
        } catch (_) {
          frontmatterData = null;
        }
      }
      const {
        slug,
        segments: slugSegments,
        isIndex,
      } = slugFromRelative(normalizedRel);
      const titleRaw = extractTitleSafe(raw);
      const fallbackTitle = humanizeSegment(
        slugSegments.slice(-1)[0] || firstSegment || ""
      );
      const title =
        titleRaw && titleRaw !== "Untitled"
          ? titleRaw
          : fallbackTitle || titleRaw;
      const htmlRel = normalizedRel.replace(/\.mdx$/i, ".html");
      const href = rootRelativeHref(htmlRel);
      const page = {
        filePath: absPath,
        relativePath: normalizedRel,
        slug,
        segments: slugSegments,
        isIndex,
        href,
        title,
        fallbackTitle,
        sortKey: pageSortKey(normalizedRel),
        topSegment: slugSegments[0] || firstSegment || "",
      };
      pages.push(page);
    }
  }

  walk(CONTENT_DIR);
  pages.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  return pages;
}

function createNode(slug) {
  const segments = slug ? slug.split("/") : [];
  const name = segments.slice(-1)[0] || "";
  return {
    slug,
    segments,
    name,
    title: humanizeSegment(name),
    href: null,
    hasContent: false,
    relativePath: null,
    sortKey: slug || name,
    sourcePage: null,
    children: [],
  };
}

function getNavigationCache() {
  if (NAV_CACHE) return NAV_CACHE;
  const pages = collectPagesSync();
  const pagesByRelative = new Map();
  const nodes = new Map();

  for (const page of pages) {
    const {slug, segments} = page;
    pagesByRelative.set(page.relativePath, page);
    if (!segments.length) continue;
    for (let i = 0; i < segments.length; i += 1) {
      const key = segments.slice(0, i + 1).join("/");
      if (key && !nodes.has(key)) {
        nodes.set(key, createNode(key));
      }
    }
  }

  for (const page of pages) {
    if (!page.slug) continue;
    const node = nodes.get(page.slug);
    if (!node) continue;
    if (
      !node.sourcePage ||
      (node.sourcePage && node.sourcePage.isIndex && !page.isIndex)
    ) {
      node.sourcePage = page;
      node.title = page.title || node.title;
      node.href = page.href || node.href;
      node.relativePath = page.relativePath;
      node.sortKey = page.sortKey || node.sortKey;
      node.hasContent = true;
    }
  }

  for (const node of nodes.values()) {
    const {segments} = node;
    if (!segments.length) continue;
    const parentSlug = segments.slice(0, -1).join("/");
    if (!parentSlug) continue;
    const parent = nodes.get(parentSlug);
    if (!parent) continue;
    if (!parent.children.some((child) => child.slug === node.slug)) {
      parent.children.push(node);
    }
  }

  const sortChildren = (node) => {
    node.children.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
    for (const child of node.children) sortChildren(child);
  };
  for (const node of nodes.values()) {
    sortChildren(node);
  }

  const roots = new Map();
  for (const node of nodes.values()) {
    // A section root is either a top-level node (<section>) or, for
    // locale-prefixed content, a <locale>/<section> node. Rooting a
    // locale-prefixed sidebar at the locale segment alone would list every
    // section under that locale instead of just the current one.
    if (rootDepthForSegments(node.segments) === node.segments.length) {
      roots.set(node.slug, node);
    }
  }

  NAV_CACHE = {
    pages,
    pagesByRelative,
    nodes,
    roots,
  };
  return NAV_CACHE;
}

function cloneNode(node, currentSlug) {
  if (!node) return null;
  const slug = node.slug;
  const isActive = currentSlug && slug === currentSlug;
  const isAncestor = !!(
    currentSlug &&
    slug &&
    slug.length < currentSlug.length &&
    currentSlug.startsWith(slug + "/")
  );
  const children = node.children
    .map((child) => cloneNode(child, currentSlug))
    .filter(Boolean);
  if (!node.hasContent && !children.length) {
    return null;
  }
  return {
    slug,
    title: node.title,
    href: node.href,
    segments: node.segments.slice(),
    depth: Math.max(0, node.segments.length - 1),
    isActive: !!isActive,
    isAncestor,
    isExpanded: !!(isActive || isAncestor),
    hasContent: node.hasContent,
    relativePath: node.relativePath,
    children,
  };
}

function getPageInfo(relativePath) {
  const cache = getNavigationCache();
  const normalized = normalizeRelativePath(relativePath);
  const page = cache.pagesByRelative.get(normalized);
  if (page) {
    return {
      title: page.title,
      href: page.href,
      slug: page.slug,
      segments: page.segments.slice(),
      relativePath: page.relativePath,
      rootSegment: rootSegmentForSegments(page.segments),
      isIndex: page.isIndex,
    };
  }
  const {slug, segments} = slugFromRelative(normalized);
  const htmlRel = normalized.replace(/\.mdx$/i, ".html");
  return {
    title: humanizeSegment(segments.slice(-1)[0] || slug || ""),
    href: rootRelativeHref(htmlRel),
    slug,
    segments,
    relativePath: normalized,
    rootSegment: rootSegmentForSegments(segments),
    isIndex: false,
  };
}

function buildNavigationForFile(relativePath) {
  const cache = getNavigationCache();
  const normalized = normalizeRelativePath(relativePath);
  const page = cache.pagesByRelative.get(normalized);
  const fallback = slugFromRelative(normalized);
  const slug = page ? page.slug : fallback.slug;
  const segments = page ? page.segments : fallback.segments;
  const rootSegment = rootSegmentForSegments(segments);
  // The section name is the last segment of the root (the segment after an
  // optional locale prefix), e.g. "works" for both "works" and "fr/works".
  const sectionName = rootSegment.split("/").pop() || "";
  if (!slug || !rootSegment || EXCLUDED_ROOTS.has(sectionName)) {
    return null;
  }
  const rootNode = cache.roots.get(rootSegment);
  if (!rootNode) return null;
  const cloned = cloneNode(rootNode, slug);
  if (!cloned) return null;
  return {
    rootSegment,
    currentSlug: slug,
    root: cloned,
    title: cloned.title,
  };
}

function buildNavigationRoots(currentSlug) {
  const cache = getNavigationCache();
  const result = {};
  const normalizedSlug = typeof currentSlug === "string" ? currentSlug : "";
  for (const [segment, rootNode] of cache.roots.entries()) {
    const sectionName = segment.split("/").pop() || "";
    if (!segment || EXCLUDED_ROOTS.has(sectionName)) continue;
    const shouldExpand =
      normalizedSlug &&
      (normalizedSlug === segment || normalizedSlug.startsWith(segment + "/"));
    const clone = cloneNode(rootNode, shouldExpand ? normalizedSlug : null);
    if (!clone) continue;
    result[segment] = {
      rootSegment: segment,
      root: clone,
      title: clone.title,
    };
  }
  return result;
}

function resetNavigationCache() {
  NAV_CACHE = null;
}

module.exports = {
  normalizeRelativePath,
  getPageInfo,
  buildNavigationForFile,
  buildNavigationRoots,
  resetNavigationCache,
  getPageContext,
};
