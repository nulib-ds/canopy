import React, {useEffect, useMemo, useSyncExternalStore, useState} from "react";
import {createRoot} from "react-dom/client";
import {
  SearchResultsUI,
  SearchTabsUI,
  SearchFiltersDialog,
} from "@canopy-iiif/app/ui";
import resultTemplates from "__CANOPY_SEARCH_RESULT_TEMPLATES__";
import localeRuntime from "../locale-runtime.js";
const SITE_TITLE_FALLBACK = "Site title";
const {getRuntimeMessage, formatRuntimeMessage} = localeRuntime;

function readSiteTitleFromGlobals() {
  try {
    if (
      typeof window !== "undefined" &&
      typeof window.CANOPY_SITE_TITLE === "string"
    ) {
      const raw = window.CANOPY_SITE_TITLE.trim();
      if (raw) return raw;
    }
  } catch (_) {}
  try {
    if (
      typeof globalThis !== "undefined" &&
      typeof globalThis.CANOPY_SITE_TITLE === "string"
    ) {
      const raw = globalThis.CANOPY_SITE_TITLE.trim();
      if (raw) return raw;
    }
  } catch (_) {}
  try {
    if (typeof document !== "undefined" && document.title) {
      const trimmed = document.title.trim();
      if (!trimmed) return "";
      const parts = trimmed.split("|").map((part) => part.trim()).filter(Boolean);
      if (parts.length > 1) return parts[parts.length - 1];
      return trimmed;
    }
  } catch (_) {}
  return "";
}

function readBasePath() {
  const normalize = (val) => {
    const raw = typeof val === "string" ? val.trim() : "";
    if (!raw) return "";
    const withLead = raw.startsWith("/") ? raw : `/${raw}`;
    return withLead.replace(/\/+$/, "");
  };
  try {
    if (typeof window !== "undefined" && window.CANOPY_BASE_PATH != null) {
      const fromWindow = normalize(window.CANOPY_BASE_PATH);
      if (fromWindow) return fromWindow;
    }
  } catch (_) {}
  try {
    if (typeof globalThis !== "undefined" && globalThis.CANOPY_BASE_PATH != null) {
      const fromGlobal = normalize(globalThis.CANOPY_BASE_PATH);
      if (fromGlobal) return fromGlobal;
    }
  } catch (_) {}
  try {
    if (typeof process !== "undefined" && process.env && process.env.CANOPY_BASE_PATH) {
      const fromEnv = normalize(process.env.CANOPY_BASE_PATH);
      if (fromEnv) return fromEnv;
    }
  } catch (_) {}
  return "";
}

function withBasePath(href) {
  try {
    const raw = typeof href === "string" ? href.trim() : "";
    if (!raw) return href;
    if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(raw)) return raw;
    if (!raw.startsWith("/")) return raw;
    const base = readBasePath();
    if (!base || base === "/") return raw;
    if (raw === base || raw.startsWith(`${base}/`)) return raw;
    return `${base}${raw}`;
  } catch (_) {
    return href;
  }
}

function apiBasePath() {
  return withBasePath('/api');
}

function apiUrl(pathname) {
  const cleaned = typeof pathname === 'string' ? pathname.replace(/^\/+/, '') : '';
  const base = apiBasePath();
  return `${base}/${cleaned}`;
}

function resolveSiteTitle() {
  const title = readSiteTitleFromGlobals();
  return title || SITE_TITLE_FALLBACK;
}

function readDocumentLocale() {
  try {
    if (
      typeof document !== "undefined" &&
      document.documentElement &&
      document.documentElement.lang
    ) {
      const lang = document.documentElement.lang;
      if (lang) return String(lang).trim();
    }
  } catch (_) {}
  return "";
}

