import React from 'react';
import SearchPanelForm, { resolveSearchPath } from '../search/SearchPanelForm.jsx';
import SearchPanelTeaserResults from '../search/SearchPanelTeaserResults.jsx';
import {useLocale} from "../locale/index.js";

// SSR-safe placeholder for the search form modal, composed from SearchPanel parts.
// This ensures a single JSX source of truth for form/panel markup.
export default function MdxSearchFormModal(props = {}) {
  const {
    placeholder: placeholderProp,
    hotkey = 'mod+k',
    maxResults = 8,
    groupOrder = ['work', 'page'],
    button = true, // kept for backward compat; ignored by teaser form
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
