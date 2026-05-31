import React from "react";
import slugify from "slugify";
import metadataIndexHelpers from "../../../lib/components/metadata-index.js";

const metadataModule =
  metadataIndexHelpers && typeof metadataIndexHelpers === "object"
    ? metadataIndexHelpers
    : null;

const SLUG_OPTIONS = {lower: true, strict: true, trim: true};

function readGlobalIndex() {
  if (!metadataModule || typeof metadataModule.getMetadataIndex !== "function") {
    return [];
  }
  try {
    const data = metadataModule.getMetadataIndex();
    return Array.isArray(data) ? data : [];
  } catch (_) {
    return [];
  }
}

function normalizeEntries(entries) {
  const list = Array.isArray(entries) ? entries : [];
  const normalized = [];
  list.forEach((entry) => {
    if (!entry) return;
    const label = typeof entry.label === "string" ? entry.label.trim() : "";
    if (!label) return;
    const labelSlug = normalizeSlug(entry.slug, label);
    const valuesSource = Array.isArray(entry.values) ? entry.values : [];
    const seen = new Set();
    const values = [];
    valuesSource.forEach((valueEntry) => {
      let valueText = "";
      let valueSlug = "";
      if (valueEntry && typeof valueEntry === "object") {
        if (typeof valueEntry.value === "string") valueText = valueEntry.value;
        else if (valueEntry.value != null) valueText = String(valueEntry.value);
        if (typeof valueEntry.slug === "string") valueSlug = valueEntry.slug;
      } else if (valueEntry != null) {
        valueText = String(valueEntry);
      }
      const trimmed = valueText.trim();
      if (!trimmed) return;
      const slug = normalizeSlug(valueSlug, trimmed);
      const dedupeKey = `${labelSlug}__${slug}`;
      if (seen.has(dedupeKey)) return;
      seen.add(dedupeKey);
      const count =
        valueEntry && typeof valueEntry === "object" && typeof valueEntry.count === "number"
          ? valueEntry.count
          : undefined;
      values.push({value: trimmed, slug, ...(count !== undefined && {count})});
    });
    if (!values.length) return;
    normalized.push({label, slug: labelSlug, values});
  });
  return normalized;
}

function normalizeSlug(rawSlug, fallback) {
  const candidate = typeof rawSlug === "string" ? rawSlug.trim() : "";
  if (candidate) return candidate;
  try {
    const slug = slugify(fallback, SLUG_OPTIONS);
    if (slug) return slug;
  } catch (_) {}
  return String(fallback || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    || String(fallback || "");
}

function filterByLabel(entries, label) {
  if (!label) return entries;
  const normalized = String(label || "").trim().toLowerCase();
  if (!normalized) return entries;
  return entries.filter((entry) => {
    const l = String(entry.label || "").trim().toLowerCase();
    const slug = String(entry.slug || "").trim().toLowerCase();
    return l === normalized || slug === normalized;
  });
}

let cachedBasePath = null;
function normalizeBasePath(value) {
  if (!value) return "";
  const raw = String(value).trim();
  if (!raw) return "";
  const prefixed = raw.startsWith("/") ? raw : `/${raw}`;
  const cleaned = prefixed.replace(/\/+$/, "");
  return cleaned === "/" ? "" : cleaned;
}

function readBasePath() {
  if (cachedBasePath !== null) return cachedBasePath;
  const candidates = [];
  try {
    if (typeof window !== "undefined" && window.CANOPY_BASE_PATH != null) {
      candidates.push(window.CANOPY_BASE_PATH);
    }
  } catch (_) {}
  try {
    if (
      typeof globalThis !== "undefined" &&
      globalThis.CANOPY_BASE_PATH != null
    ) {
      candidates.push(globalThis.CANOPY_BASE_PATH);
    }
  } catch (_) {}
  try {
    if (typeof process !== "undefined" && process.env) {
      candidates.push(process.env.CANOPY_BASE_PATH);
    }
  } catch (_) {}
  for (const candidate of candidates) {
    const normalized = normalizeBasePath(candidate);
    if (normalized !== null) {
      cachedBasePath = normalized || "";
      return cachedBasePath;
    }
  }
  cachedBasePath = "";
  return cachedBasePath;
}

function withBasePath(href) {
  const base = readBasePath();
  const raw = typeof href === "string" ? href.trim() : "";
  if (!base) return raw || "";
  if (!raw) return base || "";
  if (raw.startsWith("/")) return `${base}${raw}`;
  return `${base}/${raw}`;
}

function buildSearchHref(labelSlug, valueSlug) {
  if (!labelSlug || !valueSlug) return "";
  try {
    const params = new URLSearchParams();
    params.set("type", "work");
    params.set(labelSlug, valueSlug);
    const url = `/search?${params.toString()}`;
    return withBasePath(url);
  } catch (_) {
    return "";
  }
}

const INLINE_SCRIPT = `(() => {
  if (typeof window === 'undefined') return;
  if (window.__canopyIndexBound) return;
  window.__canopyIndexBound = true;
  document.addEventListener('click', (event) => {
    const btn = event.target && event.target.closest('[data-canopy-index-more]');
    if (!btn) return;
    const group = btn.closest('[data-canopy-index-group]');
    if (!group) return;
    const expanded = group.getAttribute('data-expanded') === '1';
    const nextExpanded = !expanded;
    group.setAttribute('data-expanded', nextExpanded ? '1' : '0');
    const hiddenItems = group.querySelectorAll('[data-canopy-index-hidden]');
    hiddenItems.forEach((node) => {
      node.hidden = !nextExpanded;
    });
    const moreLabel = btn.getAttribute('data-more-label') || 'Show more';
    const lessLabel = btn.getAttribute('data-less-label') || 'Show less';
    btn.textContent = nextExpanded ? lessLabel : moreLabel;
  });
})()`;

export default function Index({
  label,
  metadata,
  limit = 15,
  expandLabel = "Show more",
  collapseLabel = "Show less",
  sortOrder = "alphabetically",
  showCount = false,
  className = "",
  ...rest
}) {
  const data = metadata ? normalizeEntries(metadata) : readGlobalIndex();
  const entries = filterByLabel(data, label);
  if (!entries.length) return null;
  const containerClass = ["canopy-index", className]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={containerClass} {...rest}>
      {entries.map((entry) => (
        <IndexGroup
          key={entry.slug || entry.label}
          label={entry.label}
          labelSlug={entry.slug}
          values={entry.values}
          limit={limit}
          expandLabel={expandLabel}
          collapseLabel={collapseLabel}
          sortOrder={sortOrder}
          showCount={showCount}
        />
      ))}
      <script
        data-canopy-index-script=""
        dangerouslySetInnerHTML={{__html: INLINE_SCRIPT}}
      />
    </div>
  );
}

