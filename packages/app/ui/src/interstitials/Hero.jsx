import React from "react";
import helpers from "../../../lib/components/featured.js";
import navigationHelpers from "../../../lib/components/navigation.js";
import {computeHeroHeightStyle} from "./hero-utils.js";
import Button from "../layout/Button.jsx";
import ButtonWrapper from "../layout/ButtonWrapper.jsx";
import {useLocale} from "../locale/index.js";

const NavIconBase = ({children, ...rest}) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    focusable="false"
    {...rest}
  >
    {children}
  </svg>
);

const PrevArrowIcon = (props) => (
  <NavIconBase {...props}>
    <path
      d="M10.5 3L5.5 8L10.5 13"
      stroke="currentColor"
      strokeWidth="1.618"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </NavIconBase>
);

const NextArrowIcon = (props) => (
  <NavIconBase {...props}>
    <path
      d="M5.5 3L10.5 8L5.5 13"
      stroke="currentColor"
      strokeWidth="1.618"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </NavIconBase>
);

const HERO_DEFAULT_SIZES_ATTR = "(min-width: 1024px) 1280px, 100vw";

const basePath = (() => {
  try {
    const raw =
      typeof process !== "undefined" && process && process.env
        ? String(process.env.CANOPY_BASE_PATH || "")
        : "";
    return raw.replace(/\/$/, "");
  } catch (_) {
    return "";
  }
})();

function applyBasePath(href) {
  try {
    if (!href) return href;
    if (!basePath) return href;
    if (typeof href === "string" && href.startsWith("/")) {
      return `${basePath}${href}`;
    }
  } catch (_) {}
  return href;
}

function resolveFeaturedItem({item, index, random}) {
  if (item) return item;
  const list =
    helpers && helpers.readFeaturedFromCacheSync
      ? helpers.readFeaturedFromCacheSync()
      : [];
  if (!list.length) return null;
  if (typeof index === "number") {
    const idx = Math.max(0, Math.min(list.length - 1, Math.floor(index)));
    return list[idx];
  }
  if (random === true || random === "true") {
    const idx = Math.floor(Math.random() * Math.max(1, list.length));
    return list[idx];
  }
  return list[0];
}

function normalizeLinks(links) {
  if (!Array.isArray(links)) return [];
  return links
    .map((link) => {
      if (!link) return null;
      const href = applyBasePath(link.href || "");
      const title = link.title ? String(link.title) : "";
      if (!href || !title) return null;
      const type = link.type === "secondary" ? "secondary" : "primary";
      const target = link.target ? String(link.target) : undefined;
      return {href, title, type, target};
    })
    .filter(Boolean);
}

function sanitizeRest(rest) {
  const clone = {...rest};
  try {
    delete clone.random;
    delete clone.index;
    delete clone.item;
    delete clone.links;
    delete clone.overlay;
    delete clone.variant;
    delete clone.background;
  } catch (_) {}
  return clone;
}

function normalizeBackground(value) {
  try {
    const allowed = new Set(["theme", "transparent"]);
    const raw = value == null ? "" : String(value);
    const normalized = raw.trim().toLowerCase();
    return allowed.has(normalized) ? normalized : "theme";
  } catch (_) {
    return "theme";
  }
}

function findNodePathBySlug(node, targetSlug) {
  if (!node || !targetSlug) return null;
  const normalizedTarget = String(targetSlug || "");
  if (!normalizedTarget) return null;
  if (node.slug === normalizedTarget) return [node];
  const children = Array.isArray(node.children) ? node.children : [];
  for (const child of children) {
    const path = findNodePathBySlug(child, normalizedTarget);
    if (path && path.length) {
      return [node, ...path];
    }
  }
  return null;
}

function normalizeVariant(value) {
  try {
    const raw = value == null ? "" : String(value);
    const normalized = raw.trim().toLowerCase();
    if (normalized === "breadcrumb" || normalized === "text") return "breadcrumb";
    return "featured";
  } catch (_) {
    return "featured";
  }
}

