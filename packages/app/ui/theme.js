const fs = require("fs");
const yaml = require("js-yaml");
const {resolveCanopyConfigPath} = require("../lib/config-path");
const {
  AVAILABLE_PALETTES,
  normalizePaletteName,
  normalizeAppearance,
  toTailwindScale,
  buildVariablesMap,
  variablesToCss,
} = require("./theme-palette");

const DEFAULT_ACCENT = "indigo";
const DEFAULT_GRAY = "slate";
const DEBUG_FLAG_RAW = String(process.env.CANOPY_DEBUG_THEME || "");
const DEBUG_ENABLED = /^(1|true|yes|on)$/i.test(DEBUG_FLAG_RAW.trim());

function debugLog(...args) {
  if (!DEBUG_ENABLED) return;
  try {
    console.log("[canopy-theme]", ...args);
  } catch (_) {}
}

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
  AVAILABLE_PALETTES,
  __DEBUG_ENABLED: DEBUG_ENABLED,
  variablesToCss,
  buildVariablesMap,
  buildSassConfig,
};
