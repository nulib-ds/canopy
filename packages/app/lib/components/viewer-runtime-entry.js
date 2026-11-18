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

/*
 * A work page's viewer (`.canopy-work--layout`, a site's `content/works/_layout.mdx`): a
 * toggle at its top corner spreads it across the column, the work's words stacked under
 * it, and back. A toggle button (`aria-pressed`) named in the page's words (the Viewer's
 * `data-canopy-viewer-widen`, `common.actions.widen_viewer`), its name the same either
 * way. The visitor's choice holds for the next work they open, where the browser keeps it.
 * Its look, and where it shows, are `ui/styles/components/_work.scss`.
 */
const WORK_VIEWER_KEY = 'canopy:work-viewer';
const WIDEN_ICONS =
  '<svg class="canopy-work__widen-icon canopy-work__widen-icon--widen" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M3 12h18M7 8l-4 4 4 4M17 8l4 4-4 4"/></svg>' +
  '<svg class="canopy-work__widen-icon canopy-work__widen-icon--narrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M3 8l4 4-4 4M21 8l-4 4 4 4M10 12h4"/></svg>';

function setupWorkLayouts() {
  document.querySelectorAll('.canopy-work--layout').forEach((layout) => {
    try {
      const primary = layout.querySelector(':scope > .canopy-work--primary');
      const viewer = primary && primary.querySelector('[data-canopy-viewer]');
      if (!viewer || primary.querySelector(':scope > .canopy-work__widen')) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'canopy-work__widen';
      button.setAttribute('aria-label', viewer.getAttribute('data-canopy-viewer-widen') || 'Widen the viewer');
      button.innerHTML = WIDEN_ICONS;
      let wide = false;
      try {
        wide = window.localStorage.getItem(WORK_VIEWER_KEY) === 'wide';
      } catch (_) {}
      const apply = (next) => {
        wide = next;
        layout.setAttribute('data-viewer', wide ? 'wide' : 'split');
        button.setAttribute('aria-pressed', wide ? 'true' : 'false');
        // The viewer's canvas fits itself to its new width.
        try {
          window.dispatchEvent(new Event('resize'));
        } catch (_) {}
      };
      button.addEventListener('click', () => {
        apply(!wide);
        try {
          window.localStorage.setItem(WORK_VIEWER_KEY, wide ? 'wide' : 'split');
        } catch (_) {}
      });
      primary.insertBefore(button, primary.firstChild);
      apply(wide);
    } catch (_) {}
  });
}

ready(() => {
  setupWorkLayouts();
  mountAll('[data-canopy-viewer]', 'viewer');
  mountAll('[data-canopy-scroll]', 'scroll');
  mountAll('[data-canopy-image]', 'image');
});
