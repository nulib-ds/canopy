import React from "react";
import CanopyModal from "../layout/CanopyModal.jsx";
import getSafePageContext from "../layout/pageContext.js";
import {useLocale} from "../locale/index.js";

const PageContext = getSafePageContext();

function toArray(input) {
  if (!input) return [];
  if (Array.isArray(input)) return input;
  return [input];
}

function normalizeSelected(selected = {}) {
  const map = new Map();
  if (selected && typeof selected === "object") {
    Object.keys(selected).forEach((key) => {
      const vals = new Set(toArray(selected[key]).map((v) => String(v)));
      if (vals.size) map.set(String(key), vals);
    });
  }
  return map;
}

function facetMatches(values = [], query) {
  const q = String(query || "")
    .trim()
    .toLowerCase();
  if (!q) return values;
  const starts = [];
  const contains = [];
  values.forEach((entry) => {
    if (!entry || !entry.value) return;
    const value = String(entry.value);
    const slug = String(entry.slug || entry.value || "");
    const match = value.toLowerCase();
    if (match.startsWith(q))
      starts.push({value, slug, doc_count: entry.doc_count});
    else if (match.includes(q))
      contains.push({value, slug, doc_count: entry.doc_count});
  });
  return [...starts, ...contains].slice(0, 10);
}

function FacetSection({
  facet,
  selected,
  onToggle,
  searchPlaceholder,
  filterLabelBuilder,
  clearButtonLabel,
  clearAriaBuilder,
  noMatchesLabel,
  emptyValuesLabel,
}) {
  if (!facet || !facet.label || !Array.isArray(facet.values)) return null;
  const {label, slug, values} = facet;
  const selectedValues = selected.get(String(slug)) || new Set();
  const checkboxId = (valueSlug) => `filter-${slug}-${valueSlug}`;
  const hasSelection = selectedValues.size > 0;
  const [quickQuery, setQuickQuery] = React.useState("");
  const hasQuery = quickQuery.trim().length > 0;
  const filteredValues = React.useMemo(
    () => facetMatches(values, quickQuery),
    [values, quickQuery]
  );

  return (
    <details
      className="canopy-search-filters__facet"
      open={hasSelection}
    >
      <summary className="canopy-search-filters__facet-summary">
        <span>{label}</span>
        <span className="canopy-search-filters__facet-count">
          {values.length}
        </span>
      </summary>
      <div className="canopy-search-filters__facet-content">
        <div className="canopy-search-filters__quick">
          <input
            type="search"
            value={quickQuery}
            onChange={(event) => setQuickQuery(event.target.value)}
            placeholder={searchPlaceholder}
            className="canopy-search-filters__quick-input"
            aria-label={
              filterLabelBuilder
                ? filterLabelBuilder(label)
                : `Filter ${label} values`
            }
          />
          {quickQuery ? (
            <button
              type="button"
              onClick={() => setQuickQuery("")}
              className="canopy-search-filters__quick-clear"
              aria-label={
                clearAriaBuilder
                  ? clearAriaBuilder(label)
                  : `Clear ${label} filter search`
              }
            >
              {clearButtonLabel || "Clear"}
            </button>
          ) : null}
        </div>
        {hasQuery && !filteredValues.length ? (
          <p className="canopy-search-filters__facet-notice">{noMatchesLabel}</p>
        ) : null}
        <ul className="canopy-search-filters__facet-list">
          {filteredValues.map((entry) => {
            const valueSlug = String(entry.slug || entry.value || "");
            const isChecked = selectedValues.has(valueSlug);
            const inputId = checkboxId(valueSlug);
            return (
              <li key={valueSlug} className="canopy-search-filters__facet-item">
                <input
                  id={inputId}
                  type="checkbox"
                  className="canopy-search-filters__facet-checkbox"
                  checked={isChecked}
                  onChange={(event) => {
                    const nextChecked = !!event.target.checked;
                    if (onToggle) onToggle(slug, valueSlug, nextChecked);
                  }}
                />
                <label
                  htmlFor={inputId}
                  className="canopy-search-filters__facet-label"
                >
                  <span>
                    {entry.value}{" "}
                    {Number.isFinite(entry.doc_count) ? (
                      <span className="canopy-search-filters__facet-count">
                        ({entry.doc_count})
                      </span>
                    ) : null}
                  </span>
                </label>
              </li>
            );
          })}
          {!filteredValues.length && !hasQuery ? (
            <li className="canopy-search-filters__facet-empty">{emptyValuesLabel}</li>
          ) : null}
        </ul>
      </div>
    </details>
  );
}

