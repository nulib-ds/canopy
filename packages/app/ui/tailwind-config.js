/**
 * @deprecated Removed in the next major release. Tailwind v4 reads a JS
 * config only through `@config`, and the Canopy preset and plugin it wires up
 * no longer add styles. Customize Tailwind in `app/styles/index.css` instead.
 */
const path = require("node:path");
const {fileURLToPath} = require("node:url");

const canopyPreset = require("./tailwind-canopy-iiif-preset.js");
const canopyPlugin = require("./tailwind-canopy-iiif-plugin.js");

const DEFAULT_SAFELIST = ["canopy-footer", "canopy-footer__inner"];
const canopyUiDist = path.join(__dirname, "dist");
const canopyLibRoot = path.join(__dirname, "..");

const toArray = (value) => {
  if (!value && value !== 0) return [];
  return Array.isArray(value) ? value : [value];
};

const normalizeGlob = (filepath) => filepath.replace(/\\+/g, "/");

const mergeTheme = (baseTheme = {}, overrideTheme = {}) => {
  if (!overrideTheme || typeof overrideTheme !== "object") return baseTheme;
  const result = {...baseTheme, ...overrideTheme};
  if (baseTheme.extend || overrideTheme.extend) {
    result.extend = {
      ...(baseTheme.extend || {}),
      ...(overrideTheme.extend || {}),
    };
  }
  return result;
};

const resolveProjectRoot = (metaUrl, explicitRoot) => {
  if (explicitRoot) return path.resolve(explicitRoot);
  if (metaUrl) {
    const href = typeof metaUrl === "string" ? metaUrl : metaUrl.href;
    if (href) {
      const fromUrl = fileURLToPath(href);
      const dir = path.dirname(fromUrl);
      if (dir.includes(`${path.sep}node_modules${path.sep}`)) {
        return process.cwd();
      }
      return dir;
    }
  }
  return process.cwd();
};

const buildBaseContent = (root, includeCanopySources = true) => {
  const content = [
    normalizeGlob(path.join(root, "content/**/*.{mdx,html}")),
    normalizeGlob(path.join(root, "app/**/*.{js,ts,jsx,tsx}")),
  ];

  if (includeCanopySources) {
    content.push(
      normalizeGlob(path.join(canopyUiDist, "**/*.{js,mjs,jsx,tsx}")),
      normalizeGlob(path.join(canopyLibRoot, "iiif/components/**/*.{js,jsx}"))
    );
  }

  return content;
};

const isUrlLike = (value) => {
  if (!value) return false;
  if (typeof value === "string") return true;
  return typeof value.href === "string" && typeof value.protocol === "string";
};

let warnedDeprecated = false;

function warnDeprecated() {
  if (warnedDeprecated) return;
  warnedDeprecated = true;
  process.emitWarning(
    "@canopy-iiif/app/ui/tailwind-config is deprecated and will be removed in the next major release. " +
      "Tailwind v4 reads a JS config only through @config, and Canopy's preset and plugin no longer add styles. " +
      "Customize Tailwind in app/styles/index.css: https://nulib-ds.github.io/canopy/docs/theme/#tailwind",
    {type: "DeprecationWarning", code: "CANOPY_TAILWIND_CONFIG"},
  );
}

function defineCanopyTailwindConfig(metaUrlOrOptions, maybeOptions) {
  warnDeprecated();
  const hasMetaArgument = isUrlLike(metaUrlOrOptions);
  const metaUrl = hasMetaArgument ? metaUrlOrOptions : undefined;
  const options = (hasMetaArgument ? maybeOptions : metaUrlOrOptions) || {};

  const {
    root,
    content,
    presets,
    plugins,
    safelist,
    theme,
    includeCanopyPreset = true,
    includeCanopyPlugin = true,
    includeCanopySafelist = true,
    includeCanopySources = true,
    ...rest
  } = options;

  const projectRoot = resolveProjectRoot(metaUrl, root);
  const baseContent = buildBaseContent(projectRoot, includeCanopySources);
  const basePresets = includeCanopyPreset ? [canopyPreset] : [];
  const basePlugins = includeCanopyPlugin ? [canopyPlugin] : [];
  const baseSafelist = includeCanopySafelist ? DEFAULT_SAFELIST.slice() : [];

  const config = {
    content: baseContent.slice(),
    safelist: baseSafelist.slice(),
    theme: {extend: {}},
    ...rest,
  };

  if (content !== undefined) {
    config.content = baseContent.concat(toArray(content));
  }

  if (presets !== undefined) {
    if (presets === false) {
      config.presets = [];
    } else {
      config.presets = toArray(presets);
    }
  } else if (includeCanopyPreset) {
    config.presets = basePresets.slice();
  }

  if (plugins !== undefined) {
    if (plugins === false) {
      config.plugins = [];
    } else {
      config.plugins = toArray(plugins);
    }
  } else if (includeCanopyPlugin) {
    config.plugins = basePlugins.slice();
  }

  if (safelist !== undefined) {
    config.safelist =
      safelist === false ? [] : baseSafelist.concat(toArray(safelist));
  }

  if (theme) {
    config.theme = mergeTheme(config.theme, theme);
  }

  config.theme = mergeTheme(config.theme, {colors: {}});

  return config;
}

module.exports = defineCanopyTailwindConfig;
module.exports.defineCanopyTailwindConfig = defineCanopyTailwindConfig;
module.exports.default = defineCanopyTailwindConfig;
