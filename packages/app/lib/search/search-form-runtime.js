// The header's search field (`SearchPanel`): suggestions under it as a visitor types, and
// on the search page, the page's own query. The suggestions come from the same engine as
// the search page's results (`search-engine-runtime.js`), loaded the first time the field
// is used, so a page that is not searched loads neither it nor the index.
//
// A visitor reaches the suggestions with the down arrow or Tab, and goes back with the up
// arrow or Escape. Each group (Works, Pages) is a named group. How many there are is said
// in a status message, once typing pauses (4.1.3); the words come from `locale.yml`.

function ready(fn) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fn, { once: true });
  } else {
    fn();
  }
}

function parseProps(el) {
  try {
    const script = el.querySelector('script[type="application/json"]');
    if (script) return JSON.parse(script.textContent || '{}');
  } catch (_) {}
  return {};
}

function getBasePath() {
  try {
    const raw = window && window.CANOPY_BASE_PATH ? String(window.CANOPY_BASE_PATH) : '';
    if (!raw) return '';
    return raw.endsWith('/') ? raw.slice(0, -1) : raw;
  } catch (_) {
    return '';
  }
}

// The engine sits beside this script; its `?v=` changes with every build, as this one's.
const ENGINE_SRC = (() => {
  try {
    const own = document.currentScript && document.currentScript.src;
    if (!own) return '';
    const url = new URL('canopy-search-engine.js', own);
    const version = new URL(own).searchParams.get('v');
    if (version) url.searchParams.set('v', version);
    return url.href;
  } catch (_) {
    return '';
  }
})();

let enginePromise = null;
function loadEngine() {
  if (window.CanopySearchEngine) return Promise.resolve(window.CanopySearchEngine);
  if (!enginePromise) {
    enginePromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = ENGINE_SRC || `${getBasePath()}/scripts/canopy-search-engine.js`;
      script.async = true;
      script.onload = () =>
        window.CanopySearchEngine
          ? resolve(window.CanopySearchEngine)
          : reject(new Error('the search engine did not start'));
      script.onerror = () => reject(new Error('the search engine did not load'));
      document.head.appendChild(script);
    });
    enginePromise.catch(() => {
      enginePromise = null;
    });
  }
  return enginePromise;
}

function openEngine() {
  return loadEngine().then((api) => api.open());
}

function message(path, fallback, replacements) {
  let value;
  try {
    value = path.split('.').reduce((node, key) => (node == null ? node : node[key]), window.CANOPY_LOCALE_MESSAGES);
  } catch (_) {
    value = undefined;
  }
  const template = typeof value === 'string' ? value : fallback;
  return template.replace(/\{([^}]+)\}/g, (match, key) =>
    replacements && replacements[key] != null ? String(replacements[key]) : match,
  );
}

function groupLabel(type) {
  const key = String(type || '').toLowerCase();
  if (key === 'work') return message('common.types.work', 'Works');
  if (key === 'page') return message('common.types.page', 'Pages');
  if (key === 'docs') return message('common.types.docs', 'Docs');
  return key ? key.charAt(0).toUpperCase() + key.slice(1) : '';
}

function countMessage(count) {
  const noun =
    count === 1
      ? message('common.nouns.suggestion', 'suggestion')
      : message('common.nouns.suggestions', 'suggestions');
  if (!count) return message('common.statuses.empty_short', 'No {content}', { content: noun });
  return message('common.phrases.count_content', '{count} {content}', { count, content: noun });
}

// The search page's runtime marks its page (`search-app.jsx`), whatever its route: there
// the field drives the page's results rather than suggestions.
function isOnSearchPage() {
  try {
    if (window.CanopySearchPage) return true;
    const base = getBasePath();
    let path = String(location.pathname || '');
    if (base && path.startsWith(base)) path = path.slice(base.length);
    if (path.endsWith('/')) path = path.slice(0, -1);
    return path === '/search' || path === '/search/index.html';
  } catch (_) {
    return false;
  }
}

function hidePanel(panel) {
  if (!panel) return;
  panel.classList.add('is-empty');
  panel.setAttribute('hidden', 'hidden');
}

function showPanel(panel) {
  if (!panel) return;
  panel.classList.remove('is-empty');
  panel.removeAttribute('hidden');
}

function getItems(list) {
  try {
    return Array.prototype.slice.call(list.querySelectorAll('[data-canopy-item]'));
  } catch (_) {
    return [];
  }
}