export default function Hero({
  height = 520,
  item,
  index,
  random = true,
  headline,
  description,
  links = [],
  className = "",
  style = {},
  background = "theme",
  variant = "featured",
  homeLabel,
  ...rest
}) {
  const {getString} = useLocale();
  const normalizedVariant = normalizeVariant(variant);
  const isBreadcrumbVariant = normalizedVariant === "breadcrumb";
  const PageContext =
    navigationHelpers && typeof navigationHelpers.getPageContext === "function"
      ? navigationHelpers.getPageContext()
      : null;
  const pageContext = PageContext ? React.useContext(PageContext) : null;

  let orderedSlides = [];
  if (!isBreadcrumbVariant) {
    const resolved = resolveFeaturedItem({item, index, random});
    const helpersList =
      helpers && helpers.readFeaturedFromCacheSync
        ? helpers.readFeaturedFromCacheSync()
        : [];

    const slides = [];
    const pushUnique = (entry) => {
      if (!entry) return;
      const key = String(entry.href || entry.id || entry.title || "");
      const hasKey = slides.some(
        (item) =>
          String(item && (item.href || item.id || item.title || "")) === key
      );
      if (!hasKey) {
        slides.push(entry);
      }
    };

    if (resolved) pushUnique(resolved);
    helpersList.forEach(pushUnique);
    if (!slides.length) return null;

    orderedSlides = slides.slice();
    if (typeof index === "number" && orderedSlides.length > 1) {
      const clamp = Math.max(
        0,
        Math.min(orderedSlides.length - 1, Math.floor(index))
      );
      if (clamp > 0) {
        orderedSlides = orderedSlides
          .slice(clamp)
          .concat(orderedSlides.slice(0, clamp));
      }
    } else if (random === true || random === "true") {
      const rand = Math.floor(Math.random() * orderedSlides.length);
      if (rand > 0) {
        orderedSlides = orderedSlides
          .slice(rand)
          .concat(orderedSlides.slice(0, rand));
      }
    }
  }

  const heroHeight = computeHeroHeightStyle(height);
  const heroStyles = {...(style || {})};
  if (heroHeight && heroHeight.height && !isBreadcrumbVariant) {
    heroStyles["--hero-height"] = heroHeight.height;
  }
  if (isBreadcrumbVariant) {
    heroStyles["--hero-height"] = "auto";
  }

  const derivedDescription = description ? String(description) : "";
  const normalizedLinks = normalizeLinks(links);

  const primarySlide = !isBreadcrumbVariant ? orderedSlides[0] || null : null;
  const overlayTitle = headline || (primarySlide && primarySlide.title) || "";
  const defaultLinkHref = applyBasePath(
    primarySlide && primarySlide.href ? primarySlide.href : "#"
  );
  const overlayLinks = normalizedLinks.length
    ? normalizedLinks
    : [
        {
          href: defaultLinkHref,
          title: "View work",
          type: "primary",
        },
      ].filter(Boolean);
  const finalOverlayLinks = isBreadcrumbVariant ? normalizedLinks : overlayLinks;

  const breadcrumbItems = React.useMemo(() => {
    if (!isBreadcrumbVariant) return [];
    const items = [];
    const label = (homeLabel != null
      ? homeLabel
      : getString("common.nouns.home", "Home"))
      .trim();
    if (label) {
      items.push({title: label, href: applyBasePath("/")});
    }
    const navigation = pageContext && pageContext.navigation ? pageContext.navigation : null;
    const page = pageContext && pageContext.page ? pageContext.page : null;
    const slug =
      (page && page.slug) ||
      (navigation && navigation.currentSlug) ||
      "";
    const rootNode = navigation && navigation.root ? navigation.root : null;
    if (!slug || !rootNode) return items;
    const path = findNodePathBySlug(rootNode, slug);
    if (!path || !path.length) return items;
    path.forEach((node) => {
      if (!node) return;
      const title = node.title || node.slug || "";
      if (!title) return;
      const href = node.href ? applyBasePath(node.href) : null;
      items.push({title, href});
    });
    return items;
  }, [isBreadcrumbVariant, pageContext, homeLabel]);

  const breadcrumbNode = isBreadcrumbVariant && breadcrumbItems.length
    ? (
        <nav
          className="canopy-interstitial__breadcrumb"
          aria-label={getString("common.nouns.breadcrumb", "Breadcrumb")}
        >
          {breadcrumbItems.map((item, idx) => {
            const isLast = idx === breadcrumbItems.length - 1;
            const key = `${item.title || idx}-${idx}`;
            const content = !isLast && item.href ? (
              <a href={item.href}>{item.title}</a>
            ) : (
              <span className="canopy-interstitial__breadcrumb-current" aria-current="page">
                {item.title}
              </span>
            );
            return (
              <React.Fragment key={key}>
                {idx > 0 ? (
                  <span
                    className="canopy-interstitial__breadcrumb-separator"
                    aria-hidden="true"
                  >
                    &gt;
                  </span>
                ) : null}
                {content}
              </React.Fragment>
            );
          })}
        </nav>
      )
    : null;

  const normalizedBackground = normalizeBackground(background);
  const backgroundClassName =
    normalizedBackground === "transparent"
      ? "canopy-interstitial--bg-transparent"
      : "";

  const variantClassName = isBreadcrumbVariant
    ? "canopy-interstitial--hero-breadcrumb"
    : "canopy-interstitial--hero-featured";
  const containerClassName = [
    "canopy-interstitial",
    "canopy-interstitial--hero",
    variantClassName,
    backgroundClassName,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const renderSlide = (
    slide,
    idx,
    {showVeil = true, captionVariant = "overlay"} = {}
  ) => {
    const safeHref = applyBasePath(slide.href || "#");
    const isStaticCaption = captionVariant === "static";
    const paneClassName = [
      "canopy-interstitial__pane",
      showVeil ? "" : "canopy-interstitial__pane--flat",
      isStaticCaption ? "canopy-interstitial__pane--static" : "",
    ]
      .filter(Boolean)
      .join(" ");

    const buildImageProps = (className) => {
      if (!slide.thumbnail) return null;
      const props = {
        src: slide.thumbnail,
        alt: "",
        "aria-hidden": true,
        className,
        loading: idx === 0 ? "eager" : "lazy",
      };
      if (slide.srcset) props.srcSet = slide.srcset;
      if (slide.srcset) props.sizes = slide.sizes || HERO_DEFAULT_SIZES_ATTR;
      return props;
    };

    const wrapWithLink = (node) => {
      if (!safeHref) return node;
      return (
        <a
          href={safeHref}
          className="canopy-interstitial__slide-link"
          aria-label={slide.title || undefined}
        >
          {node}
        </a>
      );
    };

    if (isStaticCaption) {
      return (
        <div
          className="canopy-interstitial__slide"
          key={safeHref || idx}
          role="group"
          aria-roledescription="slide"
          aria-label={`${idx + 1} of ${orderedSlides.length}`}
        >
          {wrapWithLink(
            <article className={paneClassName}>
              {slide.thumbnail ? (
                <div className="canopy-interstitial__media-frame">
                  <img
                    {...buildImageProps(
                      "canopy-interstitial__media canopy-interstitial__media--static"
                    )}
                  />
                </div>
              ) : null}
              {slide.title ? (
                <div className="canopy-interstitial__caption canopy-interstitial__caption--static">
                  <span className="canopy-interstitial__caption-link">
                    {slide.title}
                  </span>
                </div>
              ) : null}
            </article>
          )}
        </div>
      );
    }

    return (
      <div
        className="canopy-interstitial__slide"
        key={safeHref || idx}
        role="group"
        aria-roledescription="slide"
        aria-label={`${idx + 1} of ${orderedSlides.length}`}
      >
        {wrapWithLink(
          <article className={paneClassName}>
            {slide.thumbnail ? (
              <img {...buildImageProps("canopy-interstitial__media")} />
            ) : null}
            {showVeil ? (
              <div className="canopy-interstitial__veil" aria-hidden="true" />
            ) : null}
            {slide.title ? (
              <div className="canopy-interstitial__caption">
                <span className="canopy-interstitial__caption-link">
                  {slide.title}
                </span>
              </div>
            ) : null}
          </article>
        )}
      </div>
    );
  };

  const renderSlider = (options = {}) => (
    <div
      className="canopy-interstitial__slider"
      role="region"
      aria-roledescription="carousel"
      aria-label={overlayTitle || "Featured content"}
    >
      <div className="canopy-interstitial__slide-wrapper">
        {orderedSlides.map((slide, idx) => renderSlide(slide, idx, options))}
      </div>
      <div className="canopy-interstitial__nav">
        <button
          type="button"
          aria-label="Previous slide"
          className="canopy-interstitial__nav-btn canopy-interstitial__nav-btn--prev"
        >
          <PrevArrowIcon />
        </button>
        <button
          type="button"
          aria-label="Next slide"
          className="canopy-interstitial__nav-btn canopy-interstitial__nav-btn--next"
        >
          <NextArrowIcon />
        </button>
      </div>
    </div>
  );

  const overlayContent = (
    <>
      {overlayTitle ? (
        <h1 className="canopy-interstitial__headline">{overlayTitle}</h1>
      ) : null}
      {derivedDescription ? (
        <p className="canopy-interstitial__description">{derivedDescription}</p>
      ) : null}
      {finalOverlayLinks.length ? (
        <ButtonWrapper className="canopy-interstitial__actions">
          {finalOverlayLinks.map((link) => (
            <Button
              key={`${link.href}-${link.title}`}
              href={link.href}
              label={link.title}
              variant={link.type}
              target={link.target}
            />
          ))}
        </ButtonWrapper>
      ) : null}
    </>
  );

  const cleanedProps = sanitizeRest(rest);
  const sectionProps = {
    className: containerClassName,
    style: heroStyles,
    ...cleanedProps,
  };
  if (!isBreadcrumbVariant) {
    sectionProps["data-canopy-hero-slider"] = "1";
  } else {
    sectionProps["data-canopy-hero-variant"] = "breadcrumb";
  }

  return (
    <section {...sectionProps}>
      {isBreadcrumbVariant ? (
        <div className="canopy-interstitial__layout canopy-interstitial__layout--breadcrumb">
          <div className="canopy-interstitial__panel">
            <div className="canopy-interstitial__body">
              {breadcrumbNode}
              {overlayContent}
            </div>
          </div>
        </div>
      ) : (
        <div className="canopy-interstitial__layout">
          <div className="canopy-interstitial__panel">
            <div className="canopy-interstitial__body">{overlayContent}</div>
          </div>
          <div className="canopy-interstitial__media-group">
            {renderSlider({showVeil: false, captionVariant: "static"})}
            <div className="canopy-interstitial__pagination" />
          </div>
        </div>
      )}
    </section>
  );
}
