// Pure palette logic shared by the build (theme.js) and the docs theme
// showcase, so previews use exactly the tokens a build generates. No fs or
// config access here: it is bundled into the SSR UI entry.
const radixColors = require("@radix-ui/colors");
const {contrast, ensureContrast, mix, normalizeHex} = require("./theme-color");

const DEFAULT_APPEARANCE = "light";

const LEVELS = [
  "50",
  "100",
  "200",
  "300",
  "400",
  "500",
  "600",
  "700",
  "800",
  "900",
];
const STEP_MAP = {
  50: 1,
  100: 2,
  200: 3,
  300: 4,
  400: 7,
  500: 8,
  600: 9,
  700: 10,
  800: 11,
  900: 12,
};

const AVAILABLE = new Set(
  Object.keys(radixColors).filter(
    (key) =>
      /^[a-z]+$/.test(key) && radixColors[key] && radixColors[key][`${key}1`],
  ),
);

// `auto` follows the visitor's system setting: the build emits light and dark tokens
// both (`appearanceVariablesToCss`). A scale itself is only ever light or dark.
const APPEARANCES = new Set(["light", "dark", "auto"]);

// Text and the controls drawn with it hold WCAG 2.2's 4.5:1 (1.4.3) in every palette
// and appearance (`tests/unit/a11y/contrast.test.js`). A step that falls short is moved
// toward black on light and white on dark only as far as the ratio needs.
const TEXT_CONTRAST = 4.5;
const FAR = {light: "#000000", dark: "#ffffff"};
// How far a filled accent control's fill moves on, away from its label, under the
// pointer or focus (`--color-accent-hover`).
const HOVER_SHARE = 0.2;

// Clover 4 (`@nulib/clover`) reads `--clover-color-*` tokens, as 3.16 did. Each one
// points at a Canopy token rather than a literal value so author overrides of
// `--color-accent-*` / `--color-gray-*` also reach Clover components.
// Radix dark scales invert, so the same steps hold for `appearance: dark`.
const CLOVER_ACCENT_TOKENS = {
  "--clover-color-accent": "--color-accent-default", // accent 800
  "--clover-color-accent-text": "--color-accent-default", // links, Read more
  "--clover-color-accent-alt": "--color-accent-900", // hover states
};
const CLOVER_GRAY_TOKENS = {
  "--clover-color-primary": "--color-gray-default", // gray 900, text
  "--clover-color-primary-alt": "--color-gray-900", // no darker step exists
  "--clover-color-primary-muted": "--color-gray-muted", // gray 800, placeholders
  "--clover-color-secondary": "--color-gray-50", // surfaces
  "--clover-color-secondary-alt": "--color-gray-400", // handles, popover arrows
  "--clover-color-secondary-muted": "--color-gray-300", // subtle borders
};

function normalizePaletteName(raw) {
  if (!raw) return "";
  const cleaned = String(raw).trim().toLowerCase();
  const compact = cleaned.replace(/[^a-z]/g, "");
  return AVAILABLE.has(compact) ? compact : "";
}

// `accentColor` names a palette or gives a color as hex (`#0f62fe`, `#06f`).
function normalizeAccentName(raw) {
  return normalizePaletteName(raw) || normalizeHex(raw);
}

function normalizeAppearance(raw) {
  if (!raw) return DEFAULT_APPEARANCE;
  const cleaned = String(raw).trim().toLowerCase();
  return APPEARANCES.has(cleaned) ? cleaned : DEFAULT_APPEARANCE;
}

// The appearance a scale is drawn in: `dark`, or `light` for anything else.
function scaleAppearance(raw) {
  return normalizeAppearance(raw) === "dark" ? "dark" : "light";
}

function resolveRadixPalette(name, appearance) {
  if (!name || !AVAILABLE.has(name)) return null;
  const paletteKey = appearance === "dark" ? `${name}Dark` : name;
  const palette = radixColors[paletteKey];
  if (palette && palette[`${name}1`]) return palette;
  const fallback = radixColors[name];
  return fallback && fallback[`${name}1`] ? fallback : null;
}