function resolveRecordHrefForLocale(record, fallbackHref) {
  const routes =
    record && record.routes && typeof record.routes === "object"
      ? record.routes
      : null;
  if (!routes) return fallbackHref;
  const docLocale = readDocumentLocale();
  const candidates = [];
  if (docLocale) candidates.push(docLocale);
  if (docLocale && docLocale.includes("-")) {
    const base = docLocale.split("-")[0];
    if (base && base !== docLocale) candidates.push(base);
  }
  if (record && typeof record.locale === "string") {
    const localeCandidate = record.locale.trim();
    if (localeCandidate && !candidates.includes(localeCandidate))
      candidates.push(localeCandidate);
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

function resolveTypeLabel(type) {
  const key = String(type || "").toLowerCase();
  if (key === "work") return getRuntimeMessage("common.types.work", "Works");
  if (key === "page") return getRuntimeMessage("common.types.page", "Pages");
  if (key === "docs") return getRuntimeMessage("common.types.docs", "Docs");
  if (key === "all") return getRuntimeMessage("common.nouns.types", "types");
  if (key === "annotation") return getRuntimeMessage("common.nouns.items", "items");
  return key ? key.charAt(0).toUpperCase() + key.slice(1) : "";
}

// Lightweight IndexedDB utilities (no deps) with defensive guards
function hasIDB() {
  try {
    return typeof indexedDB !== "undefined";
  } catch (_) {
    return false;
  }
}
function idbOpen() {
  return new Promise((resolve, reject) => {
    if (!hasIDB()) return resolve(null);
    try {
      const req = indexedDB.open("canopy-search", 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("indexes"))
          db.createObjectStore("indexes", {keyPath: "version"});
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch (_) {
      resolve(null);
    }
  });
}
async function idbGet(store, key) {
  const db = await idbOpen();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(store, "readonly");
      const st = tx.objectStore(store);
      const req = st.get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    } catch (_) {
      resolve(null);
    }
  });
}
async function idbPut(store, value) {
  const db = await idbOpen();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(store, "readwrite");
      const st = tx.objectStore(store);
      st.put(value);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    } catch (_) {
      resolve(false);
    }
  });
}
async function idbPruneOld(store, keepKey) {
  const db = await idbOpen();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(store, "readwrite");
      const st = tx.objectStore(store);
      const req = st.getAllKeys();
      req.onsuccess = () => {
        try {
          (req.result || []).forEach((k) => {
            if (k !== keepKey) st.delete(k);
          });
        } catch (_) {}
        resolve(true);
      };
      req.onerror = () => resolve(false);
    } catch (_) {
      resolve(false);
    }
  });
}
async function sha256Hex(str) {
  try {
    if (typeof crypto !== "undefined" && crypto.subtle) {
      const data = new TextEncoder().encode(str);
      const digest = await crypto.subtle.digest("SHA-256", data);
      return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    }
  } catch (_) {}
  // Defensive: simple non-crypto hash when Web Crypto is unavailable
  try {
    let h = 5381;
    for (let i = 0; i < str.length; i++) h = ((h << 5) + h) ^ str.charCodeAt(i);
    return (h >>> 0).toString(16);
  } catch (_) {
    return String(str && str.length ? str.length : 0);
  }
}

