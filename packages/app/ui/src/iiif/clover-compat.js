import React from "react";

// Canopy's MDX props, as 1.x authors write them for Clover 3, translated into Clover 4's
// (`@nulib/clover`). The MDX API is a contract (AGENTS.md): every option keeps working
// where Clover 4 can do what it did, and `unsupportedOptions` names, for a build notice,
// those it cannot. The runtimes and the UI wrappers draw Clover's parts through the
// factories below, each handed the module it loads on demand: nothing here imports
// Clover, so the UI bundle never carries it.

const UNIT_TOKEN = "__canopySliderUnit";

const isPlainObject = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

/** A length as CSS: a number is pixels, a slider `rem()` token is rem, a string as given. */
function cssLength(value) {
  if (value == null || value === "") return "";
  if (isPlainObject(value) && value[UNIT_TOKEN] === "rem") return `${value.value}rem`;
  if (typeof value === "number") return `${value}px`;
  return String(value);
}

/*
 * The Viewer's information panel: Clover 3's tabs, as Clover 4's sections. A section is
 * left out where its option is `false`, as the tab was; the map only where `map.enabled`
 * asks for it, as Clover 3 drew none by default.
 */
const PANEL_SECTIONS = [
  ["about", (panel) => panel.renderAbout !== false],
  ["targets", () => true],
  ["collection", () => true],
  ["contents", (panel) => panel.renderContents !== false],
  ["search", (panel) => panel.renderContentSearch !== false],
  ["map", (panel, opts) => isPlainObject(opts.map) && opts.map.enabled === true],
  ["transcript", (panel) => panel.renderSupplementing !== false],
  ["annotations", (panel) => panel.renderAnnotation !== false],
];

/**
 * OpenSeadragon's options that Clover 4's Canvas reads by the same name and meaning
 * (`openSeadragon` on the Viewer, `openSeadragonConfig` on Image). The rest are
 * OpenSeadragon's own, with nothing to draw them in Clover 4.
 */
const CANVAS_OPTIONS = [
  "maxZoomPixelRatio",
  "minZoomImageRatio",
  "animationTime",
  "springStiffness",
  "constrainDuringPan",
];

function canvasOptions(config) {
  if (!isPlainObject(config)) return undefined;
  const out = {};
  for (const key of CANVAS_OPTIONS) {
    if (config[key] !== undefined) out[key] = config[key];
  }
  // OpenSeadragon's wheel zoom, as Clover 4's gesture of the same name.
  const mouse = isPlainObject(config.gestureSettingsMouse) ? config.gestureSettingsMouse : null;
  if (mouse && typeof mouse.scrollToZoom === "boolean") {
    out.gestures = { scrollToZoom: mouse.scrollToZoom };
  }
  return Object.keys(out).length ? out : undefined;
}

/** What Clover's requests carry: credentials and headers, from Clover 3's options. */
function requestOf(opts) {
  const request = {};
  if (opts.withCredentials === true || opts.crossOrigin === "use-credentials") {
    request.credentials = "include";
  }
  if (isPlainObject(opts.requestHeaders)) request.headers = opts.requestHeaders;
  return Object.keys(request).length ? request : undefined;
}

/** The Viewer's props, from Canopy's `iiifContent`, `options`, `height` and `className`. */
export function toViewerProps(props = {}) {
  const { options, height, className, style, ...rest } = props || {};
  const opts = isPlainObject(options) ? options : {};
  const panel = isPlainObject(opts.informationPanel) ? opts.informationPanel : {};
  const out = { ...rest };
  /*
   * Clover 3 drew its collection browser whatever `showTitle` said, only the title hidden:
   * without the title, Clover 4's Collection line alone, and no header for a Manifest.
   */
  out.header = opts.showTitle === true ? true : "collection";
  out.download = opts.showDownload === true;
  /*
   * Clover 3 drew the panel open (`open`), shut behind its toggle (`renderToggle`), open
   * with no toggle, or not at all where both are off, as Canopy's defaults have it.
   */
  const open = panel.open === true;
  out.panel = open || panel.renderToggle !== false;
  out.defaultPanelOpen = open;
  if (out.panel && panel.renderToggle === false) out.panelToggle = false;
  const sections = PANEL_SECTIONS.filter(([, shown]) => shown(panel, opts)).map(
    ([name]) => name,
  );
  if (sections.length !== PANEL_SECTIONS.length) out.panelSections = sections;
  const labels = {};
  if (typeof panel.annotationTabLabel === "string" && panel.annotationTabLabel) {
    labels.annotations = panel.annotationTabLabel;
  }
  const searchText = isPlainObject(opts.localeText) && isPlainObject(opts.localeText.contentSearch)
    ? opts.localeText.contentSearch
    : {};
  if (typeof searchText.tabLabel === "string" && searchText.tabLabel) {
    labels.search = searchText.tabLabel;
  }
  if (Object.keys(labels).length) out.panelLabels = labels;
  const request = requestOf(opts);
  if (request) out.request = request;
  const canvas = canvasOptions(opts.openSeadragon);
  if (canvas) out.canvasOptions = canvas;
  const css = { ...(isPlainObject(style) ? style : {}) };
  const bodyHeight = cssLength(height || opts.canvasHeight);
  if (bodyHeight) css["--clover-body-height"] = bodyHeight;
  if (opts.canvasBackgroundColor) {
    css["--clover-canvas-background"] = opts.canvasBackgroundColor;
  }
  if (typeof opts.background === "string" && opts.background) {
    css.background = opts.background;
  }
  if (Object.keys(css).length) out.style = css;
  if (className) out.className = className;
  return out;
}

