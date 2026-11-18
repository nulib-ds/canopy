import React, { useEffect, useState } from "react";
import {cloverViewer, noticeUnsupported} from "./clover-compat.js";
import {useLocale} from "../locale/index.js";

// Clover 4's Viewer, in its Default template. The server draws a placeholder, which
// the viewer runtime mounts; in a page's own React tree, Clover loads on demand, from
// its own entries, so a page without a Viewer never carries it.

// Default Clover viewer options; can be overridden per-usage via props.options
const DEFAULT_VIEWER_OPTIONS = {
  showDownload: false,
  showIIIFBadge: false,
  showTitle: false,
  informationPanel: {
    open: false,
    renderAbout: false,
    renderToggle: false,
  },
};

function isPlainObject(val) {
  return val && typeof val === "object" && !Array.isArray(val);
}

function deepMerge(base, override) {
  if (!isPlainObject(base)) return override;
  const out = { ...base };
  if (!isPlainObject(override)) return out;
  for (const key of Object.keys(override)) {
    const a = base[key];
    const b = override[key];
    if (isPlainObject(a) && isPlainObject(b)) out[key] = deepMerge(a, b);
    else out[key] = b;
  }
  return out;
}

export const Viewer = (props) => {
  const [CloverViewer, setCloverViewer] = useState(null);
  const {getString} = useLocale();
  const mergedOptions = deepMerge(
    DEFAULT_VIEWER_OPTIONS,
    props && props.options
  );
  const crossOriginExplicitlyUndefined =
    props &&
    props.options &&
    Object.prototype.hasOwnProperty.call(props.options, "crossOrigin") &&
    props.options.crossOrigin === undefined;
  if (crossOriginExplicitlyUndefined) {
    mergedOptions.crossOrigin = null;
  }

  useEffect(() => {
    let mounted = true;
    const canUseDom =
      typeof window !== "undefined" && typeof document !== "undefined";
    if (canUseDom) {
      Promise.all([
        import("@nulib/clover/viewer"),
        import("@nulib/clover/templates"),
        import("@nulib/clover/helpers"),
      ])
        .then(([viewer, templates, helpers]) => {
          if (!mounted) return;
          const Comp = cloverViewer(viewer, templates, helpers);
          setCloverViewer(() => Comp);
        })
        .catch(() => {
          // Silently ignore load errors on the server or if Clover is unavailable
        });
    }
    return () => {
      mounted = false;
    };
  }, []);

  if (!CloverViewer) {
    noticeUnsupported("Viewer", {...(props || {}), options: mergedOptions});
    // SSR placeholder for client hydration; props provided as JSON
    let json = "{}";
    try {
      const p = { ...(props || {}) };
      if (mergedOptions) p.options = mergedOptions;
      json = JSON.stringify(p);
    } catch (_) {
      json = "{}";
    }
    return (
      // `clover-viewer`, Clover 3's root, for a site's 1.x styles (`version-parity.css`).
      // On a work page the viewer runtime adds a toggle beside it, named in the page's
      // words (`viewer-runtime-entry.js`).
      <div
        data-canopy-viewer="1"
        data-canopy-viewer-widen={getString("common.actions.widen_viewer", "Widen the viewer")}
        className="not-prose clover-viewer"
      >
        <script
          type="application/json"
          dangerouslySetInnerHTML={{ __html: json }}
        />
      </div>
    );
  }
  return <CloverViewer {...props} options={mergedOptions} />;
};