export default function SearchFiltersDialog(props = {}) {
  const {
    open = false,
    onOpenChange,
    facets = [],
    selected = {},
    onToggle,
    onClear,
    title,
    subtitle,
    brandLabel: brandLabelProp,
    brandHref = "/",
    logo: SiteLogo,
  } = props;

  const {getString, formatString} = useLocale();
  const filtersLabel = getString("common.nouns.filters", "filters");
  const valuesLabel = getString("common.nouns.values", "values");
  const metadataLabel = getString("common.nouns.metadata", "metadata");
  const searchValuesPlaceholder = formatString(
    "common.phrases.search_content",
    "Search values",
    {content: valuesLabel},
  );
  const filterValuesLabel = (content) =>
    formatString(
      "common.phrases.filter_values",
      "Filter {content} values",
      {content: content || valuesLabel},
    );
  const clearSearchLabel = (content) =>
    formatString(
      "common.phrases.clear_content_search",
      "Clear {content} search",
      {content: content || filtersLabel},
    );
  const emptyValuesLabel = formatString(
    "common.statuses.empty_detail",
    "No {content} available.",
    {content: valuesLabel},
  );
  const noMatchesLabel = getString(
    "common.statuses.no_matches",
    "No matches found.",
  );
  const subtitleText =
    subtitle != null
      ? subtitle
      : formatString(
          "common.phrases.filter_values",
          "Filter {content} values",
          {content: metadataLabel},
        );
  const selectedMap = normalizeSelected(selected);
  const activeCount = Array.from(selectedMap.values()).reduce(
    (total, set) => total + set.size,
    0
  );

  React.useEffect(() => {
    if (!open) return undefined;
    if (typeof document === "undefined") return undefined;
    const body = document.body;
    const root = document.documentElement;
    const prevBody = body ? body.style.overflow : "";
    const prevRoot = root ? root.style.overflow : "";
    if (body) body.style.overflow = "hidden";
    if (root) root.style.overflow = "hidden";
    return () => {
      if (body) body.style.overflow = prevBody;
      if (root) root.style.overflow = prevRoot;
    };
  }, [open]);

  // A modal dialog by keyboard (2.4.3; ACCESSIBILITY.md C41), as the header's are: focus
  // moves in as it opens, Tab and Shift+Tab stay inside, Escape closes it, and focus goes
  // back to the control that opened it.
  React.useEffect(() => {
    if (!open || typeof document === "undefined") return undefined;
    const opener = document.activeElement;
    const modal = document.getElementById("canopy-modal-filters");
    if (!modal) return undefined;
    const focusables = () =>
      Array.from(
        modal.querySelectorAll(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => el.getClientRects().length > 0);
    const first = focusables()[0];
    if (first) first.focus();
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (onOpenChange) onOpenChange(false);
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusables();
      if (!items.length) return;
      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      const inside = modal.contains(document.activeElement);
      if (event.shiftKey && (!inside || document.activeElement === firstItem)) {
        event.preventDefault();
        lastItem.focus();
      } else if (!event.shiftKey && (!inside || document.activeElement === lastItem)) {
        event.preventDefault();
        firstItem.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      if (opener && typeof opener.focus === "function" && document.contains(opener)) {
        opener.focus();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const context = React.useContext(PageContext);
  const contextSiteTitle =
    context && context.site && typeof context.site.title === "string"
      ? context.site.title.trim()
      : "";
  const resolvedBrandLabel =
    typeof brandLabelProp === "string" && brandLabelProp.trim()
      ? brandLabelProp
      : contextSiteTitle || "Site title";

  if (!open) return null;

  const brandId = "canopy-modal-filters-label";
  const resolvedSubtitle = subtitleText || title;
  const modalCloseLabel = formatString(
    "common.phrases.close_content",
    "Close {content}",
    {content: filtersLabel},
  );
  const filterUnavailableLabel = formatString(
    "common.statuses.unavailable_detail",
    "{content} is unavailable.",
    {content: filtersLabel},
  );
  const noneAppliedLabel = formatString(
    "common.phrases.none_applied",
    "No {content} applied",
    {content: filtersLabel},
  );
  const appliedCountLabel = activeCount
    ? formatString(
        "common.phrases.applied_count",
        "{count} {content} applied",
        {count: activeCount, content: filtersLabel},
      )
    : noneAppliedLabel;
  const clearAllLabel = getString("common.actions.clear_all", "Clear all");
  const doneLabel = getString("common.actions.done", "Done");

  return (
    <CanopyModal
      id="canopy-modal-filters"
      variant="filters"
      open
      ariaLabel={filtersLabel}
      labelledBy={brandId}
      label={resolvedBrandLabel}
      logo={SiteLogo}
      href={brandHref}
      closeLabel={modalCloseLabel || "Close"}
      onClose={() => onOpenChange && onOpenChange(false)}
      onBackgroundClick={() => onOpenChange && onOpenChange(false)}
      bodyClassName="canopy-modal__body--filters"
    >
      {resolvedSubtitle ? (
        <p className="canopy-search-filters__subtitle">{resolvedSubtitle}</p>
      ) : null}
      <div className="canopy-search-filters__body">
        {Array.isArray(facets) && facets.length ? (
          <div className="canopy-search-filters__facets">
            {facets.map((facet) => (
              <FacetSection
                key={facet.slug || facet.label}
                facet={facet}
                selected={selectedMap}
                onToggle={onToggle}
                searchPlaceholder={searchValuesPlaceholder}
                filterLabelBuilder={filterValuesLabel}
                clearButtonLabel={getString("common.actions.clear", "Clear")}
                clearAriaBuilder={clearSearchLabel}
                noMatchesLabel={noMatchesLabel}
                emptyValuesLabel={emptyValuesLabel}
              />
            ))}
          </div>
        ) : (
          <p className="canopy-search-filters__empty">
            {filterUnavailableLabel}
          </p>
        )}
      </div>
      <footer className="canopy-search-filters__footer">
        <div>{appliedCountLabel}</div>
        <div className="canopy-search-filters__footer-actions">
          {/* Nothing to clear leaves it in place, `aria-disabled`, so focus stays (2.4.3). */}
          <button
            type="button"
            onClick={() => {
              if (activeCount && onClear) onClear();
            }}
            aria-disabled={activeCount ? undefined : "true"}
            className="canopy-search-filters__button canopy-search-filters__button--secondary"
          >
            {clearAllLabel}
          </button>
          <button
            type="button"
            onClick={() => onOpenChange && onOpenChange(false)}
            className="canopy-search-filters__button canopy-search-filters__button--primary"
          >
            {doneLabel}
          </button>
        </div>
      </footer>
    </CanopyModal>
  );
}