function createSearchStore() {
  let state = {
    query: new URLSearchParams(location.search).get("q") || "",
    type: new URLSearchParams(location.search).get("type") || "all",
    loading: true,
    records: [],
    types: [],
    index: null,
    counts: {},
    facets: [],
    facetsDocsMap: {},
    filters: {},
    activeFilterCount: 0,
    annotationsEnabled: false,
    resultSettings: {},
  };
  const listeners = new Set();
  function notify() {
    listeners.forEach((fn) => {
      try {
        fn();
      } catch (_) {}
    });
  }
  // Keep a memoized snapshot so getSnapshot returns stable references
  let snapshot = null;
  function recomputeSnapshot() {
    const {index, records, query, type, filters, facetsDocsMap} = state;
    let base = [];
    let results = [];
    let totalForType = Array.isArray(records) ? records.length : 0;
    let counts = {};
    if (records && records.length) {
      if (!query) {
        base = records;
      } else {
        try {
          const ids = (index && index.search(query, {limit: 200})) || [];
          base = ids.map((i) => records[i]).filter(Boolean);
        } catch (_) {
          base = [];
        }
      }
      const normalizedFilters =
        filters && typeof filters === "object" ? filters : {};
      const totalActiveFilters = Object.keys(normalizedFilters).reduce(
        (sum, slug) => {
          const arr = Array.isArray(normalizedFilters[slug])
            ? normalizedFilters[slug]
            : [];
          return sum + arr.filter(Boolean).length;
        },
        0
      );
      state.activeFilterCount = totalActiveFilters;

      const shouldFilterWorks =
        totalActiveFilters > 0 && String(type).toLowerCase() === "work";
      let allowed = null; // Set of record indices that satisfy filters
      if (shouldFilterWorks) {
        Object.keys(normalizedFilters).forEach((facetSlug) => {
          const values = Array.isArray(normalizedFilters[facetSlug])
            ? normalizedFilters[facetSlug]
            : [];
          if (!values.length) return;
          const docMap =
            facetsDocsMap && facetsDocsMap[facetSlug]
              ? facetsDocsMap[facetSlug]
              : null;
          if (!docMap) {
            allowed = new Set();
            return;
          }
          const union = new Set();
          values.forEach((valueSlugRaw) => {
            const valueSlug = String(valueSlugRaw);
            const docsSet = docMap[valueSlug];
            if (docsSet && docsSet.size) {
              docsSet.forEach((idx) => union.add(idx));
            }
          });
          if (union.size === 0) {
            allowed = new Set();
            return;
          }
          if (!allowed) {
            allowed = new Set(union);
          } else {
            allowed = new Set(
              Array.from(allowed).filter((idx) => union.has(idx))
            );
          }
        });
      }

      try {
        counts = base.reduce((acc, r) => {
          const t = String((r && r.type) || "page").toLowerCase();
          if (shouldFilterWorks && t === "work") {
            if (!allowed || !allowed.has(r && r.__docIndex)) return acc;
          }
          acc[t] = (acc[t] || 0) + 1;
          return acc;
        }, {});
      } catch (_) {
        counts = {};
      }

      const annotationMatches = base.filter((r) => r && r.annotation);
      if (annotationMatches.length)
        counts.annotation = annotationMatches.length;

      const typeLower = String(type).toLowerCase();
      if (typeLower === "annotation") {
        results = annotationMatches.map((r) => ({
          ...r,
          type: "annotation",
          originalType: r ? r.type : undefined,
        }));
        totalForType = annotationMatches.length;
      } else {
        results =
          typeLower === "all"
            ? base
            : base.filter((r) => String(r.type).toLowerCase() === typeLower);
        if (shouldFilterWorks && allowed) {
          results = results.filter((r) => allowed.has(r && r.__docIndex));
        }

        if (typeLower !== "all") {
          try {
            totalForType = records.filter(
              (r) => String(r.type).toLowerCase() === typeLower
            ).length;
          } catch (_) {}
        }
      }
    }
    const {facetsDocsMap: _fMap, ...publicState} = state;
    snapshot = {
      ...publicState,
      results,
      total: totalForType,
      shown: results.length,
      counts,
    };
  }
  function set(partial) {
    state = {...state, ...partial};
    recomputeSnapshot();
    notify();
  }

  function syncFiltersToUrl(nextFilters) {
    try {
      const url = new URL(location.href);
      const facetSlugs = new Set();
      if (Array.isArray(state.facets)) {
        state.facets.forEach((facet) => {
          if (facet && facet.slug) facetSlugs.add(String(facet.slug));
        });
      }
      Object.keys(nextFilters || {}).forEach((slug) => {
        if (slug) facetSlugs.add(String(slug));
      });
      facetSlugs.forEach((slug) => url.searchParams.delete(slug));
      Object.keys(nextFilters || {}).forEach((slug) => {
        const vals = Array.isArray(nextFilters[slug])
          ? nextFilters[slug].filter(Boolean)
          : [];
        if (vals.length)
          url.searchParams.set(slug, Array.from(new Set(vals)).join(","));
      });
      const qs = url.searchParams.toString();
      history.replaceState(
        null,
        "",
        qs ? `${url.pathname}?${qs}` : url.pathname
      );
    } catch (_) {}
  }

  function toggleFilter(facetSlug, valueSlug, nextChecked) {
    const slug = String(facetSlug || "");
    const value = String(valueSlug || "");
    if (!slug || !value) return;
    const current = Array.isArray(state.filters && state.filters[slug])
      ? [...state.filters[slug]]
      : [];
    const setValues = new Set(current);
    const shouldCheck =
      typeof nextChecked === "boolean" ? nextChecked : !setValues.has(value);
    if (shouldCheck) setValues.add(value);
    else setValues.delete(value);
    const nextFilters = {...state.filters};
    if (setValues.size) nextFilters[slug] = Array.from(setValues);
    else delete nextFilters[slug];
    syncFiltersToUrl(nextFilters);
    set({filters: nextFilters});
  }

  function clearFilters() {
    syncFiltersToUrl({});
    set({filters: {}});
  }

  async function hydrateFacets() {
    try {
    const res = await fetch(apiUrl('search/facets.json'));
      if (!res || !res.ok) return;
      const json = await res.json().catch(() => null);
      if (!Array.isArray(json)) return;
      const sanitized = [];
      const docsMap = {};
      json.forEach((facet) => {
        if (
          !facet ||
          !facet.label ||
          !facet.slug ||
          !Array.isArray(facet.values)
        )
          return;
        const slug = String(facet.slug);
        const values = [];
        const valueMap = {};
        facet.values.forEach((valueEntry) => {
          if (!valueEntry || !valueEntry.slug) return;
          const vSlug = String(valueEntry.slug);
          const vLabel =
            valueEntry.value != null ? String(valueEntry.value) : "";
          const docCount = Number.isFinite(Number(valueEntry.doc_count))
            ? Number(valueEntry.doc_count)
            : undefined;
          const docs = Array.isArray(valueEntry.docs)
            ? valueEntry.docs.map((idx) => Number(idx))
            : [];
          if (!valueMap[vSlug]) valueMap[vSlug] = new Set();
          docs.forEach((idx) => {
            if (Number.isInteger(idx)) valueMap[vSlug].add(idx);
          });
          values.push({value: vLabel, slug: vSlug, doc_count: docCount});
        });
        docsMap[slug] = valueMap;
        sanitized.push({label: String(facet.label), slug, values});
      });

      // Pre-populate filters from query params once facets are known
      const params = new URLSearchParams(location.search);
      const nextFilters = {};
      sanitized.forEach((facet) => {
        const slug = facet.slug;
        const valid = new Set(facet.values.map((item) => item.slug));
        const requested = [];
        params.getAll(slug).forEach((raw) => {
          const parts = String(raw || "").split(",");
          parts.forEach((part) => {
            const trimmed = part && part.trim ? part.trim() : part;
            if (trimmed && valid.has(trimmed)) requested.push(trimmed);
          });
        });
        if (requested.length)
          nextFilters[slug] = Array.from(new Set(requested));
      });

      set({facets: sanitized, facetsDocsMap: docsMap, filters: nextFilters});
      syncFiltersToUrl(nextFilters);
    } catch (_) {}
  }
  function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }
  function getSnapshot() {
    return snapshot;
  }
  // Initialize snapshot
  recomputeSnapshot();
  // init
  (async () => {
    try {
      const DEBUG = (() => {
        try {
          const p = new URLSearchParams(location.search);
          return (
            p.has("searchDebug") || localStorage.CANOPY_SEARCH_DEBUG === "1"
          );
        } catch (_) {
          return false;
        }
      })();
      const Flex =
        (window && window.FlexSearch) || (await import("flexsearch")).default;
      // Broadcast new index installs to other tabs
      let bc = null;
      try {
        if (typeof BroadcastChannel !== "undefined")
          bc = new BroadcastChannel("canopy-search");
      } catch (_) {}
      // Try to load meta for cache-busting and tab order; fall back to hash of JSON
      let version = "";
      let tabsOrder = [];
      let annotationsAssetPath = "";
      let resultsOrder = [];
      let resultLayoutMap = {};
      try {
        const meta = await fetch(apiUrl('index.json'))
          .then((r) => (r && r.ok ? r.json() : null))
          .catch(() => null);
        if (meta && typeof meta.version === "string") version = meta.version;
        const searchMeta = meta && meta.search ? meta.search : {};
        const ord =
          searchMeta &&
          searchMeta.tabs &&
          Array.isArray(searchMeta.tabs.order)
            ? searchMeta.tabs.order
            : [];
        tabsOrder = ord
          .map((s) => String(s).trim().toLowerCase())
          .filter(Boolean);
        const resultsMeta =
          searchMeta && searchMeta.results ? searchMeta.results : null;
        if (resultsMeta) {
          const rawOrder = Array.isArray(resultsMeta.order)
            ? resultsMeta.order
            : [];
          const rawSettings =
            resultsMeta.settings && typeof resultsMeta.settings === "object"
              ? resultsMeta.settings
              : {};
          const normalizedOrder = [];
          const normalizedMap = {};
          const seenTypes = new Set();
          const resolveEntry = (value) => {
            const type = String(value || "")
              .trim()
              .toLowerCase();
            if (!type || seenTypes.has(type)) return;
            const cfg = rawSettings[type] || rawSettings[value] || {};
            const layout =
              String((cfg && cfg.layout) || "").toLowerCase() === "grid"
                ? "grid"
                : "list";
            const result =
              String((cfg && cfg.result) || "").toLowerCase() === "figure"
                ? "figure"
                : "article";
            normalizedMap[type] = { layout, result };
            normalizedOrder.push(type);
            seenTypes.add(type);
          };
          rawOrder.forEach(resolveEntry);
          Object.keys(rawSettings || {}).forEach(resolveEntry);
          if (normalizedOrder.length) {
            resultsOrder = normalizedOrder;
            resultLayoutMap = normalizedMap;
          }
        }
        const annotationsAsset =
          searchMeta &&
          searchMeta.assets &&
          searchMeta.assets.annotations;
        if (annotationsAsset && annotationsAsset.path) {
          annotationsAssetPath = String(annotationsAsset.path);
        }
      } catch (_) {}
      const suffix = version ? `?v=${encodeURIComponent(version)}` : "";
      const res = await fetch(`${apiUrl('search-index.json')}${suffix}`);
      const text = await res.text();
      const parsed = (() => {
        try {
          return JSON.parse(text);
        } catch {
          return [];
        }
      })();
      const indexRecords = Array.isArray(parsed)
        ? parsed
        : parsed && parsed.records
        ? parsed.records
        : [];

      let displayRecords = [];
      try {
        const displayRes = await fetch(`${apiUrl('search-records.json')}${suffix}`);
        if (displayRes && displayRes.ok) {
          const displayJson = await displayRes.json().catch(() => []);
          displayRecords = Array.isArray(displayJson)
            ? displayJson
            : displayJson && Array.isArray(displayJson.records)
            ? displayJson.records
            : [];
        }
      } catch (_) {}

      const displayMap = new Map();
      displayRecords.forEach((rec) => {
        if (!rec || typeof rec !== "object") return;
        const key = rec.id ? String(rec.id) : rec.href ? String(rec.href) : "";
        if (!key) return;
        displayMap.set(key, rec);
      });

      let annotationsRecords = [];
      if (annotationsAssetPath) {
        try {
          const cleanedAnnotationsPath = annotationsAssetPath.replace(/^\/+/, '');
          const annotationsUrl = `${apiUrl(cleanedAnnotationsPath)}${suffix}`;
          const annotationsRes = await fetch(annotationsUrl);
          if (annotationsRes && annotationsRes.ok) {
            const annotationsJson = await annotationsRes.json().catch(() => []);
            annotationsRecords = Array.isArray(annotationsJson)
              ? annotationsJson
              : annotationsJson && Array.isArray(annotationsJson.records)
              ? annotationsJson.records
              : [];
          }
        } catch (_) {}
      }

      const annotationsMap = new Map();
      annotationsRecords.forEach((rec, idx) => {
        if (!rec || typeof rec !== "object") return;
        const key = rec.id ? String(rec.id) : String(idx);
        const text = rec.annotation ? String(rec.annotation) : rec.text ? String(rec.text) : "";
        if (!key || !text) return;
        annotationsMap.set(key, text);
      });

      const data = indexRecords.map((rec, i) => {
        const key = rec && rec.id ? String(rec.id) : String(i);
        const display = key ? displayMap.get(key) : null;
        const merged = { ...(display || {}), ...(rec || {}), __docIndex: i };
        if (!merged.id && key) merged.id = key;
        const fallbackHref = merged.href || (display && display.href) || '';
        const localeAwareHref = resolveRecordHrefForLocale(
          display || merged,
          fallbackHref,
        );
        if (localeAwareHref) {
          merged.href = withBasePath(localeAwareHref);
        } else if (fallbackHref) {
          merged.href = withBasePath(fallbackHref);
        }
        if (!merged.title) merged.title = merged.href || "";
        if (!Array.isArray(merged.metadata)) {
          const meta = Array.isArray(rec && rec.metadata) ? rec.metadata : [];
          merged.metadata = meta;
        }
        if (annotationsMap.has(key) && !merged.annotation)
          merged.annotation = annotationsMap.get(key);
        return merged;
      });
      if (!version)
        version = (parsed && parsed.version) || (await sha256Hex(text));

      const idx = new Flex.Index({tokenize: "forward"});
      const collectSearchText = (rec) => {
        const parts = [];
        if (rec && rec.title) parts.push(String(rec.title));
        const metadata = Array.isArray(rec && rec.metadata) ? rec.metadata : [];
        for (const value of metadata) {
          if (value) parts.push(String(value));
        }
        if (rec && rec.summary) parts.push(String(rec.summary));
        if (rec && rec.annotation) parts.push(String(rec.annotation));
        return parts.join(" ").trim();
      };
      let hydrated = false;
      const t0 =
        typeof performance !== "undefined" && performance.now
          ? performance.now()
          : Date.now();
      try {
        const cached = await idbGet("indexes", version);
        if (cached && cached.exportData) {
          try {
            const dataObj = cached.exportData || {};
            for (const k in dataObj) {
              if (Object.prototype.hasOwnProperty.call(dataObj, k)) {
                try {
                  idx.import(k, dataObj[k]);
                } catch (_) {}
              }
            }
            hydrated = true;
          } catch (_) {
            hydrated = false;
          }
        }
      } catch (_) {
        /* no-op */
      }

      if (!hydrated) {
        data.forEach((rec, i) => {
          try {
            const payload = collectSearchText(rec);
            idx.add(i, payload);
          } catch (_) {}
        });
        try {
          const dump = {};
          try {
            await idx.export((key, val) => {
              dump[key] = val;
            });
          } catch (_) {}
          await idbPut("indexes", {version, exportData: dump, ts: Date.now()});
          await idbPruneOld("indexes", version);
          try {
            if (bc) bc.postMessage({type: "search-index-installed", version});
          } catch (_) {}
        } catch (_) {}
        if (DEBUG) {
          const t1 =
            typeof performance !== "undefined" && performance.now
              ? performance.now()
              : Date.now();
          // eslint-disable-next-line no-console
          console.info(
            `[Search] Index built in ${Math.round(t1 - t0)}ms (records=${
              data.length
            }) v=${String(version).slice(0, 8)}`
          );
        }
      } else if (DEBUG) {
        const t1 =
          typeof performance !== "undefined" && performance.now
            ? performance.now()
            : Date.now();
        // eslint-disable-next-line no-console
        console.info(
          `[Search] Index imported from IndexedDB in ${Math.round(
            t1 - t0
          )}ms v=${String(version).slice(0, 8)}`
        );
      }
      // Optional: debug-listen for install events from other tabs
      try {
        if (bc && DEBUG) {
          bc.onmessage = (ev) => {
            try {
              const msg = ev && ev.data;
              if (
                msg &&
                msg.type === "search-index-installed" &&
                msg.version &&
                msg.version !== version
              ) {
                // eslint-disable-next-line no-console
                console.info(
                  "[Search] Another tab installed version",
                  String(msg.version).slice(0, 8)
                );
              }
            } catch (_) {}
          };
        }
      } catch (_) {}

      const ts = Array.from(
        new Set(data.map((r) => String((r && r.type) || "page")))
      );
      if (annotationsRecords.length && !ts.includes("annotation"))
        ts.push("annotation");
      const order =
        Array.isArray(resultsOrder) && resultsOrder.length
          ? resultsOrder
          : Array.isArray(tabsOrder) && tabsOrder.length
          ? tabsOrder
          : ["work", "docs", "page"];
      ts.sort((a, b) => {
        const ia = order.indexOf(a);
        const ib = order.indexOf(b);
        return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
      });
      // Default to configured first tab if no type param present
      try {
        const p = new URLSearchParams(location.search);
        const hasType = p.has("type");
        if (!hasType) {
          let def = order && order.length ? order[0] : "all";
          if (!ts.includes(def)) def = ts[0] || "all";
          if (def && def !== "all") {
            p.set("type", def);
            history.replaceState(
              null,
              "",
              `${location.pathname}?${p.toString()}`
            );
          }
          set({type: def});
        }
      } catch (_) {}
      set({
        index: idx,
        records: data,
        types: ts,
        loading: false,
        annotationsEnabled: annotationsRecords.length > 0,
        resultSettings: resultLayoutMap,
      });
      await hydrateFacets();
    } catch (_) {
      set({loading: false});
    }
  })();
  // API
  function setQuery(q) {
    set({query: q});
    const u = new URL(location.href);
    if (q) u.searchParams.set("q", q);
    else u.searchParams.delete("q");
    history.replaceState(
      null,
      "",
      u.searchParams.toString()
        ? `${u.pathname}?${u.searchParams.toString()}`
        : u.pathname
    );
  }
  function setType(t) {
    set({type: t});
    const u = new URL(location.href);
    if (t && t !== "all") u.searchParams.set("type", t);
    else u.searchParams.delete("type");
    history.replaceState(
      null,
      "",
      u.searchParams.toString()
        ? `${u.pathname}?${u.searchParams.toString()}`
        : u.pathname
    );
  }
  return {
    subscribe,
    getSnapshot,
    setQuery,
    setType,
    toggleFilter,
    clearFilters,
  };
}

