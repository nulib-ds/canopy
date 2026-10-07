const React = require("react");
const {STORAGE_KEY, STORAGE_VERSION} = require("./theme-preview-storage");

const FALLBACK_DEFAULTS = {
  appearance: "light",
  accentColor: "indigo",
  grayColor: "slate",
};

// Runs in the browser. Each palette's variables are precomputed by the
// ThemeShowcase component with the build's own buildVariablesMap(), so this
// only merges them and forces them over the page's theme.
function themeShowcaseRuntime(STORAGE_KEY, STORAGE_VERSION) {
  const baseDefaults = Object.assign({}, FALLBACK_DEFAULTS);
  const html =
    typeof document !== "undefined" ? document.documentElement : null;
  if (!html) return;
  const htmlDefaultAccent = html.getAttribute("data-accent");
  const htmlDefaultAppearance = html.classList.contains("dark")
    ? "dark"
    : baseDefaults.appearance;
  const documentDefaults = Object.assign({}, baseDefaults, {
    appearance: htmlDefaultAppearance || baseDefaults.appearance,
    accentColor: htmlDefaultAccent || baseDefaults.accentColor,
  });
  const styleSelector = "[data-theme-showcase-style]";
  let styleEl = document.querySelector(styleSelector);
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.setAttribute("data-theme-showcase-style", "true");
    document.head.appendChild(styleEl);
  }

  function lookupVars(dataset, appearance, type, name) {
    if (!dataset || !appearance || !type || !name) return null;
    const bucket = dataset.vars && dataset.vars[appearance];
    if (!bucket || !bucket[type]) return null;
    return bucket[type][name] || null;
  }

  function buildOverrideVars(options) {
    const vars = {};
    for (const source of [options.accentVars, options.grayVars]) {
      for (const [prop, value] of Object.entries(source || {})) {
        vars[prop] = `${value} !important`;
      }
    }
    if (options.appearanceActive && options.appearance) {
      vars["color-scheme"] = options.appearance === "dark" ? "dark" : "light";
    }
    return vars;
  }

  function formatCss(vars) {
    const entries = Object.entries(vars).filter(
      ([, value]) => value != null && value !== "",
    );
    if (!entries.length) return "";
    const body = entries
      .map(([prop, value]) => `  ${prop}: ${value};`)
      .join("\n");
    return `@layer properties {\n  :root {\n${body}\n  }\n  :host {\n${body}\n  }\n}`;
  }

  function titleCase(value) {
    if (!value) return "None";
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  function loadStored() {
    try {
      if (typeof localStorage === "undefined") return null;
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return null;
      if (parsed.version !== STORAGE_VERSION) {
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }
      return parsed;
    } catch (error) {
      console.warn(
        "[canopy-theme-showcase] Failed to read stored theme",
        error,
      );
      return null;
    }
  }

  function persistState(state, defaults, cssText, appliedAppearance) {
    try {
      if (typeof localStorage === "undefined") return;
      const matchesDefaults =
        state.appearance === defaults.appearance &&
        state.accent === defaults.accentColor &&
        state.gray === defaults.grayColor;
      if (matchesDefaults) {
        localStorage.removeItem(STORAGE_KEY);
        return;
      }
      const payload = {
        appearance: state.appearance || null,
        accent: state.accent || null,
        gray: state.gray || null,
        css: cssText || "",
        appliedAppearance:
          appliedAppearance ||
          state.appearance ||
          defaults.appearance ||
          "light",
        version: STORAGE_VERSION,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
      console.warn("[canopy-theme-showcase] Failed to persist theme", error);
    }
  }

  function activateHtmlAppearance(mode) {
    if (mode === "dark") html.classList.add("dark");
    else html.classList.remove("dark");
  }

  function updateHtmlAccent(accentName, fallback) {
    const fallbackName = fallback || baseDefaults.accentColor || "indigo";
    const normalized = (accentName || "").toString().trim().toLowerCase();
    html.setAttribute("data-accent", normalized || fallbackName);
  }

  function hydrateStoredTheme(stored, defaults) {
    const resolvedDefaults = Object.assign({}, baseDefaults, defaults || {});
    const appliedAppearance =
      (stored && (stored.appliedAppearance || stored.appearance)) ||
      resolvedDefaults.appearance ||
      baseDefaults.appearance;
    const storedAccent = stored && stored.accent ? stored.accent : null;
    const activeAccent =
      storedAccent || resolvedDefaults.accentColor || baseDefaults.accentColor;
    activateHtmlAppearance(appliedAppearance);
    updateHtmlAccent(activeAccent, resolvedDefaults.accentColor);
    if (stored && typeof stored.css === "string" && stored.css) {
      styleEl.textContent = stored.css;
    }
  }

  const roots = Array.from(document.querySelectorAll("[data-theme-showcase]"));
  const contexts = [];

  roots.forEach((root) => {
    const dataEl = root.querySelector("[data-theme-showcase-values]");
    if (!dataEl) return;
    try {
      const dataset = JSON.parse(dataEl.textContent || "{}");
      contexts.push({root, dataset});
    } catch (error) {
      console.error(
        "[canopy-theme-showcase] Failed to parse preview data",
        error,
      );
    }
  });

  const storedPreferences = loadStored();
  hydrateStoredTheme(storedPreferences, documentDefaults);

  if (!contexts.length) return;

  contexts.forEach(({root, dataset}) => {
    const defaults = Object.assign(
      {},
      documentDefaults,
      dataset.defaults || {},
    );
    const stored = storedPreferences;
    const state = {
      appearance:
        stored && stored.appearance ? stored.appearance : defaults.appearance,
      accent: stored && stored.accent ? stored.accent : defaults.accentColor,
      gray: stored && stored.gray ? stored.gray : defaults.grayColor,
    };

    const statusEl = root.querySelector("[data-theme-showcase-status]");
    const appearanceLabel = root.querySelector(
      '[data-theme-active-label="appearance"]',
    );
    const accentLabel = root.querySelector(
      '[data-theme-active-label="accent"]',
    );
    const grayLabel = root.querySelector('[data-theme-active-label="gray"]');
    const appearanceButtons = Array.from(
      root.querySelectorAll("[data-theme-appearance]"),
    );
    const swatches = Array.from(root.querySelectorAll("[data-theme-swatch]"));
    const resetBtn = root.querySelector("[data-theme-reset]");

    function updateAppearanceButtons() {
      appearanceButtons.forEach((button) => {
        const value = button.getAttribute("data-theme-appearance");
        if (!value) return;
        const isActive = value === state.appearance;
        if (isActive) button.classList.add("is-active");
        else button.classList.remove("is-active");
      });
    }

    function updateSwatchIndicators() {
      swatches.forEach((swatch) => {
        const type = swatch.getAttribute("data-theme-swatch-type");
        const value = swatch.getAttribute("data-theme-swatch-value");
        if (!type || !value) return;
        const isActive = state[type] === value;
        swatch.setAttribute("data-swatch-active", isActive ? "true" : "false");
        swatch.setAttribute("aria-pressed", isActive ? "true" : "false");
      });
    }

    function updateLabels() {
      if (appearanceLabel)
        appearanceLabel.textContent = titleCase(state.appearance);
      if (accentLabel) accentLabel.textContent = titleCase(state.accent);
      if (grayLabel) grayLabel.textContent = titleCase(state.gray);
    }

    function updateStatus() {
      if (!statusEl) return;
      const parts = [];
      if (state.appearance) parts.push(`appearance: ${state.appearance}`);
      if (state.accent) parts.push(`accent: ${state.accent}`);
      if (state.gray) parts.push(`gray: ${state.gray}`);
      statusEl.textContent = parts.length
        ? `Overrides → ${parts.join(" • ")}`
        : "No overrides active";
    }

    function apply() {
      const activeAppearance = state.appearance || defaults.appearance;
      const activeAccentName = state.accent || defaults.accentColor || "indigo";
      const accentVars = state.accent
        ? lookupVars(dataset, activeAppearance, "accent", state.accent)
        : null;
      const grayVars = state.gray
        ? lookupVars(dataset, activeAppearance, "gray", state.gray)
        : null;
      const css = formatCss(
        buildOverrideVars({
          appearanceActive: Boolean(state.appearance),
          appearance: activeAppearance,
          accentVars,
          grayVars,
        }),
      );
      styleEl.textContent = css;
      activateHtmlAppearance(state.appearance || defaults.appearance);
      updateHtmlAccent(activeAccentName, defaults.accentColor);
      updateStatus();
      updateLabels();
      updateSwatchIndicators();
      updateAppearanceButtons();
      persistState(state, defaults, css, activeAppearance);
    }

    swatches.forEach((swatch) => {
      swatch.addEventListener("click", () => {
        const type = swatch.getAttribute("data-theme-swatch-type");
        const value = swatch.getAttribute("data-theme-swatch-value");
        if (!type || !value) return;
        if (state[type] === value) {
          state[type] = null;
        } else {
          state[type] = value;
        }
        apply();
      });
    });

    appearanceButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const value = button.getAttribute("data-theme-appearance");
        if (!value) return;
        state.appearance = value;
        apply();
      });
    });

    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        state.appearance = defaults.appearance;
        state.accent = defaults.accentColor;
        state.gray = defaults.grayColor;
        apply();
      });
    }

    apply();
  });
}

const SCRIPT = (() => {
  const runtimeSource = themeShowcaseRuntime
    .toString()
    .replace(
      "const baseDefaults = Object.assign({}, FALLBACK_DEFAULTS);",
      `const baseDefaults = ${JSON.stringify(FALLBACK_DEFAULTS)};`,
    );
  const raw = `(${runtimeSource})(${JSON.stringify(STORAGE_KEY)}, ${JSON.stringify(STORAGE_VERSION)});`;
  return raw.replace(/<\/script/gi, "<\\/script");
})();

function ThemeShowcaseScript() {
  return React.createElement("script", {
    dangerouslySetInnerHTML: {__html: SCRIPT},
  });
}

module.exports = ThemeShowcaseScript;
module.exports.default = ThemeShowcaseScript;
