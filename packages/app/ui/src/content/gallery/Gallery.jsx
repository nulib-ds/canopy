import React from "react";
import Button from "../../layout/Button.jsx";
import {useLocale} from "../../locale/index.js";
import {
  useReferencedManifestMap,
  resolveReferencedManifests,
} from "../../utils/manifestReferences.js";

const INLINE_SCRIPT = `(() => {
  if (typeof window === 'undefined') return;
  if (window.__canopyGalleryBound) return;
  window.__canopyGalleryBound = true;
  const focusableSelector =
    'a[href],area[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
  const raf =
    (window.requestAnimationFrame && window.requestAnimationFrame.bind(window)) ||
    function (cb) {
      return window.setTimeout(cb, 0);
    };
  let activeModal = null;
  const NAV_SELECTOR = '[data-canopy-gallery-nav]';
  const NAV_OPTION_SELECTOR = '[data-canopy-gallery-nav-option]';
  const NAV_ITEM_SELECTOR = '[data-canopy-gallery-nav-item]';

  function emitModalState(modal, state) {
    if (!modal || typeof window === 'undefined') return;
    const detail = { modalId: modal.id || '', modal, state };
    try {
      const EventCtor = window.CustomEvent || CustomEvent;
      if (typeof EventCtor === 'function') {
        window.dispatchEvent(new EventCtor('canopy:gallery:modal-change', { detail }));
        return;
      }
    } catch (_) {}
    try {
      const fallback = document.createEvent('CustomEvent');
      fallback.initCustomEvent('canopy:gallery:modal-change', true, true, detail);
      window.dispatchEvent(fallback);
    } catch (_) {}
  }

  function isVisible(node) {
    return !!(node && (node.offsetWidth || node.offsetHeight || node.getClientRects().length));
  }

  function getFocusable(modal) {
    if (!modal) return [];
    return Array.prototype.slice
      .call(modal.querySelectorAll(focusableSelector))
      .filter((node) => !node.hasAttribute('disabled') && node.getAttribute('aria-hidden') !== 'true' && isVisible(node));
  }

  function escapeSelector(value) {
    if (window.CSS && typeof window.CSS.escape === 'function') {
      return window.CSS.escape(value);
    }
    return value.replace(/"/g, '\\"');
  }

  function findTrigger(modal) {
    if (!modal || !modal.id) return null;
    try {
      return document.querySelector('[data-canopy-gallery-trigger="' + escapeSelector(modal.id) + '"]');
    } catch (_) {
      return null;
    }
  }

  function resetModalScroll(modal) {
    if (!modal) return;
    const panel = modal.querySelector('.canopy-gallery__modal-panel');
    if (panel) {
      panel.scrollTop = 0;
      panel.scrollLeft = 0;
    }
  }

  function getOptionItem(option) {
    if (!option || typeof option.closest !== 'function') return null;
    return option.closest(NAV_ITEM_SELECTOR);
  }

  function focusActiveNav(modal) {
    if (!modal) return false;
    const nav = modal.querySelector(NAV_SELECTOR);
    if (!nav) return false;
    const activeOption =
      nav.querySelector(NAV_OPTION_SELECTOR + ':checked') ||
      nav.querySelector(NAV_OPTION_SELECTOR);
    if (!activeOption) return false;
    raf(() => {
      try {
        activeOption.focus({preventScroll: true});
      } catch (_) {
        try {
          activeOption.focus();
        } catch (err) {}
      }
    });
    return true;
  }

  function focusInitial(modal) {
    if (!modal) return;
    const focusables = getFocusable(modal);
    const target = focusables[0] || modal;
    raf(() => {
      try {
        target.focus({preventScroll: true});
      } catch (_) {
        try {
          target.focus();
        } catch (err) {}
      }
    });
  }

  function lockScroll() {
    document.body && document.body.setAttribute('data-canopy-gallery-locked', '1');
  }

  function unlockScroll() {
    document.body && document.body.removeAttribute('data-canopy-gallery-locked');
  }

  function handleKeydown(event) {
    if (!activeModal) return;
    if (event.key === 'Escape' || event.key === 'Esc') {
      event.preventDefault();
      const closeId = activeModal.getAttribute('data-canopy-gallery-close');
      if (closeId) {
        const targetHash = '#' + closeId;
        if (window.location.hash !== targetHash) {
          window.location.hash = targetHash;
        } else {
          window.location.hash = targetHash;
        }
      } else {
        window.location.hash = '';
      }
      return;
    }
    if (event.key !== 'Tab') return;
    const focusables = getFocusable(activeModal);
    if (!focusables.length) {
      event.preventDefault();
      activeModal.focus();
      return;
    }
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const current = document.activeElement;
    if (event.shiftKey) {
      if (current === first || !activeModal.contains(current)) {
        event.preventDefault();
        last.focus();
      }
      return;
    }
    if (current === last || !activeModal.contains(current)) {
      event.preventDefault();
      first.focus();
    }
  }

  function setActiveModal(modal) {
    if (modal) {
      if (!activeModal) {
        lockScroll();
        document.addEventListener('keydown', handleKeydown, true);
      } else if (activeModal !== modal) {
        emitModalState(activeModal, 'close');
        activeModal.removeAttribute('data-canopy-gallery-active');
        setInert(activeModal, true);
      }
      activeModal = modal;
      setInert(modal, false);
      modal.setAttribute('data-canopy-gallery-active', '1');
      resetModalScroll(modal);
      if (!focusActiveNav(modal)) {
        focusInitial(modal);
      }
      emitModalState(modal, 'open');
      return;
    }
    if (!activeModal) return;
    const previous = activeModal;
    activeModal = null;
    previous.removeAttribute('data-canopy-gallery-active');
    setInert(previous, true);
    unlockScroll();
    document.removeEventListener('keydown', handleKeydown, true);
    const closeTarget = previous.getAttribute('data-canopy-gallery-close');
    if (closeTarget) {
      const closeHash = '#' + closeTarget;
      if (window.location.hash === closeHash) {
        try {
          if (window.history && typeof window.history.replaceState === 'function') {
            window.history.replaceState('', document.title, window.location.pathname + window.location.search);
          } else {
            window.location.hash = '';
          }
        } catch (_) {}
      }
    }
    const trigger = findTrigger(previous);
    if (trigger && typeof trigger.focus === 'function') {
      raf(() => {
        try {
          trigger.focus({preventScroll: true});
        } catch (_) {
          try {
            trigger.focus();
          } catch (err) {}
        }
      });
    }
    emitModalState(previous, 'close');
  }

  function closeModalFromBackground(modal) {
    if (!modal) return;
    const closeId = modal.getAttribute('data-canopy-gallery-close');
    const targetHash = closeId ? '#' + closeId : '';
    if (targetHash) {
      if (window.location.hash === targetHash) {
        try {
          window.location.hash = targetHash;
        } catch (_) {}
      } else {
        window.location.hash = targetHash;
      }
    } else {
      window.location.hash = '';
    }
  }

  function shouldCloseFromBackground(event, modal) {
    if (!event || !modal) return false;
    const target = event.target;
    if (!target) return false;
    const panel = modal.querySelector('.canopy-gallery__modal-panel');
    if (panel && panel.contains(target)) return false;
    const actions = modal.querySelector('.canopy-gallery__modal-actions');
    if (actions && actions.contains(target)) return false;
    if (target === modal) return true;
    const scrim = modal.querySelector('.canopy-gallery__modal-scrim');
    if (scrim && scrim.contains(target)) return true;
    return false;
  }

  // A closed popup is inert: out of the tab order and the accessibility tree, whatever
  // its contents' own styles say, as a viewer mounted in it may make its parts visible
  // again (2.4.3; ACCESSIBILITY.md C38). Open, it is not.
  function setInert(modal, inert) {
    if (!modal) return;
    if (inert) modal.setAttribute('inert', '');
    else modal.removeAttribute('inert');
  }

  function bindModalDismissal(modal) {
    if (!modal || modal.getAttribute('data-canopy-gallery-dismiss-bound') === '1') {
      return;
    }
    modal.setAttribute('data-canopy-gallery-dismiss-bound', '1');
    if (modal !== activeModal) setInert(modal, true);
    modal.addEventListener('click', function (event) {
      if (!shouldCloseFromBackground(event, modal)) return;
      event.preventDefault();
      closeModalFromBackground(modal);
    });
  }

  function bindModalDismissals() {
    const modals = document.querySelectorAll('[data-canopy-gallery-modal]');
    if (!modals || !modals.length) return;
    Array.prototype.forEach.call(modals, bindModalDismissal);
  }

  function modalFromHash() {
    const id = window.location.hash.replace(/^#/, '');
    if (!id) return null;
    const candidate = document.getElementById(id);
    if (!candidate) return null;
    return candidate.hasAttribute('data-canopy-gallery-modal') ? candidate : null;
  }

  function syncFromHash() {
    const modal = modalFromHash();
    if (modal) {
      setActiveModal(modal);
    } else {
      setActiveModal(null);
    }
  }

  function initGalleryNav(nav) {
    if (!nav || nav.getAttribute('data-canopy-gallery-nav-bound') === '1') {
      return;
    }
    const viewport =
      nav.querySelector('[data-canopy-gallery-nav-viewport]') ||
      nav.querySelector('[data-canopy-gallery-nav-track]');
    if (!viewport) return;
    const optionNodes = nav.querySelectorAll(NAV_OPTION_SELECTOR);
    const navOptions = optionNodes ? Array.prototype.slice.call(optionNodes) : [];
    if (!navOptions.length) return;
    nav.setAttribute('data-canopy-gallery-nav-bound', '1');
    const navModal = nav.closest('[data-canopy-gallery-modal]');
    const prevBtn =
      nav.querySelector('[data-canopy-gallery-nav-prev]') ||
      (navModal &&
        navModal.querySelector(
          '.canopy-gallery__modal-panel [data-canopy-gallery-nav-prev]'
        ));
    const nextBtn =
      nav.querySelector('[data-canopy-gallery-nav-next]') ||
      (navModal &&
        navModal.querySelector(
          '.canopy-gallery__modal-panel [data-canopy-gallery-nav-next]'
        ));

    function updateButtons() {
      if (prevBtn) prevBtn.disabled = false;
      if (nextBtn) nextBtn.disabled = false;
    }

    function getOptionLabel(option) {
      if (!option) return null;
      let label = option.nextElementSibling;
      if (label && label.tagName && label.tagName.toLowerCase() === 'label') {
        return label;
      }
      if (option.id) {
        try {
          label = nav.querySelector('label[for="' + escapeSelector(option.id) + '"]');
          if (label) return label;
        } catch (_) {}
      }
      return null;
    }

    function getTargetIdFromOption(option) {
      if (!option) return '';
      const dataId = option.getAttribute('data-canopy-gallery-nav-modal');
      if (dataId) return String(dataId);
      const value = option.value || option.getAttribute('value') || '';
      return String(value);
    }

    function focusOption(option) {
      if (!option) return;
      try {
        option.focus({preventScroll: true});
      } catch (_) {
        try {
          option.focus();
        } catch (err) {}
      }
    }

    function getActiveIndex() {
      const currentId = window.location.hash.replace(/^#/, '');
      if (!currentId) return 0;
      for (let i = 0; i < navOptions.length; i += 1) {
        if (getTargetIdFromOption(navOptions[i]) === currentId) {
          return i;
        }
      }
      return 0;
    }

    function scrollOptionIntoView(option) {
      const label = getOptionLabel(option);
      const target = label || option;
      if (!target) return;
      try {
        target.scrollIntoView({behavior: 'smooth', block: 'nearest', inline: 'center'});
      } catch (_) {
        try {
          target.scrollIntoView();
        } catch (err) {}
      }
    }

    function activateOption(option, opts = {}) {
      if (!option) return;
      const targetId = getTargetIdFromOption(option);
      if (!targetId) return;
      const targetHash = '#' + targetId;
      syncActiveState({targetHash, reveal: true, focus: !!opts.focus});
      if (window.location.hash === targetHash) {
        try {
          window.location.hash = targetHash;
        } catch (_) {}
      } else {
        window.location.hash = targetHash;
      }
    }

    function openByOffset(direction) {
      const total = navOptions.length;
      if (!total) return;
      const currentIndex = getActiveIndex();
      const nextIndex = (currentIndex + direction + total) % total;
      const nextOption = navOptions[nextIndex];
      if (!nextOption) return;
      activateOption(nextOption, {focus: true});
    }

    function syncActiveState(options) {
      const targetHash =
        (options && options.targetHash) || window.location.hash || '';
      const normalized = String(targetHash)
        .split('#')
        .pop()
        .replace(/^#/, '');
      let activeIndex = -1;
      let activeOption = null;
      navOptions.forEach((option, index) => {
        const linkTarget = getTargetIdFromOption(option);
        const isActive = normalized && linkTarget === normalized;
        const label = getOptionLabel(option);
        const navItem = getOptionItem(option);
        if (isActive) {
          activeIndex = index;
          activeOption = option;
          option.checked = true;
          option.setAttribute('checked', 'checked');
          option.setAttribute('data-canopy-gallery-nav-active', '1');
          option.setAttribute('data-canopy-gallery-nav-selected', '1');
          option.tabIndex = 0;
          if (label) {
            label.setAttribute('data-canopy-gallery-nav-active', '1');
          }
          if (navItem) {
            navItem.setAttribute('data-canopy-gallery-nav-selected', '1');
          }
        } else {
          option.checked = false;
          option.removeAttribute('checked');
          option.removeAttribute('data-canopy-gallery-nav-active');
          option.removeAttribute('data-canopy-gallery-nav-selected');
          option.tabIndex = -1;
          if (label) {
            label.removeAttribute('data-canopy-gallery-nav-active');
          }
          if (navItem) {
            navItem.removeAttribute('data-canopy-gallery-nav-selected');
          }
        }
      });
      if (options && options.reveal && activeIndex >= 0) {
        scrollOptionIntoView(navOptions[activeIndex]);
      }
      if (options && options.focus && activeIndex >= 0) {
        focusOption(activeOption);
      }
    }

    if (prevBtn) {
      prevBtn.addEventListener('click', function (event) {
        event.preventDefault();
        openByOffset(-1);
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', function (event) {
        event.preventDefault();
        openByOffset(1);
      });
    }

    viewport.addEventListener('scroll', function () {
      raf(updateButtons);
    });
    window.addEventListener('resize', function () {
      raf(updateButtons);
    });

    nav.addEventListener('keydown', function (event) {
      const target = event.target || event.srcElement;
      const isOption =
        target && target.hasAttribute && target.hasAttribute('data-canopy-gallery-nav-option');
      if (!isOption) return;
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        event.preventDefault();
        openByOffset(1);
        return;
      }
      if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        event.preventDefault();
        openByOffset(-1);
        return;
      }
      if (event.key === 'Tab' && !event.shiftKey) {
        const actions = nav.closest('.canopy-gallery__modal-actions');
        const closeBtn = actions && actions.querySelector('.canopy-gallery__modal-close');
        if (closeBtn) {
          event.preventDefault();
          try {
            closeBtn.focus({preventScroll: true});
          } catch (_) {
            try {
              closeBtn.focus();
            } catch (err) {}
          }
        }
      }
    });

    nav.addEventListener('change', function (event) {
      const target = event.target || event.srcElement;
      if (!target || typeof target.matches !== 'function') return;
      if (!target.matches(NAV_OPTION_SELECTOR)) return;
      activateOption(target, {focus: true});
    });

    updateButtons();
    syncActiveState({reveal: true});
    nav.__canopyGalleryNavUpdate = updateButtons;
    nav.__canopyGalleryNavRefresh = function (options) {
      syncActiveState({
        reveal: options && options.reveal,
        focus: options && options.focus,
      });
    };
  }

  function bindGalleryNavs() {
    const navs = document.querySelectorAll('[data-canopy-gallery-nav]');
    if (!navs || !navs.length) return;
    Array.prototype.forEach.call(navs, initGalleryNav);
    refreshGalleryNavs({reveal: true});
  }

  function refreshGalleryNavs(options) {
    const opts = options || {};
    const navs = document.querySelectorAll('[data-canopy-gallery-nav-bound="1"]');
    if (!navs || !navs.length) return;
    Array.prototype.forEach.call(navs, function (nav) {
      if (typeof nav.__canopyGalleryNavUpdate === 'function') {
        raf(nav.__canopyGalleryNavUpdate);
      }
      if (typeof nav.__canopyGalleryNavRefresh === 'function') {
        raf(function () {
          nav.__canopyGalleryNavRefresh({
            reveal: !!opts.reveal,
            focus: !!opts.focus,
          });
        });
      }
    });
  }

  window.addEventListener('hashchange', function () {
    syncFromHash();
    refreshGalleryNavs({reveal: true});
  });
  window.addEventListener('pageshow', function () {
    syncFromHash();
    bindGalleryNavs();
    bindModalDismissals();
    refreshGalleryNavs({reveal: true});
  });
  syncFromHash();
  bindGalleryNavs();
  bindModalDismissals();
  refreshGalleryNavs({reveal: true});
})()`;