/** Where the Viewer's maps load MapLibre's worker from (`map.workerUrl`), if it says. */
export function mapWorkerUrlOf(props = {}) {
  const opts = isPlainObject(props && props.options) ? props.options : {};
  const url = isPlainObject(opts.map) ? opts.map.workerUrl : undefined;
  return typeof url === "string" && url ? url : undefined;
}

/** Slides per view, from 1, as Clover's `perView` counts them (2.5 shows two and a half). */
const perViewOf = (value) => (Number(value) >= 1 ? Number(value) : undefined);

/**
 * What the slider's breakpoints give at `width` (px, min-width keys, as 1.x's slider read
 * them), over its options' own: slides per view (1 below the first breakpoint, as 1.x's
 * default; a value under 1 is passed over) and the space between them.
 */
export function stepAt(opts = {}, width) {
  const step = {
    slidesPerView: perViewOf(opts.slidesPerView) ?? 1,
    spaceBetween: opts.spaceBetween,
  };
  if (!isPlainObject(opts.breakpoints) || !Number.isFinite(width)) return step;
  Object.keys(opts.breakpoints)
    .map(Number)
    .filter((min) => Number.isFinite(min) && width >= min)
    .sort((a, b) => a - b)
    .forEach((min) => {
      const at = opts.breakpoints[min] || {};
      if (perViewOf(at.slidesPerView)) step.slidesPerView = perViewOf(at.slidesPerView);
      if (at.spaceBetween != null) step.spaceBetween = at.spaceBetween;
    });
  return step;
}

/** Items' props, from the Slider's, at the window's `width`. */
export function toItemsProps(props = {}, width) {
  const { options, height, className, style, ...rest } = props || {};
  const opts = isPlainObject(options) ? options : {};
  const out = { layout: "slider", ...rest };
  const step = stepAt(opts, width);
  if (opts.breakpoints || opts.slidesPerView) out.perView = step.slidesPerView;
  const css = { ...(isPlainObject(style) ? style : {}) };
  const gap = cssLength(step.spaceBetween);
  if (gap) css["--clover-items-gap"] = gap;
  const picture = cssLength(height);
  if (picture) css["--clover-items-height"] = picture;
  if (Object.keys(css).length) out.style = css;
  if (className) out.className = className;
  return out;
}

/** The Canvas's props, from Image's: `alt` (or `label`) its name, its options OpenSeadragon's. */
export function toCanvasProps(props = {}) {
  const {
    alt,
    label,
    caption: _caption,
    height: _height,
    backgroundColor: _backgroundColor,
    className: _className,
    openSeadragonConfig,
    openSeadragonCallback: _callback,
    ...rest
  } = props || {};
  const out = { ...rest };
  const name = label || alt;
  if (name) out.label = name;
  const options = canvasOptions(openSeadragonConfig);
  if (options) out.options = options;
  return out;
}

/*
 * Options Clover 4 has nothing to do with, by the path an author writes them. Each is
 * still accepted, and the build names it once (`unsupportedOptions`).
 */
const VIEWER_UNSUPPORTED = [
  ["showIIIFBadge", (value) => value === true],
  ["showResourceIcons", (value) => value === true],
  ["showMediaSearch", (value) => value === false],
  ["ignoreCaptionLabels", (value) => Array.isArray(value) && value.length > 0],
  ["annotations.motivations", (value) => Array.isArray(value)],
  ["annotationOverlays", (value) => isPlainObject(value)],
  ["contentSearch", (value) => isPlainObject(value)],
  ["informationPanel.defaultTab", (value) => typeof value === "string"],
  ["informationPanel.renderCanvasSummary", (value) => value === true],
  ["informationPanel.renderAnnotationCollection", (value) => value === false],
  ["informationPanel.annotationCollectionTabLabel", (value) => typeof value === "string"],
  ["informationPanel.vtt", (value) => isPlainObject(value)],
  ["map.fitToData", (value) => value === false],
  ["map.navPlaceLevel", (value) => value !== undefined && value !== "auto"],
  ["map.showImageOverlay", (value) => value === true],
  ["map.imageOverlayOpacity", (value) => value !== undefined],
  ["map.showControlPoints", (value) => value === false],
  ["map.overlayScope", (value) => value !== undefined && value !== "manifest"],
  ["localeText.contentSearch.formPlaceholder", (value) => typeof value === "string"],
  ["localeText.contentSearch.noSearchResults", (value) => typeof value === "string"],
  ["localeText.contentSearch.loading", (value) => typeof value === "string"],
  ["localeText.contentSearch.moreResults", (value) => typeof value === "string"],
];

