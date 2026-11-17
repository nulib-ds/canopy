import React, {useEffect, useMemo, useSyncExternalStore, useState} from "react";
import {createRoot} from "react-dom/client";
import {
  SearchResultsUI,
  SearchTabsUI,
  SearchFiltersDialog,
} from "../../ui/dist/index.mjs";
import resultTemplates from "__CANOPY_SEARCH_RESULT_TEMPLATES__";
import FlexSearch from "flexsearch";
import localeRuntime from "../locale-runtime.js";
import {createEngine} from "./engine.js";
import {apiUrl, loadSearchData, withBasePath} from "./data.js";
import {openIndex} from "./index-cache.js";
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

// The header's dialogs carry the site's title as the header shows it (`_app.mdx`'s
// `title`), which `canopy.yml`'s `title` need not be; the filters take the same.
function readSiteTitleFromHeader() {
  try {
    const label =
      document.getElementById("canopy-modal-search-label") ||
      document.getElementById("canopy-modal-nav-label");
    return label && label.textContent ? label.textContent.trim() : "";
  } catch (_) {
    return "";
  }
}

function resolveSiteTitle() {
  const title = readSiteTitleFromHeader() || readSiteTitleFromGlobals();
  return title || SITE_TITLE_FALLBACK;
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

function createSearchStore() {
  let engine = null;
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
    failed: false,
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
          const ids = engine ? engine.search(index, query, 200) : [];
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
  // Load the records, open the index (from the visitor's cache when it holds this
  // version), and pick the first tab.
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
      engine = createEngine(FlexSearch);
      const {
        searchMeta,
        version,
        records: data,
        annotationCount,
      } = await loadSearchData();
      const tabsOrder = (
        searchMeta && searchMeta.tabs && Array.isArray(searchMeta.tabs.order)
          ? searchMeta.tabs.order
          : []
      )
        .map((s) => String(s).trim().toLowerCase())
        .filter(Boolean);
      let resultsOrder = [];
      let resultLayoutMap = {};
      try {
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
      } catch (_) {}
      const t0 =
        typeof performance !== "undefined" && performance.now
          ? performance.now()
          : Date.now();
      const {index: idx, cached} = await openIndex({
        engine,
        records: data,
        version,
      });
      if (DEBUG) {
        const t1 =
          typeof performance !== "undefined" && performance.now
            ? performance.now()
            : Date.now();
        // eslint-disable-next-line no-console
        console.info(
          `[Search] Index ${cached ? "imported from IndexedDB" : "built"} in ${Math.round(
            t1 - t0
          )}ms (records=${data.length}) v=${String(version).slice(0, 8)}`
        );
      }

      const ts = Array.from(
        new Set(data.map((r) => String((r && r.type) || "page")))
      );
      if (annotationCount && !ts.includes("annotation"))
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
        annotationsEnabled: annotationCount > 0,
        resultSettings: resultLayoutMap,
      });
      await hydrateFacets();
    } catch (error) {
      // Say so, here and on the page, rather than show no results for every query.
      try {
        console.error("[Search] failed to load", error);
      } catch (_) {}
      set({loading: false, failed: true});
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

// The header's field (`search-form-runtime.js`) drives this page's results rather than
// its own suggestions, whatever the page's route (`/es/buscar`, say).
if (typeof window !== "undefined") window.CanopySearchPage = true;

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

function pageHas(selector) {
  try {
    return Boolean(document.querySelector(selector));
  } catch (_) {
    return false;
  }
}

function ResultsMount(props = {}) {
  const {results, type, types, loading, failed, query, resultSettings} = useStore();
  if (loading)
    return (
      <div className="text-gray-800">
        {formatRuntimeMessage("common.statuses.loading", "Loading…")}
      </div>
    );
  if (failed)
    return (
      <div className="text-gray-800">
        {formatRuntimeMessage("common.statuses.unavailable", "{content} unavailable.", {
          content: getRuntimeMessage("common.nouns.search", "Search"),
        })}
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
      tabbed={
        pageHas("[data-canopy-search-tabs]") &&
        Array.isArray(types) &&
        types.includes(type)
      }
      headingLevel={props.headingLevel}
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
        panelId={
          pageHas("[data-canopy-search-results]") ? "search-results" : undefined
        }
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
// What the search found, as a status message (4.1.3): shown at once, and said to a
// screen reader by a visually hidden twin once typing pauses, so it hears the count once
// rather than at every key.
const ANNOUNCE_DELAY = 800;

function SummaryMount() {
  const {query, type, shown, total, loading, failed} = useStore();
  const text = useMemo(() => {
    if (loading || failed) return "";
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
  }, [query, type, shown, total, loading, failed]);
  const spoken = failed
    ? formatRuntimeMessage("common.statuses.unavailable", "{content} unavailable.", {
        content: getRuntimeMessage("common.nouns.search", "Search"),
      })
    : text;
  const [announced, setAnnounced] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setAnnounced(spoken), ANNOUNCE_DELAY);
    return () => clearTimeout(timer);
  }, [spoken]);
  return (
    <>
      <div className="text-sm text-gray-800" aria-hidden="true">
        {text}
      </div>
      <div role="status" className="sr-only">
        {announced}
      </div>
    </>
  );
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

// The results' headings sit one level below the last heading the page shows before them
// (DESIGN.md §0, "Headings follow the page"; ACCESSIBILITY.md R7): under the search
// layout's `h1`, `h2`. `<SearchResults headingLevel={n} />` says otherwise.
function headingLevelBefore(node) {
  try {
    const before = Array.from(document.querySelectorAll("h1, h2, h3, h4, h5, h6")).filter(
      (heading) =>
        !node.contains(heading) &&
        heading.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING &&
        heading.getClientRects().length > 0 &&
        !heading.closest('[aria-hidden="true"], [hidden], [inert]')
    );
    const last = before[before.length - 1];
    return last ? Number(last.tagName.slice(1)) + 1 : 2;
  } catch (_) {
    return 2;
  }
}

function mountAt(selector, Comp, extend) {
  const nodes = document.querySelectorAll(selector);
  nodes.forEach((n) => {
    try {
      const root = createRoot(n);
      const parsed = parseProps(n);
      const props = typeof extend === "function" ? extend(n, parsed) : parsed;
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
    mountAt("[data-canopy-search-results]", ResultsMount, (node, props) => ({
      ...props,
      headingLevel: Number(props.headingLevel) || headingLevelBefore(node),
    }));
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