let galleryInstanceCounter = 0;

function nextGalleryInstanceId() {
  galleryInstanceCounter += 1;
  return `canopy-gallery-${galleryInstanceCounter}`;
}

function slugify(value, fallback) {
  if (!value) return fallback;
  const normalized = String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .trim();
  if (!normalized) return fallback;
  return normalized;
}

function ensureArray(value) {
  if (!value && value !== 0) return [];
  return Array.isArray(value) ? value : [value];
}

function normalizeOrder(value) {
  const normalized = String(value || "default").toLowerCase();
  return normalized === "random" ? "random" : "default";
}

function shuffleItems(list) {
  const copy = list.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = copy[i];
    copy[i] = copy[j];
    copy[j] = temp;
  }
  return copy;
}

function renderMetaList(meta, className) {
  const entries = ensureArray(meta).filter((entry) => entry || entry === 0);
  if (!entries.length) return null;
  return (
    <ul className={className} role="list">
      {entries.map((entry, index) => (
        <li key={`meta-${index}`}>{entry}</li>
      ))}
    </ul>
  );
}

function renderPreview(props = {}) {
  const source =
    (typeof props.media === "string" && props.media) ||
    props.thumbnail ||
    props.src ||
    (props.image && props.image.src) ||
    props.image;
  if (source) {
    const alt =
      props.thumbnailAlt || props.imageAlt || props.alt || props.title || "";
    const width = props.thumbnailWidth || props.imageWidth || props.width;
    const height = props.thumbnailHeight || props.imageHeight || props.height;
    return (
      <img
        src={source}
        alt={alt}
        width={width}
        height={height}
        loading="lazy"
      />
    );
  }
  return <div className="canopy-gallery__placeholder" aria-hidden="true" />;
}

