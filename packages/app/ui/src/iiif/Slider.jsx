import React, {useEffect, useState} from "react";
import {cloverSlider} from "./clover-compat.js";
import {mergeSliderOptions, normalizeSliderOptions} from "./sliderOptions.js";

// Clover 4's Items, as a slider. The server draws a placeholder, which the slider
// runtime mounts; in a page's own React tree, Items loads on demand, from its own entry.
export const Slider = (props = {}) => {
  const [CloverSlider, setCloverSlider] = useState(null);

  useEffect(() => {
    let mounted = true;
    const canUseDom =
      typeof window !== "undefined" && typeof document !== "undefined";
    if (canUseDom) {
      import("@nulib/clover/items")
        .then((items) => {
          if (!mounted) return;
          const Comp = cloverSlider(items);
          setCloverSlider(() => Comp);
        })
        .catch(() => {
          // Silently ignore load errors on the server or if Clover is unavailable
        });
    }
    return () => {
      mounted = false;
    };
  }, []);

  const {className, ...rest} = props || {};
  const sliderClassName = ["canopy-slider", className]
    .filter(Boolean)
    .join(" ");
  const mergedOptions = mergeSliderOptions(rest.options);
  const normalizedOptions = normalizeSliderOptions(mergedOptions);
  const resolvedProps = {
    ...rest,
    className: sliderClassName,
    options: normalizedOptions,
  };

  if (!CloverSlider) {
    // SSR placeholder for client hydration; props provided as JSON
    let json = "{}";
    try {
      json = JSON.stringify(resolvedProps || {});
    } catch (_) {
      json = "{}";
    }
    return (
      <div className={sliderClassName} data-canopy-slider="1">
        <script
          type="application/json"
          dangerouslySetInnerHTML={{__html: json}}
        />
      </div>
    );
  }
  return <CloverSlider {...resolvedProps} />;
};