const at = (object, path) =>
  path.split(".").reduce((value, key) => (isPlainObject(value) ? value[key] : undefined), object);

/** OpenSeadragon's own options among `config`: those Clover 4's Canvas has no use for. */
function openSeadragonOnly(config) {
  if (!isPlainObject(config)) return [];
  return Object.keys(config).filter(
    (key) =>
      !CANVAS_OPTIONS.includes(key) &&
      !(key === "gestureSettingsMouse" && Object.keys(config[key] || {}).every((k) => k === "scrollToZoom")),
  );
}

/**
 * The options in `props` that Clover 4 cannot do as Clover 3 did, by the path an author
 * writes them (`informationPanel.defaultTab`), for the build to name. `component` is
 * `"Viewer"`, `"Image"` or `"Scroll"`.
 */
export function unsupportedOptions(component, props = {}) {
  if (component === "Scroll") {
    const opts = isPlainObject(props && props.options) ? props.options : {};
    return Object.keys(opts).map((key) => `options.${key}`);
  }
  if (component === "Image") {
    return openSeadragonOnly(props && props.openSeadragonConfig).map(
      (key) => `openSeadragonConfig.${key}`,
    );
  }
  const opts = isPlainObject(props && props.options) ? props.options : {};
  const found = VIEWER_UNSUPPORTED.filter(([path, used]) => used(at(opts, path))).map(
    ([path]) => `options.${path}`,
  );
  for (const key of openSeadragonOnly(opts.openSeadragon)) {
    found.push(`options.openSeadragon.${key}`);
  }
  return found;
}

const noticed = new Set();

/**
 * Names, once per build, each option a component was given that Clover 4 cannot honor.
 * Server-side only: in the browser the build has already said it.
 */
export function noticeUnsupported(component, props) {
  if (typeof window !== "undefined") return;
  for (const path of unsupportedOptions(component, props)) {
    const key = `${component} ${path}`;
    if (noticed.has(key)) continue;
    noticed.add(key);
    console.warn(
      component === "Scroll"
        ? `[canopy] <Scroll> ${path} has no effect for now: Scroll draws Clover's Document template until its text reader is built.`
        : `[canopy] <${component}> ${path} has no effect in Canopy 2: Clover 4 has nothing to do with it.`,
    );
  }
}

/** The window's width, followed as it changes: for the slider's breakpoints. */
function useWindowWidth() {
  const [width, setWidth] = React.useState(() =>
    typeof window !== "undefined" ? window.innerWidth : undefined,
  );
  React.useEffect(() => {
    const resize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);
  return width;
}

/**
 * The Viewer, in Clover's Default template, from `@nulib/clover/viewer` (`viewer`) and
 * `@nulib/clover/templates` (`templates`); `helpers` is `@nulib/clover/helpers`, for a
 * map's worker where `map.workerUrl` names one.
 */
export function cloverViewer(viewer, templates, helpers) {
  return function CanopyViewer(props) {
    const workerUrl = mapWorkerUrlOf(props);
    if (workerUrl && helpers && helpers.setMapWorkerUrl) helpers.setMapWorkerUrl(workerUrl);
    return React.createElement(viewer.Viewer, {
      template: templates.Default,
      ...toViewerProps(props),
    });
  };
}

/** The Slider, as Clover's Items, from `@nulib/clover/items`. */
export function cloverSlider(items) {
  return function CanopySlider(props) {
    const width = useWindowWidth();
    return React.createElement(items.Items, toItemsProps(props, width));
  };
}

/**
 * Scroll, for now as Clover's Document template (the pages down one column), from
 * `@nulib/clover/viewer` and `@nulib/clover/templates`. A text-focused reader composed
 * from Clover's parts is to replace it (`packages/app/AGENTS.md`); until then its
 * `options`, Clover 3's Scroll's, have no effect (`unsupportedOptions`).
 */
export function cloverScroll(viewer, templates) {
  return function CanopyScroll(props) {
    return React.createElement(viewer.Viewer, {
      template: templates.Document,
      iiifContent: props && props.iiifContent,
    });
  };
}

/** Image, as Clover's Canvas, from `@nulib/clover/canvas`. */
export function cloverImage(canvas) {
  return function CanopyImage(props) {
    return React.createElement(canvas.Canvas, toCanvasProps(props));
  };
}