// A hex accent's steps, as Radix numbers them. Steps 1 to 8 mix the accent into the
// page's ground, step 9 is the accent, and 10 to 12 mix it toward black on light and
// white on dark, for hover and text. `[share of the accent, what it is mixed with]`.
const HEX_GROUND = {light: "#ffffff", dark: "#111113"};
const HEX_STEPS = {
  light: {
    1: [0.03, "ground"],
    2: [0.06, "ground"],
    3: [0.12, "ground"],
    4: [0.18, "ground"],
    7: [0.38, "ground"],
    8: [0.6, "ground"],
    9: [1, "ground"],
    10: [0.88, "far"],
    11: [0.82, "far"],
    12: [0.45, "far"],
  },
  dark: {
    1: [0.06, "ground"],
    2: [0.1, "ground"],
    3: [0.2, "ground"],
    4: [0.28, "ground"],
    7: [0.45, "ground"],
    8: [0.62, "ground"],
    9: [1, "ground"],
    10: [0.9, "far"],
    11: [0.62, "far"],
    12: [0.22, "far"],
  },
};

function hexScale(hex, appearance) {
  const mode = appearance === "dark" ? "dark" : "light";
  const scale = {};
  for (const lvl of LEVELS) {
    const [share, withWhat] = HEX_STEPS[mode][STEP_MAP[lvl]];
    const other = withWhat === "far" ? FAR[mode] : HEX_GROUND[mode];
    scale[lvl] = share === 1 ? hex : mix(other, hex, share);
  }
  return scale;
}

// Where text is drawn, as Radix steps of a gray (Tailwind levels: step 1 is 50, step 3 is
// 200, step 4 is 300): the page; `--canopy-surface`, a panel's solid fill (step 3); and
// `--canopy-surface-raised`, a card's (the page in light mode, step 4 in dark; a raised
// thing is lighter than the page in the dark, where a shadow does not read). Kept in step
// with `ui/styles/settings/_tokens.scss`.
const GROUND_STEPS = {
  light: {page: 1, surface: 3, raised: 1},
  dark: {page: 1, surface: 3, raised: 4},
};
const LEVEL_OF_STEP = {1: "50", 3: "200", 4: "300"};

// Every gray palette's steps, as hex: the grounds an accent's text may be drawn on,
// since `grayColor` may name any of them.
const groundCache = {};
function paletteGrounds(appearance, steps) {
  const mode = appearance === "dark" ? "dark" : "light";
  const unique = Array.from(new Set(steps));
  const key = `${mode}:${unique.join(",")}`;
  if (!groundCache[key]) {
    groundCache[key] = Array.from(AVAILABLE).flatMap((name) => {
      const palette = resolveRadixPalette(name, mode);
      if (!palette) return [];
      return unique.map((step) => normalizeHex(palette[`${name}${step}`])).filter(Boolean);
    });
  }
  return groundCache[key];
}

// The text step (level 800) a role draws with, held at 4.5:1. An accent's is drawn on
// any gray's page and raised cards, and is the fill under its own level 50 (a primary
// button's label); a gray's is muted text on its own page, panels and raised cards.
function withTextStep(scale, role, appearance) {
  const mode = appearance === "dark" ? "dark" : "light";
  const steps = GROUND_STEPS[mode];
  const grounds =
    role === "accent"
      ? [...paletteGrounds(mode, [steps.page, steps.raised]), scale["50"]]
      : Array.from(new Set([steps.page, steps.surface, steps.raised])).map(
          (step) => scale[LEVEL_OF_STEP[step]],
        );
  return {
    ...scale,
    800: ensureContrast(scale["800"], grounds, TEXT_CONTRAST, FAR[appearance]),
  };
}

// A palette's (or, as the accent, a hex color's) Tailwind levels 50 to 900. With
// `role` (`accent` or `gray`), level 800 is that role's text step, held at 4.5:1;
// without it, the levels are Radix's own.
function toTailwindScale(name, options = {}) {
  const appearance = scaleAppearance(options.appearance);
  let scale = null;
  const hex = !AVAILABLE.has(name) && options.role === "accent" ? normalizeHex(name) : "";
  if (hex) {
    scale = hexScale(hex, appearance);
  } else {
    if (!name || !AVAILABLE.has(name)) return null;
    const palette = resolveRadixPalette(name, appearance);
    if (!palette) return null;
    scale = {};
    for (const lvl of LEVELS) {
      const value = palette[`${name}${STEP_MAP[lvl]}`];
      if (!value) return null;
      scale[lvl] = value;
    }
  }
  if (options.role === "accent" || options.role === "gray") {
    return withTextStep(scale, options.role, appearance);
  }
  return scale;
}

