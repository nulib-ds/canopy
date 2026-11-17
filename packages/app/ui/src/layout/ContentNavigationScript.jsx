import React from 'react';

export default function ContentNavigationScript() {
  const code = `
(function () {
  if (typeof window === 'undefined') return;
  if (window.__CANOPY_CONTENT_NAV_READY__) return;
  window.__CANOPY_CONTENT_NAV_READY__ = true;
  var STORAGE_KEY = 'canopy_content_nav_collapsed';
  var storage = null;
  try {
    storage = window.localStorage;
  } catch (error) {
    storage = null;
  }

  function setStored(value) {
    if (!storage) return;
    try {
      if (value == null) {
        storage.removeItem(STORAGE_KEY);
      } else {
        storage.setItem(STORAGE_KEY, value);
      }
    } catch (error) {}
  }

  function getStored() {
    if (!storage) return null;
    try {
      return storage.getItem(STORAGE_KEY);
    } catch (error) {
      return null;
    }
  }

  function ready(fn) {
    if (!fn) return;
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn, { once: true });
    } else {
      fn();
    }
  }

  function applyState(root, collapsed) {
    if (!root) return;
    var isCollapsed = !!collapsed;
    root.classList.toggle('is-collapsed', isCollapsed);
    var layout = root.closest('.canopy-layout');
    if (layout) layout.classList.toggle('canopy-layout--content-nav-collapsed', isCollapsed);
    var nav = root.querySelector('[data-canopy-content-nav]');
    if (nav) {
      nav.classList.toggle('canopy-content-navigation--collapsed', isCollapsed);
      nav.classList.toggle('canopy-content-navigation--expanded', !isCollapsed);
      nav.setAttribute('data-expanded', isCollapsed ? 'false' : 'true');
    }
    var toggle = root.querySelector('[data-canopy-content-nav-toggle]');
    if (toggle) {
      var showLabel = toggle.getAttribute('data-show-label') || 'Show';
      var hideLabel = toggle.getAttribute('data-hide-label') || 'Hide';
      var showFull = toggle.getAttribute('data-show-full-label') || 'Show section navigation';
      var hideFull = toggle.getAttribute('data-hide-full-label') || 'Hide section navigation';
      var labelNode = toggle.querySelector('[data-canopy-content-nav-toggle-label]');
      var srNode = toggle.querySelector('[data-canopy-content-nav-toggle-sr]');
      toggle.setAttribute('aria-expanded', isCollapsed ? 'false' : 'true');
      toggle.setAttribute('aria-label', isCollapsed ? showFull : hideFull);
      toggle.setAttribute('title', isCollapsed ? showFull : hideFull);
      toggle.classList.toggle('is-collapsed', isCollapsed);
      toggle.classList.toggle('is-expanded', !isCollapsed);
      if (!labelNode) {
        toggle.textContent = isCollapsed ? showLabel : hideLabel;
      }
      if (srNode) {
        srNode.textContent = isCollapsed ? showFull : hideFull;
      }
    }
    if (root.__canopyContentNavSync) {
      try {
        root.__canopyContentNavSync();
      } catch (_) {}
    }
  }

  function setupFloatingState(root) {
    if (!root || typeof IntersectionObserver !== 'function') return;
    if (root.__canopyContentNavFloating) return;
    var nav = root.querySelector('[data-canopy-content-nav]');
    if (!nav) return;
    var sentinel = root.querySelector('[data-canopy-content-nav-sentinel]');
    if (!sentinel) {
      sentinel = document.createElement('div');
      sentinel.setAttribute('aria-hidden', 'true');
      sentinel.setAttribute('data-canopy-content-nav-sentinel', 'true');
      root.insertBefore(sentinel, nav);
    }
    var placeholder = root.querySelector('[data-canopy-content-nav-placeholder]');
    if (!placeholder) {
      placeholder = document.createElement('div');
      placeholder.setAttribute('aria-hidden', 'true');
      placeholder.setAttribute('data-canopy-content-nav-placeholder', 'true');
      if (nav.nextSibling) {
        root.insertBefore(placeholder, nav.nextSibling);
      } else {
        root.appendChild(placeholder);
      }
    }
    root.__canopyContentNavFloating = true;

    function syncPosition() {
      try {
        var rect = root.getBoundingClientRect();
        nav.style.setProperty('--canopy-content-nav-fixed-left', rect.left + 'px');
        nav.style.setProperty('--canopy-content-nav-fixed-width', rect.width + 'px');
        if (placeholder) placeholder.style.width = rect.width + 'px';
      } catch (_) {}
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var stuck = !entry.isIntersecting && entry.boundingClientRect.top < 0;
        nav.classList.toggle('canopy-content-navigation--floating', stuck);
        nav.setAttribute('data-stuck', stuck ? 'true' : 'false');
        if (placeholder) {
          placeholder.style.height = stuck ? nav.offsetHeight + 'px' : '0px';
        }
      });
    });

    observer.observe(sentinel);
    syncPosition();
    var handleResize = function () {
      syncPosition();
    };
    window.addEventListener('resize', handleResize);
    root.__canopyContentNavCleanup = function () {
      observer.disconnect();
      window.removeEventListener('resize', handleResize);
    };
    root.__canopyContentNavSync = syncPosition;
  }

  function computeOffsetPx() {
    try {
      var root = document.documentElement;
      var style = root ? window.getComputedStyle(root) : null;
      // Where a heading lands when its link is followed: under the sticky header, if it
      // sticks (\`scroll-padding-top\`, \`header/_header.scss\`).
      var padding = style ? parseFloat(style.scrollPaddingTop) || 0 : 0;
      if (padding > 0) return padding;
      var size = style ? parseFloat(style.fontSize || '16') || 16 : 16;
      return size * 1.618;
    } catch (error) {
      return 0;
    }
  }

  function setupActiveHeadingWatcher(root) {
    if (!root || root.__canopyContentNavActive) return;
    var nav = root.querySelector('[data-canopy-content-nav]');
    if (!nav) return;
    var linkNodes = Array.prototype.slice.call(
      nav.querySelectorAll('.canopy-nav-tree__link[href^="#"]')
    );
    var entries = linkNodes
      .map(function (link) {
        if (!link || !link.getAttribute) return null;
        var href = link.getAttribute('href') || '';
        if (!href || href.charAt(0) !== '#') return null;
        var id = href.slice(1);
        if (!id) return null;
        var target = document.getElementById(id);
        if (!target) return null;
        return {
          id: id,
          link: link,
          target: target,
          item: link.closest('[data-canopy-nav-item]') || null,
        };
      })
      .filter(Boolean);
    if (!entries.length) return;
    root.__canopyContentNavActive = true;
    var activeId = null;

    function expandParents(link) {
      var parent = link ? link.closest('[data-canopy-nav-item]') : null;
      while (parent) {
        parent.setAttribute('data-expanded', 'true');
        var toggle = parent.querySelector('[data-canopy-nav-item-toggle]');
        if (toggle) {
          toggle.setAttribute('aria-expanded', 'true');
          var targetId = toggle.getAttribute('data-canopy-nav-item-toggle');
          if (targetId) {
            var panel = document.getElementById(targetId);
            if (panel) {
              panel.hidden = false;
              panel.removeAttribute('hidden');
              panel.setAttribute('aria-hidden', 'false');
            }
          }
        }
        parent = parent.parentElement
          ? parent.parentElement.closest('[data-canopy-nav-item]')
          : null;
      }
    }

    function applyActive(id) {
      if (!id || activeId === id) return;
      activeId = id;
      var activeParents = new Set();
      entries.forEach(function (entry) {
        var isActive = entry.id === id;
        entry.link.classList.toggle('is-active', isActive);
        if (entry.item) entry.item.classList.toggle('is-active', isActive);
        if (isActive) {
          expandParents(entry.link);
          var parent = entry.link.closest('[data-canopy-nav-item]');
          while (parent) {
            activeParents.add(parent);
            parent = parent.parentElement
              ? parent.parentElement.closest('[data-canopy-nav-item]')
              : null;
          }
        }
      });
      entries.forEach(function (entry) {
        var item = entry.item;
        if (!item) return;
        if (!activeParents.has(item) && entry.id !== id) {
          item.setAttribute('data-expanded', 'false');
          var toggle = item.querySelector('[data-canopy-nav-item-toggle]');
          if (toggle) {
            toggle.setAttribute('aria-expanded', 'false');
            var targetId = toggle.getAttribute('data-canopy-nav-item-toggle');
            if (targetId) {
              var panel = document.getElementById(targetId);
              if (panel) {
                panel.hidden = true;
                panel.setAttribute('hidden', '');
                panel.setAttribute('aria-hidden', 'true');
              }
            }
          }
        }
      });
    }

    function updateActive() {
      var offset = computeOffsetPx();
      var baseFont = 16;
      try {
        var root = document.documentElement;
        baseFont = parseFloat(window.getComputedStyle(root).fontSize || '16') || 16;
      } catch (_) {}
      var proximityLimit = baseFont * 5;
      var fallbackId = entries[0].id;
      var bestId = fallbackId;
      var bestDistance = Number.POSITIVE_INFINITY;
      entries.forEach(function (entry) {
        if (!entry || !entry.target) return;
        var rect = entry.target.getBoundingClientRect();
        var relativeTop = rect.top - offset;
        if (relativeTop < -proximityLimit) return;
        var distance = Math.abs(relativeTop);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestId = entry.id;
        }
      });
      applyActive(bestId || fallbackId);
    }

    updateActive();
    var ticking = false;
    function handle() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(function () {
        updateActive();
        ticking = false;
      });
    }
    window.addEventListener('scroll', handle, { passive: true });
    window.addEventListener('resize', handle);
  }

  ready(function () {
    var rootSet = new Set();
    var navNodes = Array.prototype.slice.call(
      document.querySelectorAll('[data-canopy-content-nav]')
    );
    navNodes.forEach(function (nav) {
      if (!nav || !nav.closest) return;
      var root = nav.closest('[data-canopy-content-nav-root]');
      if (!root) {
        root = nav.parentElement || nav;
        if (root && !root.hasAttribute('data-canopy-content-nav-root')) {
          root.setAttribute('data-canopy-content-nav-root', 'true');
        }
      }
      if (root) rootSet.add(root);
    });

    var roots = Array.from(rootSet);
    if (!roots.length) return;

    var collapsibleRoots = [];
    roots.forEach(function (root) {
      var nav = root.querySelector('[data-canopy-content-nav]');
      if (!nav) return;
      var isStatic = nav.classList.contains('canopy-content-navigation--static');
      if (isStatic) {
        root.classList.remove('is-collapsed');
        nav.classList.add('canopy-content-navigation--expanded');
        nav.classList.remove('canopy-content-navigation--collapsed');
        nav.setAttribute('data-expanded', 'true');
      } else {
        collapsibleRoots.push(root);
      }
      setupFloatingState(root);
      setupActiveHeadingWatcher(root);
    });

    if (!collapsibleRoots.length) return;

    var stored = getStored();
    var collapsed = true;
    var isDesktop = false;
    try {
      var bp = window.getComputedStyle(document.documentElement).getPropertyValue('--canopy-desktop-breakpoint') || '70rem';
      isDesktop = window.matchMedia('(min-width: ' + bp.trim() + ')').matches;
    } catch (_) {
      isDesktop = false;
    }
    if (!isDesktop) {
      collapsed = true;
    } else if (stored === '0' || stored === 'false') {
      collapsed = false;
    } else if (stored === '1' || stored === 'true') {
      collapsed = true;
    }

    function sync(next) {
      collapsed = !!next;
      collapsibleRoots.forEach(function (root) {
        applyState(root, collapsed);
      });
      setStored(collapsed ? '1' : '0');
    }

    sync(collapsed);

    collapsibleRoots.forEach(function (root) {
      var toggle = root.querySelector('[data-canopy-content-nav-toggle]');
      if (!toggle) return;
      toggle.addEventListener('click', function (event) {
        event.preventDefault();
        sync(!collapsed);
      });
    });
  });
})();
  `;

  return <script dangerouslySetInnerHTML={{__html: code}} />;
}
