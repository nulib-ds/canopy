import React from "react";
import {useLocale} from "../locale/index.js";

// SSR-safe placeholder for RelatedItems. Hydrated by canopy-related-items.js + canopy-slider.js.
// It carries the page's word for "View all" (`common.actions.view_all`), which the runtime
// adds, unseen, to each slider's linked value (lib/build/mdx.js).
export default function MdxRelatedItems(props) {
  const {getString} = useLocale();
  let json = "{}";
  try {
    json = JSON.stringify({
      ...(props || {}),
      viewAll: getString("common.actions.view_all", "View all"),
    });
  } catch (_) {
    json = "{}";
  }
  return (
    <div data-canopy-related-items="1">
      <script
        type="application/json"
        dangerouslySetInnerHTML={{__html: json}}
      />
    </div>
  );
}
