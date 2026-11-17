import React, {useEffect, useState} from "react";
import {cloverImage, noticeUnsupported} from "./clover-compat.js";

// Clover 4's Canvas, in a figure with Canopy's caption. The server draws a placeholder,
// which the viewer runtime mounts; in a page's own React tree, the Canvas loads on
// demand, from its own entry.
export const Image = (props = {}) => {
  const [CloverImage, setCloverImage] = useState(null);
  const baseClass = "canopy-iiif-image";
  const {
    height = `600px`,
    backgroundColor = `var(--color-gray-200)`,
    caption,
    className: userClassName,
  } = props || {};
  const rootClassName = [userClassName, baseClass].filter(Boolean).join(" ");

  useEffect(() => {
    let mounted = true;
    const canUseDom =
      typeof window !== "undefined" && typeof document !== "undefined";
    if (canUseDom) {
      import("@nulib/clover/canvas")
        .then((canvas) => {
          if (!mounted) return;
          const Comp = cloverImage(canvas);
          setCloverImage(() => Comp);
        })
        .catch(() => {
          // Suppress errors during SSR or when the Clover bundle is unavailable.
        });
    }
    return () => {
      mounted = false;
    };
  }, []);

  if (!CloverImage) {
    noticeUnsupported("Image", props);
    let json = "{}";
    try {
      json = JSON.stringify(props || {});
    } catch (_) {
      json = "{}";
    }

    return (
      <figure className={rootClassName}>
        <div
          className={`${baseClass}__placeholder`}
          data-canopy-image="1"
          style={{
            "--canopy-iiif-image-height": height,
            "--canopy-iiif-image-bg": backgroundColor,
          }}
        >
          <script
            type="application/json"
            dangerouslySetInnerHTML={{__html: json}}
          />
        </div>
        {caption && (
          <figcaption className={`${baseClass}__caption`}>
            {caption}
          </figcaption>
        )}
      </figure>
    );
  }

  return <CloverImage {...props} className={rootClassName} />;
};
