const fs = require("fs");
const yaml = require("js-yaml");
const radixColors = require("@radix-ui/colors");
const {resolveCanopyConfigPath} = require("../lib/config-path");

const DEFAULT_ACCENT = "indigo";
const DEFAULT_GRAY = "slate";
const DEFAULT_APPEARANCE = "light";
const DEBUG_FLAG_RAW = String(process.env.CANOPY_DEBUG_THEME || "");
const DEBUG_ENABLED = /^(1|true|yes|on)$/i.test(DEBUG_FLAG_RAW.trim());

function debugLog(...args) {
  if (!DEBUG_ENABLED) return;
  try {
    console.log("[canopy-theme]", ...args);
  } catch (_) {}
}

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

const APPEARANCES = new Set(["light", "dark"]);

// Current Clover (verified on 3.16) reads `--clover-color-*` tokens. Each one
// points at a Canopy token rather than a literal value so author overrides of
// `--color-accent-*` / `--color-gray-*` also reach Clover components.
// Radix dark scales invert, so the same steps hold for `appearance: dark`.
const CLOVER_ACCENT_TOKENS = {
  "--clover-color-accent": "--color-accent-default", // accent 800
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

function readYamlConfig(cfgPath) {
  try {
    if (!cfgPath) return {};
    if (!fs.existsSync(cfgPath)) {
      debugLog("config not found; falling back to defaults", cfgPath);
      return {};
    }
    const raw = fs.readFileSync(cfgPath, "utf8");
    const data = yaml.load(raw) || {};
    debugLog("loaded config", cfgPath);
    return data;
  } catch (_) {
    return {};
  }
}

function normalizePaletteName(raw) {
  if (!raw) return "";
  const cleaned = String(raw).trim().toLowerCase();
  const compact = cleaned.replace(/[^a-z]/g, "");
  return AVAILABLE.has(compact) ? compact : "";
}

function normalizeAppearance(raw) {
  if (!raw) return DEFAULT_APPEARANCE;
  const cleaned = String(raw).trim().toLowerCase();
  return APPEARANCES.has(cleaned) ? cleaned : DEFAULT_APPEARANCE;
}

function resolveRadixPalette(name, appearance) {
  if (!name || !AVAILABLE.has(name)) return null;
  const paletteKey = appearance === "dark" ? `${name}Dark` : name;
  const palette = radixColors[paletteKey];
  if (palette && palette[`${name}1`]) return palette;
  const fallback = radixColors[name];
  return fallback && fallback[`${name}1`] ? fallback : null;
}

function toTailwindScale(name, options = {}) {
  if (!name || !AVAILABLE.has(name)) return null;
  const appearance = normalizeAppearance(options.appearance);
  const palette = resolveRadixPalette(name, appearance);
  if (!palette) return null;
  const prefix = name;
  const scale = {};
  const steps = STEP_MAP;
  for (const lvl of LEVELS) {
    const radixStep = steps[lvl];
    const key = `${prefix}${radixStep}`;
    const value = palette[key];
    if (!value) return null;
    scale[lvl] = value;
  }
  return scale;
}

function buildVariablesMap(brandScale, grayScale, options = {}) {
  const appearance = normalizeAppearance(options.appearance);
  const vars = {};
  if (brandScale) {
    for (const lvl of LEVELS) {
      const value = brandScale[lvl];
      if (value) vars[`--color-accent-${lvl}`] = value;
    }
    if (brandScale["800"]) vars["--color-accent-default"] = brandScale["800"];
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
  // Older Stitches-based Clover (e.g. 3.3.8) reads `--colors-*` and declares
  // its own `:root` defaults, hence `!important`. Drop once sites no longer
  // pin those versions.
  if (brandScale && grayScale) {
    if (brandScale["800"]) {
      vars["--colors-accent"] = `${brandScale["800"]} !important`;
      vars["--colors-accentAlt"] = `${brandScale["800"]} !important`;
      vars["--colors-accentMuted"] = `${brandScale["800"]} !important`;
    }
    if (grayScale["900"]) {
      const primary = `${grayScale["900"]} !important`;
      vars["--colors-primary"] = primary;
      vars["--colors-primaryAlt"] = primary;
      vars["--colors-primaryMuted"] = primary;
    }
    if (grayScale["50"]) {
      const secondary = `${grayScale["50"]} !important`;
      vars["--colors-secondary"] = secondary;
      vars["--colors-secondaryAlt"] = secondary;
      vars["--colors-secondaryMuted"] = secondary;
    }
  }
  vars["color-scheme"] = appearance === "dark" ? "dark" : "light";
  return vars;
}

function variablesToCss(vars) {
  const entries = Object.entries(vars || {});
  if (!entries.length) return "";
  const body = entries
    .map(([prop, value]) => `  ${prop}: ${value};`)
    .join("\n");
  return `@layer properties {\n  :root {\n${body}\n  }\n  :host {\n${body}\n  }\n}`;
}

function buildSassConfig(brandScale, grayScale) {
  return "";
}

function loadCanopyTheme(options = {}) {
  const cfgPath = resolveCanopyConfigPath(options);
  const cfg = readYamlConfig(cfgPath);
  const theme = (cfg && cfg.theme) || {};
  const accentRequested = theme && theme.accentColor;
  const grayRequested = theme && theme.grayColor;
  const appearanceRequested = theme && theme.appearance;
  const appearance = normalizeAppearance(appearanceRequested);

  let accentName = normalizePaletteName(accentRequested);
  let accentScale = accentName
    ? toTailwindScale(accentName, {appearance})
    : null;
  let accentFallback = false;
  if (!accentScale) {
    accentFallback = true;
    accentName = DEFAULT_ACCENT;
    accentScale = toTailwindScale(DEFAULT_ACCENT, {appearance});
  }

  let grayName = normalizePaletteName(grayRequested);
  let grayScale = grayName
    ? toTailwindScale(grayName, {
        appearance,
      })
    : null;
  let grayFallback = false;
  if (!grayScale) {
    grayFallback = true;
    grayName = DEFAULT_GRAY;
    grayScale = toTailwindScale(DEFAULT_GRAY, {
      appearance,
    });
  }

  const dynamicVars = buildVariablesMap(accentScale, grayScale, {appearance});
  const mergedVars = dynamicVars;
  const css = variablesToCss(mergedVars);
  const sassConfig = buildSassConfig(accentScale, grayScale);

  debugLog("resolved theme", {
    configPath: cfgPath,
    requested: {
      accent: accentRequested || null,
      gray: grayRequested || null,
      appearance: appearanceRequested || null,
    },
    resolved: {
      appearance,
      accent: accentName,
      gray: grayName,
      accentFallback,
      grayFallback,
      brandSamples: accentScale
        ? {
            50: accentScale["50"],
            500: accentScale["500"],
            900: accentScale["900"],
          }
        : null,
      graySamples: grayScale
        ? {50: grayScale["50"], 500: grayScale["500"], 900: grayScale["900"]}
        : null,
    },
  });

  return {
    appearance,
    accent: {name: accentName, scale: accentScale},
    gray: {name: grayName, scale: grayScale},
    variables: mergedVars,
    css,
    sassConfig,
  };
}

module.exports = {
  loadCanopyTheme,
  toTailwindScale,
  normalizePaletteName,
  normalizeAppearance,
  AVAILABLE_PALETTES: Array.from(AVAILABLE).sort(),
  __DEBUG_ENABLED: DEBUG_ENABLED,
  variablesToCss,
  buildVariablesMap,
  buildSassConfig,
};