function renderList(list, records, groupOrder, idPrefix) {
  list.innerHTML = '';
  const panel = list.closest('[data-canopy-search-form-panel]');
  if (!records.length) {
    hidePanel(panel);
    return;
  }
  showPanel(panel);
  const groups = new Map();
  records.forEach((record) => {
    const type = String((record && record.type) || 'page');
    if (!groups.has(type)) groups.set(type, []);
    groups.get(type).push(record);
  });
  const desiredOrder = Array.isArray(groupOrder) ? groupOrder : [];
  const orderedKeys = [
    ...desiredOrder.filter((key) => groups.has(key)),
    ...Array.from(groups.keys()).filter((key) => !desiredOrder.includes(key)),
  ];
  orderedKeys.forEach((key, groupIndex) => {
    const group = document.createElement('div');
    group.className = 'canopy-search-teaser__group';
    group.setAttribute('role', 'group');
    const header = document.createElement('div');
    header.className = 'canopy-search-teaser__label';
    header.id = `${idPrefix}-group-${groupIndex}`;
    header.textContent = groupLabel(key);
    group.setAttribute('aria-labelledby', header.id);
    group.appendChild(header);
    (groups.get(key) || []).forEach((record) => {
      const item = document.createElement('a');
      item.setAttribute('data-canopy-item', '');
      item.href = String((record && record.href) || '');
      item.className = 'canopy-card canopy-card--teaser canopy-search-teaser__item canopy-teaser-card';

      if (record && record.thumbnail) {
        const media = document.createElement('div');
        media.className = 'canopy-search-teaser__thumb';
        const img = document.createElement('img');
        img.src = record.thumbnail;
        img.alt = '';
        img.loading = 'lazy';
        img.className = 'canopy-search-teaser__thumb-img';
        media.appendChild(img);
        item.appendChild(media);
      }

      const textWrap = document.createElement('div');
      textWrap.className = 'canopy-search-teaser__text';
      const title = document.createElement('span');
      title.textContent = record.title || record.href || '';
      title.className = 'canopy-search-teaser__title';
      textWrap.appendChild(title);
      const meta = Array.isArray(record && record.metadata) ? record.metadata : [];
      if (meta.length) {
        const metaLine = document.createElement('span');
        metaLine.textContent = meta.slice(0, 2).join(' • ');
        metaLine.className = 'canopy-search-teaser__meta';
        textWrap.appendChild(metaLine);
      }
      item.appendChild(textWrap);

      item.onfocus = () => {
        try {
          item.scrollIntoView({ block: 'nearest' });
        } catch (_) {}
      };
      group.appendChild(item);
    });
    list.appendChild(group);
  });
}

function focusFirst(list) {
  const items = getItems(list);
  if (items.length) items[0].focus();
}

function focusLast(list, resetTarget) {
  const items = getItems(list);
  if (!items.length) {
    if (resetTarget && resetTarget.focus) resetTarget.focus();
    return;
  }
  items[items.length - 1].focus();
}

function bindKeyboardNavigation({ input, list, panel, ensureResults }) {
  // The arrows reopen suggestions Escape closed, for the same query, before moving in.
  const ensure = () => {
    if (getItems(list).length && String(input.value || '').trim()) {
      showPanel(panel);
      return true;
    }
    if (typeof ensureResults === 'function') ensureResults();
    return false;
  };
  input.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!ensure()) return;
      focusFirst(list);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (!ensure()) return;
      focusLast(list, input);
    }
  });

  list.addEventListener('keydown', (event) => {
    const current = event.target && event.target.closest && event.target.closest('[data-canopy-item]');
    if (!current) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      const items = getItems(list);
      const idx = items.indexOf(current);
      const next = items[Math.min(items.length - 1, idx + 1)] || current;
      next.focus();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      const items = getItems(list);
      const idx = items.indexOf(current);
      if (idx <= 0) {
        if (input && input.focus) input.focus();
      } else {
        (items[idx - 1] || current).focus();
      }
    } else if (event.key === 'Escape') {
      hidePanel(panel);
      try {
        if (input && input.focus) input.focus();
      } catch (_) {}
    }
  });
}

// A visually hidden status message beside the field, there from the start so that a
// screen reader hears it change.
function ensureStatus(host) {
  let status = host.querySelector('[data-canopy-search-form-status]');
  if (!status) {
    status = document.createElement('div');
    status.setAttribute('data-canopy-search-form-status', '');
    status.setAttribute('role', 'status');
    status.className = 'sr-only';
    host.appendChild(status);
  }
  return status;
}

// Long enough that a screen reader hears the count once typing pauses, not every key.
const ANNOUNCE_DELAY = 800;

let hostCount = 0;