const store = typeof window !== "undefined" ? createSearchStore() : null;

function useStore() {
  const snap = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot
  );
  return {
    ...snap,
    setQuery: store.setQuery,
    setType: store.setType,
    toggleFilter: store.toggleFilter,
    clearFilters: store.clearFilters,
  };
}

function ResultsMount(props = {}) {
  const {results, type, loading, query, resultSettings} = useStore();
  if (loading)
    return (
      <div className="text-gray-800">
        {formatRuntimeMessage("common.statuses.loading", "Loading…")}
      </div>
    );
  const normalizedType = String(type || "").trim().toLowerCase();
  const hasOverrides =
    resultSettings && Object.keys(resultSettings || {}).length > 0;
  const typeSettings =
    (normalizedType && resultSettings && resultSettings[normalizedType]) || null;
  let layout = (props && props.layout) || "grid";
  let variant = "auto";
  if (typeSettings) {
    layout = typeSettings.layout || "list";
    variant = typeSettings.result || "article";
  } else if (hasOverrides) {
    layout = "list";
    variant = "article";
  }
  return (
    <SearchResultsUI
      results={results}
      type={type}
      layout={layout}
      query={query}
      templates={resultTemplates}
      variant={variant}
    />
  );
}
function TabsMount() {
  const {
    type,
    setType,
    types,
    counts,
    facets,
    filters,
    activeFilterCount,
    toggleFilter,
    clearFilters,
  } = useStore();
  const [open, setOpen] = useState(false);
  const hasFilters = Array.isArray(facets) && facets.length > 0;
  const allowFilters = hasFilters && String(type).toLowerCase() === "work";
  useEffect(() => {
    if (!allowFilters && open) setOpen(false);
  }, [allowFilters, open]);
  const handleToggle = (facetSlug, valueSlug, checked) => {
    if (toggleFilter) toggleFilter(facetSlug, valueSlug, checked);
  };
  const brandLabel = useMemo(() => resolveSiteTitle(), []);
  const brandHref = useMemo(() => withBasePath("/"), []);
  return (
    <>
      <SearchTabsUI
        type={type}
        onTypeChange={setType}
        types={types}
        counts={counts}
        onOpenFilters={allowFilters ? () => setOpen(true) : undefined}
        activeFilterCount={activeFilterCount || 0}
        filtersOpen={allowFilters ? open : false}
      />
      {allowFilters ? (
        <SearchFiltersDialog
          open={open}
          onOpenChange={setOpen}
          facets={facets}
          selected={filters}
          onToggle={handleToggle}
          onClear={() => clearFilters && clearFilters()}
          brandLabel={brandLabel}
          brandHref={brandHref}
        />
      ) : null}
    </>
  );
}
function SummaryMount() {
  const {query, type, shown, total} = useStore();
  const text = useMemo(() => {
    const itemsLabel = getRuntimeMessage("common.nouns.items", "items");
    if (!query) {
      return formatRuntimeMessage(
        "common.statuses.summary_content",
        "Showing {shown} of {total} {content}",
        {shown, total, content: itemsLabel},
      );
    }
    const typeLabel = resolveTypeLabel(type);
    return formatRuntimeMessage(
      "common.statuses.search_summary",
      'Found {shown} of {total} in {type} for "{query}"',
      {shown, total, type: typeLabel, query},
    );
  }, [query, type, shown, total]);
  return <div className="text-sm text-gray-800">{text}</div>;
}

