import React from 'react';
import SearchPanelForm, { resolveSearchPath } from './SearchPanelForm.jsx';
import SearchPanelTeaserResults from './SearchPanelTeaserResults.jsx';
import {useLocale} from "../locale/index.js";

// High-level SearchPanel composed of a teaser form and teaser results panel.
// Encodes configuration as JSON for the client runtime.
export default function SearchPanel(props = {}) {
  const {
    placeholder: placeholderProp,
    hotkey = 'mod+k',
    maxResults = 8,
    groupOrder = ['work', 'docs', 'page'],
    // Kept for backward compat; form always renders submit
    button = true, // eslint-disable-line no-unused-vars
    buttonLabel: buttonLabelProp,
    label,
    searchPath = '/search/index.html',
  } = props || {};
  const {getString} = useLocale();
  const placeholder =
    placeholderProp != null
      ? placeholderProp
      : getString('common.phrases.placeholder_search', 'Search…');
  const resolvedButtonLabel =
    buttonLabelProp != null
      ? buttonLabelProp
      : getString('common.nouns.search', 'Search');
  const text =
    typeof label === 'string' && label.trim() ? label.trim() : resolvedButtonLabel;
  const resolvedSearchPath = resolveSearchPath(searchPath);
  const data = { placeholder, hotkey, maxResults, groupOrder, label: text, searchPath: resolvedSearchPath };

  return (
    <div data-canopy-search-form className="flex-1 min-w-0">
      <div className="relative w-full">
        <SearchPanelForm placeholder={placeholder} buttonLabel={resolvedButtonLabel} label={label} searchPath={resolvedSearchPath} />
        <SearchPanelTeaserResults />
      </div>
      <script type="application/json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
    </div>
  );
}
