// `theme.appearance: auto` in canopy.yml: a page follows the visitor's system setting,
// and the footer's switch (`AppearanceToggle`) lets them choose Light or Dark instead.
//
// The script is inline in every page's <head>, ahead of the stylesheet, so a page is
// drawn in its appearance from the first paint, never light first. It sets `light` or
// `dark` on <html>, which the theme's tokens follow (`appearanceVariablesToCss`,
// ui/theme-palette.js), as do the rules written for `html.dark`. Without it the tokens
// still follow `prefers-color-scheme`, and the switch stays hidden: it does nothing
// without a script.
//
// The choice is kept per site: sites on one origin (GitHub Pages' project sites) each
// keep their own, by the site's base path.

const STORAGE_PREFIX = 'canopy-appearance:';

function appearanceStorageKey(basePath) {
  const base = typeof basePath === 'string' && basePath.trim() ? basePath.trim() : '/';
  return `${STORAGE_PREFIX}${base}`;
}

function appearanceScript(basePath) {
  const key = JSON.stringify(appearanceStorageKey(basePath));
  return `(function () {
  var KEY = ${key};
  var root = document.documentElement;
  var media = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  function stored() {
    try {
      var value = window.localStorage.getItem(KEY);
      return value === "light" || value === "dark" ? value : "system";
    } catch (error) {
      return "system";
    }
  }
  function apply(choice) {
    var dark = choice === "dark" || (choice === "system" && !!(media && media.matches));
    root.classList.toggle("dark", dark);
    root.classList.toggle("light", !dark);
  }
  function sync() {
    var choice = stored();
    var switches = document.querySelectorAll("[data-canopy-appearance]");
    for (var i = 0; i < switches.length; i += 1) {
      var select = switches[i].querySelector("select");
      if (select) select.value = choice;
      switches[i].hidden = false;
    }
  }
  apply(stored());
  if (media && media.addEventListener) {
    media.addEventListener("change", function () {
      if (stored() === "system") apply("system");
    });
  }
  document.addEventListener("change", function (event) {
    var select = event.target;
    if (!select || !select.closest || !select.closest("[data-canopy-appearance]")) return;
    var choice = select.value === "light" || select.value === "dark" ? select.value : "system";
    try {
      if (choice === "system") window.localStorage.removeItem(KEY);
      else window.localStorage.setItem(KEY, choice);
    } catch (error) {}
    apply(choice);
    sync();
  });
  window.addEventListener("storage", function (event) {
    if (event.key !== KEY) return;
    apply(stored());
    sync();
  });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", sync);
  else sync();
})();`;
}

module.exports = { appearanceScript, appearanceStorageKey };