function parseProps(el) {
  try {
    const s = el.querySelector('script[type="application/json"]');
    if (s) return JSON.parse(s.textContent || "{}");
  } catch (_) {}
  return {};
}

function bindSearchInputToStore() {
  if (!store || typeof document === "undefined") return;
  try {
    const input = document.querySelector("[data-canopy-search-form-input]");
    if (!input || input.dataset.canopySearchSync === "1") return;
    input.dataset.canopySearchSync = "1";

    const syncFromStore = () => {
      try {
        const snap = store.getSnapshot();
        const nextVal =
          snap && typeof snap.query === "string" ? snap.query : "";
        if (input.value !== nextVal) input.value = nextVal;
      } catch (_) {}
    };

    const onInput = (event) => {
      try {
        const val =
          event && event.target && typeof event.target.value === "string"
            ? event.target.value
            : "";
        const current = (() => {
          try {
            const snap = store.getSnapshot();
            return snap && typeof snap.query === "string" ? snap.query : "";
          } catch (_) {
            return "";
          }
        })();
        if (val === current) return;
        store.setQuery(val);
      } catch (_) {}
    };

    input.addEventListener("input", onInput);
    const unsubscribe = store.subscribe(syncFromStore);
    syncFromStore();

    const cleanup = () => {
      try {
        input.removeEventListener("input", onInput);
      } catch (_) {}
      try {
        if (typeof unsubscribe === "function") unsubscribe();
      } catch (_) {}
    };
    window.addEventListener("beforeunload", cleanup, {once: true});
  } catch (_) {}
}

