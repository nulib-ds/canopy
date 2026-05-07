import React from "react";
import SearchPanel from "../search/SearchPanel.jsx";
import CanopyBrand from "./CanopyBrand.jsx";
import CanopyModal from "./CanopyModal.jsx";
import NavigationTree from "./NavigationTree.jsx";
import getSafePageContext from "./pageContext.js";
import LanguageToggle from "./LanguageToggle.jsx";
import {useLocale} from "../locale/index.js";

function HeaderScript() {
  const code = `
(function () {
  if (typeof window === 'undefined') return;

  var doc = document;
  var body = doc.body;
  var root = doc.documentElement;

  function desktopBreakpointQuery() {
    if (typeof window === 'undefined') return '(min-width: 70rem)';
    try {
      var styles = window.getComputedStyle ? window.getComputedStyle(root) : null;
      var value = styles ? styles.getPropertyValue('--canopy-desktop-breakpoint') : '';
      if (typeof value === 'string') value = value.trim();
      if (!value) value = '70rem';
      return '(min-width: ' + value + ')';
    } catch (error) {
      return '(min-width: 70rem)';
    }
  }

  function ready(fn) {
    if (doc.readyState === 'loading') {
      doc.addEventListener('DOMContentLoaded', fn, { once: true });
    } else {
      fn(); 
    }
  }

  ready(function () {
    var header = doc.querySelector('.canopy-header');
    if (!header) return;

    var NAV_ATTR = 'data-mobile-nav';
    var SEARCH_ATTR = 'data-mobile-search';
    var NAV_ITEM_ATTR = 'data-canopy-nav-item';
    var NAV_ITEM_TOGGLE_ATTR = 'data-canopy-nav-item-toggle';

    function modalFor(type) {
      return doc.querySelector('[data-canopy-modal="' + type + '"]');
    }

    function each(list, fn) {
      if (!list || typeof fn !== 'function') return;
      Array.prototype.forEach.call(list, fn);
    }

    function setExpanded(type, expanded) {
      var toggles = header.querySelectorAll('[data-canopy-header-toggle="' + type + '"]');
      each(toggles, function (btn) {
        btn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      });
      var modal = modalFor(type);
      if (modal) {
        modal.setAttribute('data-open', expanded ? 'true' : 'false');
        modal.setAttribute('aria-hidden', expanded ? 'false' : 'true');
      }
    }

    function lockScroll(shouldLock) {
      if (!body) return;
      if (shouldLock) {
        if (!body.dataset.canopyScrollLock) {
          body.dataset.canopyScrollPrevOverflow = body.style.overflow || '';
          if (root && root.dataset) {
            root.dataset.canopyScrollPrevOverflow = root.style.overflow || '';
          }
        }
        body.dataset.canopyScrollLock = '1';
        body.style.overflow = 'hidden';
        if (root) root.style.overflow = 'hidden';
      } else {
        if (body.dataset.canopyScrollLock) {
          delete body.dataset.canopyScrollLock;
          body.style.overflow = body.dataset.canopyScrollPrevOverflow || '';
          delete body.dataset.canopyScrollPrevOverflow;
        }
        if (root && root.dataset) {
          root.style.overflow = root.dataset.canopyScrollPrevOverflow || '';
          delete root.dataset.canopyScrollPrevOverflow;
        }
      }
    }

    function stateFor(type) {
      if (type === 'nav') return header.getAttribute(NAV_ATTR);
      if (type === 'search') return header.getAttribute(SEARCH_ATTR);
      return 'closed';
    }

    function focusSearchForm() {
      var input = header.querySelector('[data-canopy-search-form-input]');
      if (!input) return;
      var raf = typeof window !== 'undefined' && window.requestAnimationFrame;
      (raf || function (fn) { return setTimeout(fn, 16); })(function () {
        try {
          input.focus({ preventScroll: true });
        } catch (_) {
          try { input.focus(); } catch (_) {}
        }
      });
    }

    function focusNavMenu() {
      var modal = modalFor('nav');
      if (!modal) return;
      var target = modal.querySelector('button, a, input, [tabindex]:not([tabindex="-1"])');
      if (!target) return;
      var raf = typeof window !== 'undefined' && window.requestAnimationFrame;
      (raf || function (fn) { return setTimeout(fn, 16); })(function () {
        try {
          target.focus({ preventScroll: true });
        } catch (_) {
          try { target.focus(); } catch (_) {}
        }
      });
    }

    function forEachNavTree(scope, fn) {
      if (typeof fn !== 'function') return;
      var rootNode = scope || doc;
      var trees = rootNode.querySelectorAll('[data-canopy-nav-tree]');
      each(trees, function (tree) {
        fn(tree);
      });
    }

    function resetNavItemToggles(scope) {
      forEachNavTree(scope, function (tree) {
        var toggles = tree.querySelectorAll('[' + NAV_ITEM_TOGGLE_ATTR + ']');
        each(toggles, function (btn) {
          btn.setAttribute('aria-expanded', 'false');
          var targetId = btn.getAttribute(NAV_ITEM_TOGGLE_ATTR);
          var panel = targetId ? doc.getElementById(targetId) : null;
          var parent = btn.closest('[' + NAV_ITEM_ATTR + ']');
          if (panel) {
            panel.hidden = true;
            panel.setAttribute('aria-hidden', 'true');
            panel.setAttribute('hidden', '');
          }
          if (parent) parent.setAttribute('data-expanded', 'false');
        });
      });
    }

    function applyDefaultNavItemState(scope) {
      forEachNavTree(scope, function (tree) {
        var defaults = tree.querySelectorAll('[data-default-expanded="true"]');
        each(defaults, function (item) {
          var toggle = item.querySelector('[' + NAV_ITEM_TOGGLE_ATTR + ']');
          var targetId = toggle ? toggle.getAttribute(NAV_ITEM_TOGGLE_ATTR) : null;
          var panel = targetId ? doc.getElementById(targetId) : null;
          item.setAttribute('data-expanded', 'true');
          if (toggle) toggle.setAttribute('aria-expanded', 'true');
          if (panel) {
            panel.hidden = false;
            panel.removeAttribute('hidden');
            panel.setAttribute('aria-hidden', 'false');
          }
        });
      });
    }

    function setState(type, next) {
      if (type === 'nav') header.setAttribute(NAV_ATTR, next);
      if (type === 'search') header.setAttribute(SEARCH_ATTR, next);
      setExpanded(type, next === 'open');
      var navOpen = header.getAttribute(NAV_ATTR) === 'open';
      var searchOpen = header.getAttribute(SEARCH_ATTR) === 'open';
      lockScroll(navOpen || searchOpen);
      if (type === 'nav') {
        if (next !== 'open') {
          resetNavItemToggles(modalFor('nav'));
        } else {
          applyDefaultNavItemState(modalFor('nav'));
        }
      }
    }

    function toggle(type, force) {
      var current = stateFor(type) === 'open';
      var shouldOpen = typeof force === 'boolean' ? force : !current;
      if (shouldOpen && type === 'nav') setState('search', 'closed');
      if (shouldOpen && type === 'search') setState('nav', 'closed');
      setState(type, shouldOpen ? 'open' : 'closed');
      if (type === 'search' && shouldOpen) focusSearchForm();
      if (type === 'nav' && shouldOpen) focusNavMenu();
    }

    function setupNavItemToggles() {
      var toggles = doc.querySelectorAll('[' + NAV_ITEM_TOGGLE_ATTR + ']');
      each(toggles, function (btn) {
        if (btn.__canopyNavReady) return;
        btn.__canopyNavReady = true;
        btn.addEventListener('click', function (event) {
          event.preventDefault();
          event.stopPropagation();
          var targetId = btn.getAttribute(NAV_ITEM_TOGGLE_ATTR);
          if (!targetId) return;
          var panel = doc.getElementById(targetId);
          var parent = btn.closest('[' + NAV_ITEM_ATTR + ']');
          var expanded = btn.getAttribute('aria-expanded') === 'true';
          var next = !expanded;
          btn.setAttribute('aria-expanded', next ? 'true' : 'false');
          if (panel) {
            panel.hidden = !next;
            panel.setAttribute('aria-hidden', next ? 'false' : 'true');
            if (next) {
              panel.removeAttribute('hidden');
            } else {
              panel.setAttribute('hidden', '');
            }
          }
          if (parent) parent.setAttribute('data-expanded', next ? 'true' : 'false');
        });
      });
    }

    each(header.querySelectorAll('[data-canopy-header-toggle]'), function (btn) {
      btn.addEventListener('click', function (event) {
        event.preventDefault();
        var type = btn.getAttribute('data-canopy-header-toggle');
        if (!type) return;
        toggle(type);
      });
    });

    each(doc.querySelectorAll('[data-canopy-header-close]'), function (btn) {
      btn.addEventListener('click', function () {
        var type = btn.getAttribute('data-canopy-header-close');
        if (!type) return;
        toggle(type, false);
      });
    });

    var navModal = modalFor('nav');
    if (navModal) {
      navModal.addEventListener('click', function (event) {
        if (event.target === navModal) {
          toggle('nav', false);
          return;
        }
        var target = event.target && event.target.closest && event.target.closest('a');
        if (!target) return;
        toggle('nav', false);
      });
    }

    var searchModal = modalFor('search');
    if (searchModal) {
      searchModal.addEventListener('click', function (event) {
        if (event.target === searchModal) toggle('search', false);
      });
    }

    doc.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape') return;
      var navOpen = header.getAttribute(NAV_ATTR) === 'open';
      var searchOpen = header.getAttribute(SEARCH_ATTR) === 'open';
      if (!navOpen && !searchOpen) return;
      event.preventDefault();
      toggle('nav', false);
      toggle('search', false);
    });

    var mq = window.matchMedia(desktopBreakpointQuery());
    function syncDesktopState() {
      if (mq.matches) {
        setState('nav', 'closed');
        setState('search', 'closed');
        setExpanded('nav', false);
        setExpanded('search', false);
        lockScroll(false);
      }
    }

    try {
      mq.addEventListener('change', syncDesktopState);
    } catch (_) {
      mq.addListener(syncDesktopState);
    }

    setupNavItemToggles();
    applyDefaultNavItemState(null);
    syncDesktopState();
  });
})();
  `;

  return (
    <script
      dangerouslySetInnerHTML={{
        __html: code,
      }}
    />
  );
}