function sortValues(values, sortOrder) {
  const copy = [...values];
  if (sortOrder === "count") {
    copy.sort((a, b) => (b.count ?? 0) - (a.count ?? 0));
  } else {
    copy.sort((a, b) =>
      String(a.value).localeCompare(String(b.value), undefined, {sensitivity: "base"}),
    );
  }
  return copy;
}

function IndexGroup({label, labelSlug, values, limit, expandLabel, collapseLabel, sortOrder, showCount}) {
  const parsedLimit = Number(limit);
  const showAll = Number.isFinite(parsedLimit) && Math.floor(parsedLimit) === 0;
  const clampedLimit = Number.isFinite(parsedLimit)
    ? Math.max(1, Math.floor(parsedLimit))
    : 15;
  const sorted = sortValues(values, sortOrder);
  const hasOverflow = !showAll && sorted.length > clampedLimit;
  const visibleValues = hasOverflow ? sorted.slice(0, clampedLimit) : sorted;
  const hiddenValues = hasOverflow ? sorted.slice(clampedLimit) : [];
  const labelCollapsed = typeof expandLabel === "string" && expandLabel.trim()
    ? expandLabel.trim()
    : "Show more";
  const labelExpanded = typeof collapseLabel === "string" && collapseLabel.trim()
    ? collapseLabel.trim()
    : "Show less";
  return (
    <dl className="canopy-index__group" data-canopy-index-group="" data-expanded="0">
      <dt>{label}</dt>
      <div className="canopy-index__values">
        {visibleValues.map((value) => {
          const href = buildSearchHref(labelSlug, value.slug);
          const key = `${labelSlug || label}-${value.slug || value.value}`;
          const displayText =
            showCount && value.count != null
              ? `${value.value} (${value.count})`
              : value.value;
          return (
            <dd key={key}>
              {href ? (
                <a
                  href={href}
                  data-canopy-index-link=""
                  data-index-label={labelSlug}
                  data-index-value={value.slug}
                >
                  {displayText}
                </a>
              ) : (
                displayText
              )}
            </dd>
          );
        })}
        {hiddenValues.map((value) => {
          const href = buildSearchHref(labelSlug, value.slug);
          const key = `${labelSlug || label}-hidden-${value.slug || value.value}`;
          const displayText =
            showCount && value.count != null
              ? `${value.value} (${value.count})`
              : value.value;
          return (
            <dd key={key} data-canopy-index-hidden="" hidden>
              {href ? (
                <a
                  href={href}
                  data-canopy-index-link=""
                  data-index-label={labelSlug}
                  data-index-value={value.slug}
                >
                  {displayText}
                </a>
              ) : (
                displayText
              )}
            </dd>
          );
        })}
      </div>
      {hasOverflow && (
        <div className="canopy-index__more-wrapper">
          <button
            type="button"
            className="canopy-index__more"
            data-canopy-index-more=""
            data-more-label={labelCollapsed}
            data-less-label={labelExpanded}
          >
            {labelCollapsed}
          </button>
        </div>
      )}
    </dl>
  );
}