function mountAt(selector, Comp) {
  const nodes = document.querySelectorAll(selector);
  nodes.forEach((n) => {
    try {
      const root = createRoot(n);
      const props = parseProps(n);
      root.render(<Comp {...props} />);
    } catch (e) {
      // Surface helpful diagnostics in dev
      try {
        console.error(
          "[Search] mount error at",
          selector,
          e && e.message ? e.message : e,
          e && e.stack ? e.stack : ""
        );
      } catch (_) {}
    }
  });
}

if (typeof document !== "undefined") {
  const run = () => {
    // Mount tabs and other search UI pieces
    mountAt("[data-canopy-search-tabs]", TabsMount);
    mountAt("[data-canopy-search-results]", ResultsMount);
    mountAt("[data-canopy-search-summary]", SummaryMount);
    bindSearchInputToStore();
    // Total mount removed
    try {
      window.addEventListener("canopy:search:setQuery", (ev) => {
        try {
          const q =
            ev && ev.detail && typeof ev.detail.query === "string"
              ? ev.detail.query
              : document.querySelector("[data-canopy-search-form-input]")?.value ||
                "";
          if (typeof q === "string") store.setQuery(q);
        } catch (_) {}
      });
    } catch (_) {}
  };
  if (document.readyState !== "loading") run();
  else document.addEventListener("DOMContentLoaded", run, {once: true});
}
