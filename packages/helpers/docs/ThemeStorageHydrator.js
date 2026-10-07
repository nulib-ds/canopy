const React = require('react');
const {STORAGE_KEY, STORAGE_VERSION} = require('./theme-preview-storage');

function ThemeStorageHydrator() {
  const source = `(() => {
    const STORAGE_KEY = '${STORAGE_KEY}';
    const STORAGE_VERSION = ${STORAGE_VERSION};
    const STYLE_ATTR = 'data-theme-storage-style';
    if (typeof document === 'undefined') return;
    const html = document.documentElement;
    const DEFAULT_APPEARANCE = html.classList.contains('dark') ? 'dark' : 'light';
    const DEFAULT_ACCENT = (html.getAttribute('data-accent') || 'indigo').trim().toLowerCase() || 'indigo';

    function parseStored() {
      try {
        if (typeof localStorage === 'undefined') return null;
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return null;
        if (parsed.version !== STORAGE_VERSION) {
          localStorage.removeItem(STORAGE_KEY);
          return null;
        }
        return parsed;
      } catch (_) {
        return null;
      }
    }

    function applyAppearance(value) {
      const mode = (value || '').toLowerCase() || DEFAULT_APPEARANCE;
      if (mode === 'dark') html.classList.add('dark');
      else html.classList.remove('dark');
    }

    function applyAccent(value) {
      const normalized = (value || '').toString().trim().toLowerCase();
      html.setAttribute('data-accent', normalized || DEFAULT_ACCENT);
    }

    function applyStoredTheme() {
      const payload = parseStored();
      let styleEl = document.querySelector('style[' + STYLE_ATTR + ']');
      if (!payload || !payload.css) {
        if (styleEl) styleEl.remove();
        applyAppearance(null);
        applyAccent(null);
        return;
      }
      if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.setAttribute(STYLE_ATTR, 'true');
        document.head.appendChild(styleEl);
      }
      styleEl.textContent = payload.css;
      const appearance = payload.appliedAppearance || payload.appearance;
      applyAppearance(appearance);
      applyAccent(payload.accent);
    }

    applyStoredTheme();
    window.addEventListener('storage', (event) => {
      if (!event || event.key !== STORAGE_KEY) return;
      applyStoredTheme();
    });
  })();`;

  return React.createElement('script', {
    dangerouslySetInnerHTML: {__html: source},
  });
}

module.exports = ThemeStorageHydrator;
module.exports.default = ThemeStorageHydrator;