// A filled accent control under the pointer or focus: its fill (level 800) moved on,
// away from its label (level 50), so the label's ratio only rises. A fill already at
// black (or white) has nowhere further to go, so it moves toward its label instead, as
// far as the label keeps 4.5:1.
const HOVER_VISIBLE = 1.15;
function accentHover(scale, appearance) {
  if (!scale || !scale["800"]) return "";
  const rest = scale["800"];
  const away = mix(rest, FAR[scaleAppearance(appearance)], HOVER_SHARE);
  if (contrast(away, rest) >= HOVER_VISIBLE || !scale["50"]) return away;
  const toward = mix(rest, scale["50"], HOVER_SHARE * 1.5);
  return contrast(toward, scale["50"]) >= TEXT_CONTRAST ? toward : away;
}

// `--color-accent-hover` as CSS: mixed from `--color-accent-default` itself, the same
// math as `accentHover`, so a site that sets its own accent (the Northwestern template)
// gets a hover of its own color. The one exception, a fill already at black or white,
// is the hex `accentHover` chose.
function accentHoverCss(scale, appearance) {
  const hover = accentHover(scale, appearance);
  if (!hover) return "";
  const far = FAR[scaleAppearance(appearance)];
  if (hover !== mix(scale["800"], far, HOVER_SHARE)) return hover;
  return `color-mix(in oklab, var(--color-accent-default) ${Math.round(
    (1 - HOVER_SHARE) * 100,
  )}%, ${far})`;
}

function buildVariablesMap(brandScale, grayScale, options = {}) {
  const appearance = scaleAppearance(options.appearance);
  const vars = {};
  if (brandScale) {
    for (const lvl of LEVELS) {
      const value = brandScale[lvl];
      if (value) vars[`--color-accent-${lvl}`] = value;
    }
    if (brandScale["800"]) {
      vars["--color-accent-default"] = brandScale["800"];
      vars["--color-accent-hover"] = accentHoverCss(brandScale, appearance);
    }
  }
  if (grayScale) {
    for (const lvl of LEVELS) {
      const value = grayScale[lvl];
      if (value) vars[`--color-gray-${lvl}`] = value;
    }
    if (grayScale["900"]) vars["--color-gray-default"] = grayScale["900"];
    if (grayScale["800"]) vars["--color-gray-muted"] = grayScale["800"];
  }
  if (brandScale) {
    for (const [prop, token] of Object.entries(CLOVER_ACCENT_TOKENS)) {
      vars[prop] = `var(${token})`;
    }
  }
  if (grayScale) {
    for (const [prop, token] of Object.entries(CLOVER_GRAY_TOKENS)) {
      vars[prop] = `var(${token})`;
    }
  }
  vars["color-scheme"] = appearance;
  return vars;
}

function declarations(vars, indent) {
  return Object.entries(vars || {})
    .map(([prop, value]) => `${indent}${prop}: ${value};`)
    .join("\n");
}

function variablesToCss(vars) {
  const entries = Object.entries(vars || {});
  if (!entries.length) return "";
  const body = declarations(vars, "  ");
  return `@layer properties {\n  :root {\n${body}\n  }\n  :host {\n${body}\n  }\n}`;
}

// `appearance: auto`: the light tokens, the dark ones where the visitor's system asks
// for dark (unless the page is set `light`), and the dark ones where it is set `dark`.
// The appearance switch (`lib/build/appearance.js`) sets `light` or `dark` on `<html>`.
function appearanceVariablesToCss(lightVars, darkVars) {
  const light = declarations(lightVars, "  ");
  const dark = declarations(darkVars, "  ");
  return [
    "@layer properties {",
    `  :root {\n${light}\n  }`,
    `  :host {\n${light}\n  }`,
    "  @media (prefers-color-scheme: dark) {",
    `    :root:not(.light) {\n${dark}\n    }`,
    `    :host {\n${dark}\n    }`,
    "  }",
    `  :root.dark {\n${dark}\n  }`,
    "}",
  ].join("\n");
}

// Representative swatch color for a palette: its light-mode step 9.
function swatchColor(name) {
  if (!name) return null;
  if (!AVAILABLE.has(name)) return normalizeHex(name) || null;
  return radixColors[name][`${name}9`] || null;
}

module.exports = {
  LEVELS,
  STEP_MAP,
  TEXT_CONTRAST,
  AVAILABLE_PALETTES: Array.from(AVAILABLE).sort(),
  accentHover,
  accentHoverCss,
  appearanceVariablesToCss,
  contrast,
  normalizePaletteName,
  normalizeAccentName,
  normalizeAppearance,
  scaleAppearance,
  toTailwindScale,
  buildVariablesMap,
  variablesToCss,
  swatchColor,
};