async function attachSearchForm(host) {
  const config = parseProps(host) || {};
  const maxResults = Number(config.maxResults || 8) || 8;
  const groupOrder = Array.isArray(config.groupOrder) ? config.groupOrder : ['work', 'page'];
  const hotkey = typeof config.hotkey === 'string' ? config.hotkey : '';
  const onSearchPage = isOnSearchPage();
  hostCount += 1;
  const idPrefix = `canopy-search-suggestions-${hostCount}`;

  const panel = host.querySelector('[data-canopy-search-form-panel]');
  if (!panel) return;

  if (!onSearchPage) {
    const wrapper = host.querySelector('.relative');
    if (wrapper) wrapper.setAttribute('data-canopy-search-form-auto', '1');
  }

  if (onSearchPage) hidePanel(panel);

  const list = panel.querySelector('#cplist') || panel.querySelector('.canopy-search-teaser__list');
  if (!list) return;

  const input = host.querySelector('[data-canopy-search-form-input]');
  if (!input) return;

  try {
    const qp = new URLSearchParams(location.search || '').get('q');
    if (qp) input.value = qp;
  } catch (_) {}

  const status = onSearchPage ? null : ensureStatus(host);
  let statusTimer = null;
  function announce(text) {
    if (!status) return;
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => {
      if (status.textContent !== text) status.textContent = text;
    }, ANNOUNCE_DELAY);
  }

  let sequence = 0;
  async function filterAndShow(query) {
    const mine = (sequence += 1);
    const q = String(query || '').trim();
    if (!q) {
      list.innerHTML = '';
      hidePanel(panel);
      announce('');
      return;
    }
    let engine;
    try {
      engine = await openEngine();
    } catch (error) {
      try {
        console.warn('[canopy][search-form] no suggestions:', error && (error.message || error));
      } catch (_) {}
      return;
    }
    // A later keystroke has its own search.
    if (mine !== sequence) return;
    const found = engine.search(q, maxResults);
    renderList(list, found, groupOrder, idPrefix);
    announce(countMessage(found.length));
  }

  input.addEventListener('input', () => {
    if (onSearchPage) {
      try {
        window.dispatchEvent(new CustomEvent('canopy:search:setQuery', { detail: { query: input.value || '' } }));
      } catch (_) {}
      return;
    }
    filterAndShow(input.value || '');
  });

  bindKeyboardNavigation({
    input,
    list,
    panel,
    ensureResults: () => {
      filterAndShow(input.value || '');
    },
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') hidePanel(panel);
  });

  document.addEventListener('mousedown', (event) => {
    try {
      if (!panel.contains(event.target) && !host.contains(event.target)) hidePanel(panel);
    } catch (_) {}
  });

  if (hotkey) {
    // The shortcut's hint in the field, in the platform's words, and the same for a reader.
    try {
      const mac = /Mac|iPhone|iPad|iPod/i.test(
        (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || navigator.userAgent || '',
      );
      const hint = host.querySelector('[data-canopy-search-hotkey]');
      if (hint) {
        hint.textContent = mac ? '⌘K' : 'Ctrl K';
        hint.hidden = false;
      }
      input.setAttribute('aria-keyshortcuts', mac ? 'Meta+K' : 'Control+K');
    } catch (_) {}
    document.addEventListener('keydown', (event) => {
      try {
        const want = hotkey.toLowerCase();
        if (!want) return;
        const isMod = event.metaKey || event.ctrlKey;
        const isCmd =
          (want === 'mod+k' || want === 'cmd+k' || want === 'ctrl+k') && (event.key === 'k' || event.key === 'K');
        if (isCmd && isMod) {
          event.preventDefault();
          if (onSearchPage) {
            try {
              window.dispatchEvent(new CustomEvent('canopy:search:setQuery', { detail: { hotkey: true } }));
            } catch (_) {}
            return;
          }
          if (input.focus) input.focus();
          filterAndShow(input.value || '');
        }
      } catch (_) {}
    });
  }

  function openPanel() {
    if (onSearchPage) {
      try {
        window.dispatchEvent(new CustomEvent('canopy:search:setQuery', { detail: {} }));
      } catch (_) {}
      return;
    }
    // Start loading the engine and the index as the field takes focus, ahead of typing.
    openEngine().catch(() => {});
    filterAndShow(input.value || '');
  }

  host.addEventListener('click', (event) => {
    const trigger = event.target && event.target.closest && event.target.closest('[data-canopy-search-form-trigger]');
    if (!trigger) return;
    const mode = (trigger.dataset && trigger.dataset.canopySearchFormTrigger) || '';
    if (mode === 'submit' || mode === 'form') return;
    event.preventDefault();
    if (input.focus) input.focus();
    openPanel();
  });

  input.addEventListener('focus', () => {
    openPanel();
  });
}

ready(() => {
  const hosts = Array.from(document.querySelectorAll('[data-canopy-search-form]'));
  hosts.forEach((host) => {
    attachSearchForm(host).catch((err) => {
      try {
        console.warn('[canopy][search-form] failed to initialise', err && (err.message || err));
      } catch (_) {}
    });
  });
});