function renderFlexibleContent(content, options = {}) {
  const {
    inlineTag: InlineTag = "span",
    blockTag: BlockTag = "div",
    className,
    id,
  } = options;
  if (content == null || content === false) return null;
  const isPrimitive =
    typeof content === "string" ||
    typeof content === "number" ||
    typeof content === "bigint";
  if (isPrimitive) {
    return (
      <InlineTag className={className} id={id}>
        {content}
      </InlineTag>
    );
  }
  if (React.isValidElement(content)) {
    if (content.type === React.Fragment) {
      return (
        <BlockTag className={className} id={id}>
          {content}
        </BlockTag>
      );
    }
    const mergedClassName = [content.props?.className, className]
      .filter(Boolean)
      .join(" ");
    return React.cloneElement(content, {
      ...content.props,
      className: mergedClassName || undefined,
      id: content.props?.id || id,
    });
  }
  const FallbackTag = BlockTag;
  return (
    <FallbackTag className={className} id={id}>
      {content}
    </FallbackTag>
  );
}

function normalizeItem(child, index, galleryId, manifestMap) {
  if (!React.isValidElement(child)) return null;
  if (child.type !== GalleryItem && child.type?.displayName !== "GalleryItem")
    return null;
  const props = child.props || {};
  const manifestValues = props.referencedManifests
    ? ensureArray(props.referencedManifests)
    : props.manifest
      ? [props.manifest]
      : props.manifests
        ? ensureArray(props.manifests)
        : [];
  const manifests = resolveReferencedManifests(manifestValues, manifestMap);
  const normalizedProps = {...props};
  if (!normalizedProps.title) {
    const manifestWithTitle = manifests.find(
      (manifest) => manifest && manifest.title,
    );
    if (manifestWithTitle && manifestWithTitle.title) {
      normalizedProps.title = manifestWithTitle.title;
    }
  }
  if (!normalizedProps.summary || !normalizedProps.description) {
    const manifestWithSummary = manifests.find(
      (manifest) => manifest && manifest.summary,
    );
    if (manifestWithSummary && manifestWithSummary.summary) {
      if (!normalizedProps.summary) {
        normalizedProps.summary = manifestWithSummary.summary;
      }
      if (!normalizedProps.description) {
        normalizedProps.description = manifestWithSummary.summary;
      }
    }
  }
  if (
    !normalizedProps.thumbnail &&
    !normalizedProps.media &&
    !normalizedProps.image
  ) {
    const manifestWithThumb = manifests.find(
      (manifest) => manifest && manifest.thumbnail,
    );
    if (manifestWithThumb && manifestWithThumb.thumbnail) {
      normalizedProps.thumbnail = manifestWithThumb.thumbnail;
      if (
        manifestWithThumb.thumbnailWidth != null &&
        normalizedProps.thumbnailWidth == null &&
        normalizedProps.imageWidth == null &&
        normalizedProps.width == null
      ) {
        normalizedProps.thumbnailWidth = manifestWithThumb.thumbnailWidth;
      }
      if (
        manifestWithThumb.thumbnailHeight != null &&
        normalizedProps.thumbnailHeight == null &&
        normalizedProps.imageHeight == null &&
        normalizedProps.height == null
      ) {
        normalizedProps.thumbnailHeight = manifestWithThumb.thumbnailHeight;
      }
    }
  }
  const rawSlug =
    normalizedProps.slug ||
    normalizedProps.id ||
    normalizedProps.title ||
    `item-${index + 1}`;
  const slug = slugify(rawSlug, `item-${index + 1}`);
  const modalId = `${galleryId}-modal-${slug}-${index + 1}`;
  const triggerLabel =
    normalizedProps.triggerLabel ||
    normalizedProps.buttonLabel ||
    normalizedProps.linkLabel ||
    `Open popup for ${normalizedProps.title || `item ${index + 1}`}`;
  const modalTitleId = `${modalId}-title`;
  const needsDescriptionId =
    normalizedProps.popupDescription ||
    normalizedProps.modalDescription ||
    normalizedProps.description ||
    normalizedProps.summary;
  const modalDescriptionId = needsDescriptionId
    ? `${modalId}-description`
    : null;
  const manifestLinks = manifests
    .map((manifest) => {
      if (!manifest) return null;
      const href = manifest.href || manifest.id || manifest.slug;
      if (!href) return null;
      return {
        id: manifest.id || manifest.slug || href,
        href,
        title: manifest.title || manifest.label || href,
      };
    })
    .filter(Boolean);

  return {
    index,
    key: child.key != null ? child.key : `${galleryId}-item-${index}`,
    props: normalizedProps,
    modalId,
    slug,
    modalTitleId,
    modalDescriptionId,
    triggerLabel,
    manifests: manifestLinks,
  };
}

