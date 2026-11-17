import React, {useRef, useState, useEffect} from "react";
import Button from "../layout/Button.jsx";
import {useLocale} from "../locale/index.js";

// The tab for each type of result (Works, Pages), after WAI-ARIA APG's tabs pattern
// (ACCESSIBILITY.md R5): one tab stop, the arrow keys, Home and End move between the
// tabs, and the selection follows focus, as the results show at once. The tabs control
// the results (`panelId`), which `SearchResults` labels with the selected tab.
export function searchTabId(type) {
  return `canopy-search-tab-${String(type || "").toLowerCase()}`;
}

export default function SearchTabs({
  type = "all",
  onTypeChange,
  types = [],
  counts = {},
  onOpenFilters,
  activeFilterCount = 0,
  filtersLabel = "Filters",
  filtersOpen = false,
  panelId,
}) {
  const {getString, formatString} = useLocale();
  const typeLabels = React.useMemo(
    () => ({
      work: getString("common.types.work", "Works"),
      page: getString("common.types.page", "Pages"),
      docs: getString("common.types.docs", "Docs"),
    }),
    [getString],
  );
  const allTypesLabel = getString("common.nouns.items", "items");
  const orderedTypes = Array.isArray(types) ? types : [];
  const toLabel = (t) => {
    const key = String(t || "").toLowerCase();
    if (!key) return "";
    if (key === "all") {
      return allTypesLabel ? String(allTypesLabel) : "All";
    }
    if (typeLabels[key]) return typeLabels[key];
    return key.charAt(0).toUpperCase() + key.slice(1);
  };

  const hasFilters = typeof onOpenFilters === "function";
  const resolvedFiltersLabel =
    typeof filtersLabel === "string" && filtersLabel.trim()
      ? filtersLabel
      : getString("common.nouns.filters", "Filters");
  const filterBadge =
    activeFilterCount > 0 ? (
      <span className="canopy-search-tabs__filters-count">
        ({activeFilterCount})
      </span>
    ) : null;
  const searchTypesLabel = formatString(
    "common.phrases.search_content",
    "Search types",
    {content: getString("common.nouns.types", "types")},
  );

  const activeKey = String(type).toLowerCase();
  const selectedIndex = orderedTypes.findIndex(
    (t) => String(t).toLowerCase() === activeKey,
  );
  // With no tab selected (`?type=all`), the first is the tab stop.
  const stopIndex = selectedIndex >= 0 ? selectedIndex : 0;

  // The bar under a tab follows the pointer and keyboard focus, and rests on the
  // selected tab.
  const [itemBoundingBox, setItemBoundingBox] = useState(null);
  const [wrapperBoundingBox, setWrapperBoundingBox] = useState(null);
  const [highlightedTab, setHighlightedTab] = useState(null);
  const [isHoveredFromNull, setIsHoveredFromNull] = useState(true);

  const wrapperRef = useRef(null);
  const highlightRef = useRef(null);

  const repositionHighlight = (e, tabKey) => {
    if (!tabKey || !wrapperRef.current) return;
    const item = e.currentTarget;
    setItemBoundingBox(item.getBoundingClientRect());
    setWrapperBoundingBox(wrapperRef.current.getBoundingClientRect());
    setIsHoveredFromNull(!highlightedTab);
    setHighlightedTab(tabKey);
  };

  const resetHighlight = () => {
    setHighlightedTab(null);
  };

  useEffect(() => {
    if (!wrapperRef.current) return;
    const activeButton = wrapperRef.current.querySelector(
      `button[data-tab-value="${type}"]`
    );
    if (!activeButton) return;

    const itemBox = activeButton.getBoundingClientRect();
    const wrapperBox = wrapperRef.current.getBoundingClientRect();

    setItemBoundingBox(itemBox);
    setWrapperBoundingBox(wrapperBox);
    setIsHoveredFromNull(true);
    setHighlightedTab(type);
  }, [type]);

  const selectAt = (index) => {
    if (!orderedTypes.length) return;
    const count = orderedTypes.length;
    const next = orderedTypes[((index % count) + count) % count];
    if (onTypeChange) onTypeChange(next);
    const button =
      wrapperRef.current &&
      wrapperRef.current.querySelector(`button[data-tab-value="${next}"]`);
    if (button) button.focus();
  };

  const handleKeyDown = (event, index) => {
    const keys = {
      ArrowRight: index + 1,
      ArrowLeft: index - 1,
      Home: 0,
      End: orderedTypes.length - 1,
    };
    if (!Object.prototype.hasOwnProperty.call(keys, event.key)) return;
    event.preventDefault();
    selectAt(keys[event.key]);
  };

  let highlightStyles = {};
  if (itemBoundingBox && wrapperBoundingBox) {
    highlightStyles = {
      opacity: highlightedTab ? 1 : 0,
      transform: `translateX(${itemBoundingBox.left - wrapperBoundingBox.left}px)`,
      transitionDuration: isHoveredFromNull ? "0ms" : "200ms",
      width: `${itemBoundingBox.width}px`,
    };
  }

  return (
    <div className="canopy-search-tabs-wrapper" onMouseLeave={resetHighlight}>
      <div
        role="tablist"
        aria-label={searchTypesLabel || "Search types"}
        className="canopy-search-tabs"
        ref={wrapperRef}
      >
        <div
          ref={highlightRef}
          className="canopy-search-tabs__highlight"
          style={highlightStyles}
          aria-hidden="true"
        />

        {orderedTypes.map((t, index) => {
          const active = String(t).toLowerCase() === activeKey;
          const cRaw =
            counts && Object.prototype.hasOwnProperty.call(counts, t)
              ? counts[t]
              : undefined;
          const c = Number.isFinite(Number(cRaw)) ? Number(cRaw) : 0;
          return (
            <button
              key={t}
              id={searchTabId(t)}
              role="tab"
              aria-selected={active}
              aria-controls={panelId || undefined}
              tabIndex={index === stopIndex ? 0 : -1}
              type="button"
              data-tab-value={t}
              onClick={() => onTypeChange && onTypeChange(t)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              onMouseOver={(e) => repositionHighlight(e, t)}
              onFocus={(e) => repositionHighlight(e, t)}
              className={`canopy-search-tab ${active ? "is-active" : ""}`}
            >
              {toLabel(t)} ({c})
            </button>
          );
        })}
      </div>

      {hasFilters ? (
        <Button
          as="button"
          type="button"
          variant="primary"
          onClick={() => onOpenFilters && onOpenFilters()}
          aria-expanded={filtersOpen ? "true" : "false"}
          className="canopy-search-tabs__filters-button"
        >
          <span>{resolvedFiltersLabel}</span>
          {filterBadge}
        </Button>
      ) : null}
    </div>
  );
}
