import React from 'react';
import { createRoot } from 'react-dom/client';

import { cloverImage, cloverScroll, cloverViewer } from '../../ui/dist/index.mjs';

function ready(fn) {
  if (typeof document === 'undefined') return;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fn, { once: true });
  } else {
    fn();
  }
}

function parseProps(el) {
  try {
    const script = el.querySelector('script[type="application/json"]');
    if (script) return JSON.parse(script.textContent || '{}');
    const raw = el.getAttribute('data-props') || '{}';
    return JSON.parse(raw);
  } catch (_) {
    return {};
  }
}

/*
 * Clover 4 (`@nulib/clover`), a part at a time: each loads from its own entry, so esbuild
 * reaches only that part's modules rather than every part the Default template shares
 * through the package's main entry. Canopy's MDX props, as 1.x authors write them, are
 * translated into Clover's (`ui/src/iiif/clover-compat.js`).
 */
const componentLoaders = {
  // The Viewer in Clover's Default template, handed in so it loads with the Viewer.
  viewer: () =>
    Promise.all([
      import('@nulib/clover/viewer'),
      import('@nulib/clover/templates'),
      import('@nulib/clover/helpers'),
    ]).then(([viewer, templates, helpers]) => cloverViewer(viewer, templates, helpers)),
  // Scroll, for now Clover's Document template, until its text reader is built.
  scroll: () =>
    Promise.all([
      import('@nulib/clover/viewer'),
      import('@nulib/clover/templates'),
    ]).then(([viewer, templates]) => cloverScroll(viewer, templates)),
  // Image: one Canvas, deep zoom where its image has a service.
  image: () => import('@nulib/clover/canvas').then(cloverImage),
};

const componentCache = new Map();

function resolveComponent(key) {
  if (!componentLoaders[key]) return Promise.resolve(null);
  if (!componentCache.has(key)) {
    componentCache.set(key, componentLoaders[key]().catch((error) => {
      console.error('[canopy] Clover failed to load', error);
      return null;
    }));
  }
  return componentCache.get(key);
}

function mountAll(selector, key) {
  try {
    const nodes = document.querySelectorAll(selector);
    if (!nodes || !nodes.length) return;
    const rootApi = typeof createRoot === 'function' ? createRoot : null;
    if (!React || !rootApi) return;
    resolveComponent(key).then((Component) => {
      if (!Component) return;
      nodes.forEach((el) => {
        try {
          if (el.__canopyHydrated) return;
          const props = parseProps(el);
          const root = rootApi(el);
          root.render(React.createElement(Component, props));
          el.__canopyHydrated = true;
        } catch (_) {}
      });
    });
  } catch (_) {}
}

ready(() => {
  mountAll('[data-canopy-viewer]', 'viewer');
  mountAll('[data-canopy-scroll]', 'scroll');
  mountAll('[data-canopy-image]', 'image');
});
