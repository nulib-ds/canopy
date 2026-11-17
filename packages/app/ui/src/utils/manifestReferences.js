import React from "react";

const CONTEXT_KEY =
  typeof Symbol === "function" ? Symbol.for("__CANOPY_PAGE_CONTEXT__") : "__CANOPY_PAGE_CONTEXT__";

function getGlobalRoot() {
  if (typeof globalThis !== "undefined") return globalThis;
  if (typeof global !== "undefined") return global;
  if (typeof window !== "undefined") return window;
  return {};
}

function getPageContext() {
  const root = getGlobalRoot();
  if (root && root[CONTEXT_KEY]) return root[CONTEXT_KEY];
  const ctx = React.createContext({
    navigation: null,
    page: null,
    site: null,
    primaryNavigation: [],
  });
  if (root) root[CONTEXT_KEY] = ctx;
  return ctx;
}

export function normalizeManifestId(raw) {
  if (!raw) return "";
  try {
    const url = new URL(String(raw));
    url.hash = "";
    const params = Array.from(url.searchParams.entries()).sort((a, b) =>
      a[0].localeCompare(b[0]) || a[1].localeCompare(b[1])
    );
    url.search = "";
    params.forEach(([key, value]) => url.searchParams.append(key, value));
    return url.toString();
  } catch (_) {
    return String(raw || "").trim();
  }
}

const PageContextFallback = React.createContext(null);
let referencedModule = null;
const REFERENCED_SPEC = '@nulib/canopy/lib/components/referenced.js';

function getReferencedModule() {
  if (typeof window !== 'undefined') return null;
  if (referencedModule) return referencedModule;
  try {
    const globalReq =
      (typeof globalThis !== 'undefined' && globalThis.__canopyRequire) || null;
    if (typeof globalReq === 'function') {
      let target = REFERENCED_SPEC;
      if (typeof globalReq.resolve === 'function') {
        try {
          target = globalReq.resolve(REFERENCED_SPEC);
        } catch (_) {}
      }
      referencedModule = globalReq(target);
      return referencedModule;
    }
  } catch (_) {
    referencedModule = null;
  }
  return referencedModule;
}

export function useReferencedManifestMap() {
  const PageContext = getPageContext() || PageContextFallback;
  const pageContext = React.useContext(PageContext);
  const referencedItems =
    pageContext && pageContext.page && Array.isArray(pageContext.page.referencedItems)
      ? pageContext.page.referencedItems
      : [];
  return React.useMemo(() => {
    const map = new Map();
    referencedItems.forEach((item) => {
      if (!item) return;
      const id = item.id || item.href;
      if (!id) return;
      const normalized = normalizeManifestId(id);
      if (normalized) map.set(normalized, item);
      map.set(String(id), item);
    });
    return map;
  }, [referencedItems]);
}

export function resolveManifestReferences(ids, manifestMap) {
  if (!Array.isArray(ids) || !ids.length || !manifestMap) return [];
  const seen = new Set();
  const out = [];
  ids.forEach((value) => {
    if (!value) return;
    const normalized = normalizeManifestId(value);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    const record = manifestMap.get(normalized) || manifestMap.get(String(value));
    if (!record) return;
    out.push({
      id: record.id || record.href || value,
      href: record.href || null,
      title: record.title || record.label || record.href || value,
      summary: record.summary || "",
      thumbnail: record.thumbnail || null,
      thumbnailWidth: record.thumbnailWidth,
      thumbnailHeight: record.thumbnailHeight,
      type: record.type || "work",
      metadata:
        Array.isArray(record.metadata) && record.metadata.length
          ? record.metadata
          : record.summary
          ? [record.summary]
          : [],
    });
  });
  return out;
}

export function resolveReferencedManifests(ids, manifestMap) {
  if (!Array.isArray(ids) || !ids.length) return [];
  const order = [];
  const seen = new Set();
  ids.forEach((value) => {
    const normalized = normalizeManifestId(value);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    order.push(normalized);
  });
  if (!order.length) return [];
  const manifestRecords = new Map();
  if (manifestMap) {
    const resolved = resolveManifestReferences(ids, manifestMap);
    resolved.forEach((entry) => {
      const key = normalizeManifestId(entry && (entry.id || entry.href));
      if (key && !manifestRecords.has(key)) {
        manifestRecords.set(key, entry);
      }
    });
  }
  const missing = order.filter((key) => key && !manifestRecords.has(key));
  if (missing.length) {
    const referencedHelpers = getReferencedModule();
    const buildReferencedItems = referencedHelpers?.buildReferencedItems;
    const normalizeList = referencedHelpers?.normalizeReferencedManifestList;
    if (typeof buildReferencedItems === 'function') {
      let fallbackItems = [];
      try {
        const normalizedMissing =
          typeof normalizeList === 'function' ? normalizeList(missing) : missing;
        if (normalizedMissing && normalizedMissing.length) {
          fallbackItems = buildReferencedItems(normalizedMissing) || [];
        }
      } catch (_) {
        fallbackItems = [];
      }
      fallbackItems.forEach((item) => {
        if (!item) return;
        const fallbackKey = normalizeManifestId(item.id || item.href);
        if (!fallbackKey || manifestRecords.has(fallbackKey)) return;
        manifestRecords.set(fallbackKey, {
          id: item.id || item.href || fallbackKey,
          href: item.href || null,
          title: item.title || item.href || '',
          summary: item.summary || '',
          thumbnail: item.thumbnail || null,
          thumbnailWidth: item.thumbnailWidth,
          thumbnailHeight: item.thumbnailHeight,
          type: item.type || 'work',
          metadata:
            Array.isArray(item.metadata) && item.metadata.length
              ? item.metadata
              : item.summary
              ? [item.summary]
              : [],
        });
      });
    }
  }
  return order
    .map((key) => manifestRecords.get(key))
    .filter(Boolean);
}