function ensureArray(navLinks) {
  if (!Array.isArray(navLinks)) return [];
  return navLinks.filter(
    (link) => link && typeof link === "object" && typeof link.href === "string",
  );
}

function normalizeHref(href) {
  if (typeof href !== "string") return "";
  let next = href.trim();
  if (!next) return "";
  try {
    const parsed = new URL(next, "https://canopy.local");
    next = parsed.pathname || "/";
  } catch (_) {
    next = next.replace(/[?#].*$/, "");
  }
  next = next.replace(/[?#].*$/, "");
  if (next.length > 1) {
    next = next.replace(/\/+$/, "");
  }
  if (!next) return "/";
  return next;
}

function doesLinkMatchSection(linkHref, sectionNavigation) {
  if (!sectionNavigation || !sectionNavigation.root || !linkHref) return false;
  const normalizedLink = normalizeHref(linkHref);
  if (!normalizedLink) return false;
  const root = sectionNavigation.root;
  if (
    typeof root.href === "string" &&
    normalizeHref(root.href) === normalizedLink
  ) {
    return true;
  }
  if (root.slug) {
    const slugPath = normalizeHref(`/${root.slug}`);
    if (slugPath && normalizedLink === slugPath) {
      return true;
    }
  }
  return false;
}

function rootSegmentFromHref(href) {
  const normalized = normalizeHref(href);
  if (!normalized || normalized === "/") return "";
  const trimmed = normalized.replace(/^\/+/, "");
  return trimmed.split("/")[0] || "";
}

function getLinkNavigationData(link, navigationRoots, sectionNavigation) {
  if (!link || typeof link.href !== "string") return null;
  const segment = rootSegmentFromHref(link.href);
  if (navigationRoots && segment && navigationRoots[segment]) {
    return navigationRoots[segment];
  }
  if (sectionNavigation && doesLinkMatchSection(link.href, sectionNavigation)) {
    return sectionNavigation;
  }
  return null;
}

export default function CanopyHeader(props = {}) {
  const {
    navigation: navLinksProp,
    searchLabel: searchLabelProp,
    searchHotkey = "mod+k",
    searchPlaceholder: searchPlaceholderProp,
    brandHref = "/",
    title: titleProp,
    logo: SiteLogo,
    languageToggle: languageToggleProp,
  } = props;

  const PageContext = getSafePageContext();
  const context = React.useContext(PageContext);
  const {getString, formatString} = useLocale();
  const contextPrimaryNav = context && Array.isArray(context.primaryNavigation)
    ? context.primaryNavigation
    : [];
  const navLinks = navLinksProp && navLinksProp.length
    ? ensureArray(navLinksProp)
    : ensureArray(contextPrimaryNav);
  const contextNavigation =
    context && context.navigation ? context.navigation : null;
  const contextSite = context && context.site ? context.site : null;
  const pageData = context && context.page ? context.page : null;
  const contextSiteTitle =
    contextSite && typeof contextSite.title === "string"
      ? contextSite.title.trim()
      : "";
  const siteLanguageToggle =
    contextSite && contextSite.languageToggle ? contextSite.languageToggle : null;
  const siteRoutes = contextSite && contextSite.routes ? contextSite.routes : null;
  const siteDefaultRoutes =
    contextSite && contextSite.routesDefault ? contextSite.routesDefault : null;
  const searchRouteValue =
    siteRoutes && typeof siteRoutes.search === "string"
      ? siteRoutes.search
      : "";
  const defaultSearchRoute =
    siteDefaultRoutes && typeof siteDefaultRoutes.search === "string"
      ? siteDefaultRoutes.search
      : "search";
  const trimmedSearchRoute = searchRouteValue
    ? searchRouteValue.replace(/^\/+|\/+$/g, "")
    : "";
  const usesDirectorySearchRoute =
    trimmedSearchRoute && trimmedSearchRoute !== (defaultSearchRoute || "search");
  const normalizedSearchRoute = usesDirectorySearchRoute
    ? `/${trimmedSearchRoute}/`
    : `/${(trimmedSearchRoute || defaultSearchRoute || "search").replace(/^\/+/, "")}/index.html`;
  const resolvedLanguageToggle =
    languageToggleProp === false
      ? null
      : languageToggleProp === true || typeof languageToggleProp === "undefined"
      ? siteLanguageToggle
      : languageToggleProp;
  const resolvedSearchLabel =
    searchLabelProp != null
      ? searchLabelProp
      : getString("common.nouns.search", "Search");
  const resolvedSearchPlaceholder =
    searchPlaceholderProp != null
      ? searchPlaceholderProp
      : getString("common.phrases.placeholder_search", "Search…");
  const primaryNavigationLabel = getString(
    "common.nouns.primary_navigation",
    "Primary navigation",
  );
  const openSearchButtonLabel = formatString(
    "common.phrases.open_content",
    "Open {content}",
    {content: resolvedSearchLabel},
  );
  const openNavButtonLabel = formatString(
    "common.phrases.open_content",
    "Open {content}",
    {content: primaryNavigationLabel},
  );
  const closeNavLabel = formatString(
    "common.phrases.close_content",
    "Close {content}",
    {content: primaryNavigationLabel},
  );
  const closeSearchLabel = formatString(
    "common.phrases.close_content",
    "Close {content}",
    {content: resolvedSearchLabel},
  );
  const defaultHeaderTitle = contextSiteTitle || "Site title";
  const normalizedTitleProp =
    typeof titleProp === "string" ? titleProp.trim() : "";
  const resolvedTitle = normalizedTitleProp || defaultHeaderTitle;
  const sectionNavigation =
    contextNavigation && contextNavigation.root ? contextNavigation : null;
  const navigationRoots =
    contextNavigation && contextNavigation.allRoots
      ? contextNavigation.allRoots
      : null;
  const sectionHeading =
    (sectionNavigation && sectionNavigation.title) ||
    (sectionNavigation && sectionNavigation.root
      ? sectionNavigation.root.title
      : "");
  const hasSectionNav = !!(
    sectionNavigation &&
    sectionNavigation.root &&
    Array.isArray(sectionNavigation.root.children) &&
    sectionNavigation.root.children.length
  );
  const sectionNavFallback = getString(
    "common.nouns.section_navigation",
    "Section navigation",
  );
  const sectionLabel = sectionHeading
    ? formatString(
        "common.phrases.nav_label",
        "{content} navigation",
        {content: sectionHeading},
      )
    : sectionNavFallback;
  const sectionAriaLabel = sectionHeading
    ? formatString(
        "common.phrases.nav_label",
        "{content} navigation",
        {content: sectionHeading},
      )
    : sectionNavFallback;
  const defaultSectionLabel = sectionLabel;
  const defaultSectionAriaLabel = sectionAriaLabel;
  const shouldAttachSectionNav = (link) => {
    const navData = getLinkNavigationData(
      link,
      navigationRoots,
      sectionNavigation,
    );
    const rootNode = navData && navData.root;
    return !!(
      rootNode &&
      Array.isArray(rootNode.children) &&
      rootNode.children.length
    );
  };
  const hasIntegratedSectionNav = navLinks.some(shouldAttachSectionNav);

  return (
    <>
      <header
        className="canopy-header"
        data-mobile-nav="closed"
        data-mobile-search="closed"
      >
        <div className="canopy-header__brand">
          <CanopyBrand
            label={resolvedTitle}
            href={brandHref}
            className="canopy-header__brand-link"
            Logo={SiteLogo}
          />
        </div>

        <div className="canopy-header__desktop-search">
          <SearchPanel
            label={resolvedSearchLabel}
            hotkey={searchHotkey}
            placeholder={resolvedSearchPlaceholder}
            searchPath={normalizedSearchRoute}
          />
        </div>

        <nav
          className="canopy-nav-links canopy-header__desktop-nav"
          aria-label={primaryNavigationLabel}
        >
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              aria-current={link.isActive ? "page" : undefined}
            >
              {link.label || link.href}
            </a>
          ))}
        </nav>

        <div className="canopy-header__actions">
          {resolvedLanguageToggle ? (
            <LanguageToggle
              languageToggle={resolvedLanguageToggle}
              page={pageData}
              variant="desktop"
              className="canopy-header__language-toggle canopy-header__language-toggle--desktop"
            />
          ) : null}
          <button
            type="button"
            className="canopy-header__icon-button canopy-header__search-trigger"
            aria-label={openSearchButtonLabel}
            aria-controls="canopy-modal-search"
            aria-expanded="false"
            data-canopy-header-toggle="search"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="canopy-header__search-icon"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m21 21-3.8-3.8M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z"
              />
            </svg>
          </button>
          <button
            type="button"
            className="canopy-header__icon-button canopy-header__menu"
            aria-label={openNavButtonLabel}
            aria-controls="canopy-modal-nav"
            aria-expanded="false"
            data-canopy-header-toggle="nav"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="1.5"
              stroke="currentColor"
              className="canopy-header__menu-icon"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
              />
            </svg>
          </button>
        </div>
      </header>

      <CanopyModal
        id="canopy-modal-nav"
        variant="nav"
        labelledBy="canopy-modal-nav-label"
        label={resolvedTitle}
        logo={SiteLogo}
        href={brandHref}
        closeLabel={closeNavLabel}
        closeDataAttr="nav"
      >
        {resolvedLanguageToggle ? (
          <LanguageToggle
            languageToggle={resolvedLanguageToggle}
            page={pageData}
            variant="mobile"
            className="canopy-header__language-toggle canopy-header__language-toggle--mobile"
          />
        ) : null}
        <nav
          className="canopy-nav-links canopy-modal__nav"
          aria-label={primaryNavigationLabel}
        >
          <ul className="canopy-modal__nav-list" role="list">
            {navLinks.map((link, index) => {
              const navData = getLinkNavigationData(
                link,
                navigationRoots,
                sectionNavigation,
              );
              const navRoot = navData && navData.root ? navData.root : null;
              const hasChildren = !!(
                navRoot &&
                Array.isArray(navRoot.children) &&
                navRoot.children.length
              );
              const nestedId = hasChildren
                ? `canopy-modal-section-${index}`
                : null;
              const toggleLabelTarget = link.label
                ? formatString(
                    "common.phrases.nav_label",
                    "{content} navigation",
                    {content: link.label},
                  )
                : primaryNavigationLabel;
              const toggleLabel = formatString(
                "common.phrases.toggle_content",
                "Toggle {content}",
                {content: toggleLabelTarget},
              );
              const defaultExpanded = hasChildren && !!navRoot.isExpanded;
              return (
                <li
                  className="canopy-modal__nav-item"
                  key={link.href}
                  data-canopy-nav-item={hasChildren ? "true" : undefined}
                  data-expanded={defaultExpanded ? "true" : "false"}
                  data-default-expanded={defaultExpanded ? "true" : undefined}
                >
                  <div className="canopy-modal__nav-row">
                    <a href={link.href}>{link.label || link.href}</a>
                    {hasChildren ? (
                      <button
                        type="button"
                        className="canopy-modal__nav-toggle"
                        aria-expanded={defaultExpanded ? "true" : "false"}
                        aria-controls={nestedId || undefined}
                        aria-label={toggleLabel}
                        data-canopy-nav-item-toggle={nestedId || undefined}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          className="canopy-modal__nav-toggle-icon"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 9l7 7 7-7"
                          />
                        </svg>
                        <span className="sr-only">{toggleLabel}</span>
                      </button>
                    ) : null}
                  </div>
                  {hasChildren ? (
                    <NavigationTree
                      root={navRoot}
                      parentKey={
                        navData && navData.rootSegment
                          ? navData.rootSegment
                          : `root-${index}`
                      }
                      component="div"
                      className="canopy-modal__section-nav canopy-modal__section-nav--nested"
                      aria-label={
                        navData && navData.title
                          ? formatString(
                              "common.phrases.nav_label",
                              "{content} navigation",
                              {content: navData.title},
                            )
                          : defaultSectionAriaLabel
                      }
                      aria-hidden={defaultExpanded ? "false" : "true"}
                      hidden={!defaultExpanded}
                      id={nestedId || undefined}
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
        </nav>
        {hasSectionNav && !hasIntegratedSectionNav ? (
          <NavigationTree
            root={sectionNavigation.root}
            component="nav"
            className="canopy-modal__section-nav"
            aria-label={defaultSectionAriaLabel}
            parentKey="fallback-nav"
          />
        ) : null}
      </CanopyModal>

      <CanopyModal
        id="canopy-modal-search"
        variant="search"
        labelledBy="canopy-modal-search-label"
        label={resolvedTitle}
        logo={SiteLogo}
        href={brandHref}
        closeLabel={closeSearchLabel}
        closeDataAttr="search"
        bodyClassName="canopy-modal__body--search"
      >
        <SearchPanel
          label={resolvedSearchLabel}
          hotkey={searchHotkey}
          placeholder={resolvedSearchPlaceholder}
          searchPath={normalizedSearchRoute}
        />
      </CanopyModal>

      <HeaderScript />
    </>
  );
}