function buildCaptionContent(itemProps) {
  if (itemProps.caption) return itemProps.caption;
  const kicker = itemProps.kicker || itemProps.label || itemProps.eyebrow;
  const summary = itemProps.summary || itemProps.description;
  return (
    <>
      {kicker ? <span className="canopy-gallery__kicker">{kicker}</span> : null}
      {itemProps.title ? (
        <span className="canopy-gallery__title-text">{itemProps.title}</span>
      ) : null}
      {renderFlexibleContent(summary, {
        inlineTag: "span",
        blockTag: "div",
        className: "canopy-gallery__summary",
      })}
      {renderMetaList(
        itemProps.meta,
        "canopy-gallery__meta canopy-gallery__meta--caption",
      )}
    </>
  );
}

function GalleryModal({item, closeTargetId, navItems, navGroupName}) {
  const {getString, formatString} = useLocale();
  const {
    props,
    modalId,
    modalTitleId,
    modalDescriptionId,
    triggerLabel,
    index,
    manifests,
  } = item;
  const kicker = props.kicker || props.label || props.eyebrow;
  const summary =
    props.popupDescription ||
    props.modalDescription ||
    props.description ||
    props.summary ||
    null;
  const modalTitle =
    props.popupTitle || props.modalTitle || props.title || `Item ${index + 1}`;
  const closeButtonText = getString("common.actions.close", "Close");
  const closeButtonLabel = formatString(
    "common.phrases.close_content",
    "Close {content}",
    {content: modalTitle},
  );
  return (
    <div
      id={modalId}
      className="canopy-gallery__modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby={modalTitleId}
      aria-describedby={modalDescriptionId || undefined}
      tabIndex={-1}
      data-canopy-gallery-modal="true"
      data-canopy-gallery-close={closeTargetId}
    >
      <div className="canopy-gallery__modal-scrim">
        <div className="canopy-gallery__modal-actions">
          <GalleryThumbnailNav
            items={navItems}
            activeModalId={modalId}
            groupName={`${navGroupName || "canopy-gallery"}-${modalId}`}
          />
          <Button
            className="canopy-gallery__modal-close"
            href={`#${closeTargetId}`}
            label={closeButtonText}
            aria-label={closeButtonLabel}
            variant="secondary"
          />
        </div>
        <div className="canopy-gallery__modal-panel">
          <button
            type="button"
            className="canopy-gallery__nav-button canopy-gallery__nav-button--prev"
            aria-label="Scroll left through gallery thumbnails"
            data-canopy-gallery-nav-prev="true"
          >
            <span
              className="canopy-gallery__nav-button-icon"
              aria-hidden="true"
              role="presentation"
            >
              {"<"}
            </span>
            <span className="canopy-gallery__visually-hidden">
              Previous item
            </span>
          </button>
          <button
            type="button"
            className="canopy-gallery__nav-button canopy-gallery__nav-button--next"
            aria-label="Scroll right through gallery thumbnails"
            data-canopy-gallery-nav-next="true"
          >
            <span
              className="canopy-gallery__nav-button-icon"
              aria-hidden="true"
              role="presentation"
            >
              {">"}
            </span>
            <span className="canopy-gallery__visually-hidden">Next item</span>
          </button>
          <header className="canopy-gallery__modal-header">
            <div className="canopy-gallery__modal-text">
              {kicker ? (
                <p className="canopy-gallery__modal-kicker">{kicker}</p>
              ) : null}
              <h3 id={modalTitleId} className="canopy-gallery__modal-title">
                {modalTitle}
              </h3>
              {renderFlexibleContent(summary, {
                inlineTag: "p",
                blockTag: "div",
                className: "canopy-gallery__modal-summary",
                id: modalDescriptionId || undefined,
              })}
              {renderMetaList(
                props.meta,
                "canopy-gallery__meta canopy-gallery__meta--modal",
              )}
              {manifests && manifests.length
                ? manifests.map((manifest) => (
                    <a key={manifest.id || manifest.href} href={manifest.href}>
                      {manifest.title || manifest.href}
                    </a>
                  ))
                : null}
            </div>
          </header>
          <div className="canopy-gallery__modal-body">{props.children}</div>
        </div>
      </div>
    </div>
  );
}

