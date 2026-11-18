const fs = require("fs");
const yaml = require("js-yaml");
const {resolveCanopyConfigPath} = require("../lib/config-path");
const {
  AVAILABLE_PALETTES,
  appearanceVariablesToCss,
  normalizeAccentName,
  normalizePaletteName,
  normalizeAppearance,
  toTailwindScale,
  buildVariablesMap,
  variablesToCss,
} = require("./theme-palette");

// A site that names no colors: gold on sand (Mat, 2026-11-18; indigo on slate until 2.0.2).
const DEFAULT_ACCENT = "gold";
const DEFAULT_GRAY = "sand";
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

/**
 * @deprecated Always returned "" and is no longer used; removed in the next
 * major release.
 */
function buildSassConfig() {
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
  // `auto` draws light first; its dark tokens follow under `prefers-color-scheme`.
  const scaleMode = appearance === "dark" ? "dark" : "light";

  // A palette's name or a hex color (`#0f62fe`).
  let accentName = normalizeAccentName(accentRequested);
  let accentScale = accentName
    ? toTailwindScale(accentName, {appearance: scaleMode, role: "accent"})
    : null;
  let accentFallback = false;
  if (!accentScale) {
    accentFallback = true;
    accentName = DEFAULT_ACCENT;
    accentScale = toTailwindScale(DEFAULT_ACCENT, {
      appearance: scaleMode,
      role: "accent",
    });
  }

  let grayName = normalizePaletteName(grayRequested);
  let grayScale = grayName
    ? toTailwindScale(grayName, {appearance: scaleMode, role: "gray"})
    : null;
  let grayFallback = false;
  if (!grayScale) {
    grayFallback = true;
    grayName = DEFAULT_GRAY;
    grayScale = toTailwindScale(DEFAULT_GRAY, {
      appearance: scaleMode,
      role: "gray",
    });
  }

  const variables = buildVariablesMap(accentScale, grayScale, {
    appearance: scaleMode,
  });
  let variablesDark = null;
  let css = variablesToCss(variables);
  if (appearance === "auto") {
    variablesDark = buildVariablesMap(
      toTailwindScale(accentName, {appearance: "dark", role: "accent"}),
      toTailwindScale(grayName, {appearance: "dark", role: "gray"}),
      {appearance: "dark"},
    );
    css = appearanceVariablesToCss(variables, variablesDark);
  }

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
    variables,
    // `appearance: auto` only: the dark tokens beside the light `variables`.
    variablesDark,
    css,
  };
}

module.exports = {
  DEFAULT_ACCENT,
  DEFAULT_GRAY,
  loadCanopyTheme,
  toTailwindScale,
  normalizeAccentName,
  normalizePaletteName,
  normalizeAppearance,
  AVAILABLE_PALETTES,
  __DEBUG_ENABLED: DEBUG_ENABLED,
  variablesToCss,
  buildVariablesMap,
  buildSassConfig,
};
