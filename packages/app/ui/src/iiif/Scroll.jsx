import React, { useEffect, useState } from "react";
import { cloverScroll, noticeUnsupported } from "./clover-compat.js";

// Scroll, for now Clover 4's Document template, until a text-focused reader composed
// from Clover's parts replaces it. The server draws a placeholder, which the viewer
// runtime mounts; in a page's own React tree, Clover loads on demand.
export const Scroll = (props) => {
  const [CloverScroll, setCloverScroll] = useState(null);

  useEffect(() => {
    let mounted = true;
    const canUseDom =
      typeof window !== "undefined" && typeof document !== "undefined";
    if (canUseDom) {
      Promise.all([
        import("@nulib/clover/viewer"),
        import("@nulib/clover/templates"),
      ])
        .then(([viewer, templates]) => {
          if (!mounted) return;
          const Comp = cloverScroll(viewer, templates);
          setCloverScroll(() => Comp);
        })
        .catch(() => {
          // Silently ignore load errors during SSR or when Clover is unavailable.
        });
    }
    return () => {
      mounted = false;
    };
  }, []);

  if (!CloverScroll) {
    noticeUnsupported("Scroll", props);
    // SSR placeholder for client hydration; props provided as JSON
    let json = "{}";
    try {
      json = JSON.stringify(props || {});
    } catch (_) {
      json = "{}";
    }
    return (
      <div data-canopy-scroll="1" className="not-prose">
        <script
          type="application/json"
          dangerouslySetInnerHTML={{ __html: json }}
        />
      </div>
    );
  }

  return <CloverScroll {...props} />;
};