function GalleryFigure({item}) {
  const {props, modalId, triggerLabel} = item;
  return (
    <figure
      className="canopy-gallery__item"
      data-gallery-item-index={item.index}
    >
      <div className="canopy-gallery__media">{renderPreview(props)}</div>
      <figcaption className="canopy-gallery__caption">
        {buildCaptionContent(props)}
      </figcaption>
      <a
        className="canopy-gallery__trigger"
        href={`#${modalId}`}
        aria-haspopup="dialog"
        aria-controls={modalId}
        aria-label={triggerLabel}
        data-canopy-gallery-trigger={modalId}
      >
        <span className="canopy-gallery__trigger-label">{triggerLabel}</span>
      </a>
    </figure>
  );
}

function GalleryThumbnailNav({items, activeModalId, groupName}) {
  if (!items || items.length < 2) return null;
  const radioGroup = groupName || "canopy-gallery-nav";
  return (
    <nav
      className="canopy-gallery__nav"
      aria-label="Gallery navigation"
      data-canopy-gallery-nav="true"
    >
      <div
        className="canopy-gallery__nav-viewport"
        data-canopy-gallery-nav-viewport="true"
      >
        <ul
          className="canopy-gallery__nav-list"
          role="list"
          data-canopy-gallery-nav-track="true"
        >
          {items.map((item, index) => {
            const optionId = `${radioGroup}-${item.modalId || index}`;
            const isActive = item.modalId === activeModalId;
            return (
              <li
                key={`${item.key}-nav`}
                className="canopy-gallery__nav-item"
                data-canopy-gallery-nav-item="true"
                data-canopy-gallery-nav-selected={isActive ? "1" : undefined}
              >
                <input
                  type="radio"
                  className="canopy-gallery__nav-radio"
                  id={optionId}
                  name={radioGroup}
                  value={item.modalId}
                  checked={isActive ? true : undefined}
                  readOnly
                  data-canopy-gallery-nav-option="true"
                  data-canopy-gallery-nav-modal={item.modalId}
                  tabIndex={isActive ? 0 : -1}
                  data-canopy-gallery-nav-selected={isActive ? "1" : undefined}
                />
                <label
                  className="canopy-gallery__nav-link"
                  htmlFor={optionId}
                  data-canopy-gallery-nav-active={isActive ? "1" : undefined}
                >
                  <span className="canopy-gallery__nav-thumb">
                    {renderPreview(item.props)}
                  </span>
                  <span className="canopy-gallery__nav-label">
                    {item.props.title || `Item ${item.index + 1}`}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}

export function GalleryContent({children, flex = false}) {
  const contentClassName = [
    "canopy-gallery-item__content",
    flex ? "canopy-gallery-item__content_flex" : null,
  ]
    .filter(Boolean)
    .join(" ");

  return <div className={contentClassName}>{children}</div>;
}

export function GalleryItem() {
  return null;
}

GalleryItem.displayName = "GalleryItem";

function normalizePopupSize(value) {
  const normalized = String(value || "full").toLowerCase();
  return normalized === "window" ? "window" : "full";
}

export default function Gallery({
  children,
  id,
  title,
  description,
  popupSize = "full",
  order = "default",
  className = "",
  style = {},
}) {
  const manifestMap = useReferencedManifestMap();
  const galleryId = id ? String(id) : nextGalleryInstanceId();
  const HeadingTag = "h3";
  const closeTargetId = `${galleryId}-close`;
  const childArray = React.Children.toArray(children);
  const items = childArray
    .map((child, index) => normalizeItem(child, index, galleryId, manifestMap))
    .filter(Boolean);

  if (!items.length) return null;

  const popupMode = normalizePopupSize(popupSize);
  const orderMode = normalizeOrder(order);
  const orderedItems = orderMode === "random" ? shuffleItems(items) : items;
  const rootClassName = [
    "canopy-gallery",
    popupMode === "window"
      ? "canopy-gallery--popup-window"
      : "canopy-gallery--popup-full",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const navGroupName = `${galleryId}-nav`;

  return (
    <section className={rootClassName} style={style} data-canopy-gallery="true">
      <div
        id={closeTargetId}
        className="canopy-gallery__close-anchor"
        aria-hidden="true"
        tabIndex={-1}
      />
      {(title || description) && (
        <div className="canopy-gallery__header">
          {title ? (
            <HeadingTag className="canopy-gallery__heading">{title}</HeadingTag>
          ) : null}
          {description ? (
            <p className="canopy-gallery__description">{description}</p>
          ) : null}
        </div>
      )}
      <div className="canopy-gallery__grid">
        {orderedItems.map((item) => (
          <GalleryFigure key={item.key} item={item} />
        ))}
      </div>
      <div className="canopy-gallery__modals">
        {orderedItems.map((item) => (
          <GalleryModal
            key={`${item.modalId}-modal`}
            item={item}
            closeTargetId={closeTargetId}
            navItems={orderedItems}
            navGroupName={navGroupName}
          />
        ))}
      </div>
      <script
        data-canopy-gallery-script="true"
        dangerouslySetInnerHTML={{__html: INLINE_SCRIPT}}
      />
    </section>
  );
}

Gallery.Item = GalleryItem;
Gallery.Content = GalleryContent;
