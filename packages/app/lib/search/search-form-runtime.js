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

function toLower(val) {
  try {
    return String(val || '').toLowerCase();
  } catch (_) {
    return '';
  }
}

function getBasePath() {
  try {
    const raw = (window && window.CANOPY_BASE_PATH) ? String(window.CANOPY_BASE_PATH) : '';
    if (!raw) return '';
    return raw.endsWith('/') ? raw.slice(0, -1) : raw;
  } catch (_) {
    return '';
  }
}

function withBase(href) {
  try {
    let raw = href == null ? '' : String(href);
    raw = raw.trim();
    if (!raw) return raw;
    const basePath = getBasePath();
    if (!basePath) {
      if (/^[a-z][a-z0-9+.-]*:/i.test(raw) || raw.startsWith('//') || raw.startsWith('#') || raw.startsWith('?')) {
        return raw;
      }
      let cleaned = raw.replace(/^\/+/, '');
      while (cleaned.startsWith('./')) cleaned = cleaned.slice(2);
      while (cleaned.startsWith('../')) cleaned = cleaned.slice(3);
      if (!cleaned) return '/';
      return '/' + cleaned;
    }
    if (/^https?:/i.test(raw)) return raw;
    const cleaned = raw.replace(/^\/+/, '');
    return `${basePath}/${cleaned}`;
  } catch (_) {
    return href;
  }
}

function rootBase() {
  return getBasePath();
}

function documentLocale() {
  try {
    if (document && document.documentElement && document.documentElement.lang) {
      const lang = String(document.documentElement.lang).trim();
      if (lang) return lang;
    }
  } catch (_) {}
  return '';
}

function resolveLocaleHref(record, fallbackHref) {
  const routes =
    record && record.routes && typeof record.routes === 'object'
      ? record.routes
      : null;
  if (!routes) return fallbackHref;
  const current = documentLocale();
  const candidates = [];
  if (current) {
    candidates.push(current);
    if (current.includes('-')) {
      const base = current.split('-')[0];
      if (base && base !== current) candidates.push(base);
    }
  }
  if (record && typeof record.locale === 'string') {
    const recLocale = record.locale.trim();
    if (recLocale && !candidates.includes(recLocale)) candidates.push(recLocale);
  }
  for (const candidate of candidates) {
    if (!candidate) continue;
    if (routes[candidate]) return routes[candidate];
    const lower = candidate.toLowerCase();
    if (lower !== candidate && routes[lower]) return routes[lower];
  }
  const first = Object.values(routes).find((value) => value);
  return first || fallbackHref;
}

function isOnSearchPage() {
  try {
    const base = rootBase();
    let path = String(location.pathname || '');
    if (base && path.startsWith(base)) path = path.slice(base.length);
    if (path.endsWith('/')) path = path.slice(0, -1);
    return path === '/search' || path === '/search/index.html';
  } catch (_) {
    return false;
  }
}

let recordsPromise = null;
async function loadRecords() {
  if (!recordsPromise) {
    recordsPromise = (async () => {
      try {
        const base = rootBase();
        let version = '';
        let annotationsAssetPath = '';
        try {
          const meta = await fetch(`${base}/api/index.json`).then((r) => (r && r.ok ? r.json() : null)).catch(() => null);
          if (meta && typeof meta.version === 'string') version = meta.version;
          const annotationsAsset =
            meta &&
            meta.search &&
            meta.search.assets &&
            meta.search.assets.annotations;
          if (annotationsAsset && annotationsAsset.path) {
            annotationsAssetPath = String(annotationsAsset.path);
          }
        } catch (_) {}
        const suffix = version ? `?v=${encodeURIComponent(version)}` : '';
        const indexUrl = `${base}/api/search-index.json${suffix}`;
        const recordsUrl = `${base}/api/search-records.json${suffix}`;
        const [indexRes, displayRes] = await Promise.all([
          fetch(indexUrl).catch(() => null),
          fetch(recordsUrl).catch(() => null),
        ]);
        let indexRecords = [];
        if (indexRes && indexRes.ok) {
          try {
            const raw = await indexRes.json();
            indexRecords = Array.isArray(raw)
              ? raw
              : raw && Array.isArray(raw.records)
              ? raw.records
              : [];
          } catch (_) {
            indexRecords = [];
          }
        }
        let displayRecords = [];
        if (displayRes && displayRes.ok) {
          try {
            const raw = await displayRes.json();
            displayRecords = Array.isArray(raw)
              ? raw
              : raw && Array.isArray(raw.records)
              ? raw.records
              : [];
          } catch (_) {
            displayRecords = [];
          }
        }
        let annotationsRecords = [];
        if (annotationsAssetPath) {
          try {
            const annotationsUrl = `${base}/api/${annotationsAssetPath.replace(/^\/+/, '')}${suffix}`;
            const annotationsRes = await fetch(annotationsUrl).catch(() => null);
            if (annotationsRes && annotationsRes.ok) {
              const raw = await annotationsRes.json().catch(() => []);
              annotationsRecords = Array.isArray(raw)
                ? raw
                : raw && Array.isArray(raw.records)
                ? raw.records
                : [];
            }
          } catch (_) {}
        }
        if (!indexRecords.length && displayRecords.length) {
          return displayRecords;
        }
        const displayMap = new Map();
        displayRecords.forEach((rec) => {
          if (!rec || typeof rec !== 'object') return;
          const key = rec.id ? String(rec.id) : rec.href ? String(rec.href) : '';
          if (!key) return;
          displayMap.set(key, rec);
        });
        const annotationsMap = new Map();
        annotationsRecords.forEach((rec, idx) => {
          if (!rec || typeof rec !== 'object') return;
          const key = rec.id ? String(rec.id) : String(idx);
          const text = rec.annotation ? String(rec.annotation) : rec.text ? String(rec.text) : '';
          if (!key || !text) return;
          annotationsMap.set(key, text);
        });
        return indexRecords.map((rec, idx) => {
          const key = rec && rec.id ? String(rec.id) : String(idx);
          const display = key ? displayMap.get(key) : null;
          const merged = { ...(display || {}), ...(rec || {}) };
          if (!merged.id && key) merged.id = key;
          const fallbackHref = merged.href || (display && display.href) || '';
          const localeHref = resolveLocaleHref(display || merged, fallbackHref);
          if (localeHref) {
            merged.href = withBase(localeHref);
          } else if (fallbackHref) {
            merged.href = withBase(fallbackHref);
          }
          if (!Array.isArray(merged.metadata)) {
            const meta = Array.isArray(rec && rec.metadata) ? rec.metadata : [];
            merged.metadata = meta;
          }
          if (annotationsMap.has(key) && !merged.annotation)
            merged.annotation = annotationsMap.get(key);
          return merged;
        });
      } catch (_) {
        return [];
      }
    })();
  }
  return recordsPromise;
}

function groupLabel(type) {
  if (type === 'work') return 'Works';
  if (type === 'page') return 'Pages';
  return type.charAt(0).toUpperCase() + type.slice(1);
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

function renderList(list, records, groupOrder) {
  list.innerHTML = '';
  const panel = list.closest('[data-canopy-search-form-panel]');
  if (!records.length) {
    hidePanel(panel);
    return;
  }
  showPanel(panel);
  const groups = new Map();
  records.forEach((record) => {
    const type = String(record && record.type || 'page');
    if (!groups.has(type)) groups.set(type, []);
    groups.get(type).push(record);
  });
  const desiredOrder = Array.isArray(groupOrder) ? groupOrder : [];
  const orderedKeys = [...desiredOrder.filter((key) => groups.has(key)), ...Array.from(groups.keys()).filter((key) => !desiredOrder.includes(key))];
  orderedKeys.forEach((key) => {
    const header = document.createElement('div');
    header.className = 'canopy-search-teaser__label';
    header.textContent = groupLabel(key);
    list.appendChild(header);
    const entries = groups.get(key) || [];
    entries.forEach((record) => {
      const href = withBase(String(record && record.href || ''));
      const item = document.createElement('a');
      item.setAttribute('data-canopy-item', '');
      item.href = href;
      item.tabIndex = 0;
      item.className = 'canopy-card canopy-card--teaser canopy-search-teaser__item canopy-teaser-card';

      const showThumb = String(record && record.type || '') === 'work' && record && record.thumbnail;
      if (showThumb) {
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
        try { item.scrollIntoView({ block: 'nearest' }); } catch (_) {}
      };
      list.appendChild(item);
    });
  });
}

function focusFirst(list) {
  const items = getItems(list);
  if (!items.length) return;
  items[0].focus();
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
  const ensure = () => {
    if (typeof ensureResults === 'function') ensureResults();
    return getItems(list).length > 0;
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
        input && input.focus && input.focus();
      } else {
        const prev = items[idx - 1];
        ;(prev || current).focus();
      }
    } else if (event.key === 'Enter') {
      event.preventDefault();
      try { current.click(); } catch (_) {}
    } else if (event.key === 'Escape') {
      hidePanel(panel);
      try { input && input.focus && input.focus(); } catch (_) {}
    }
  });
}

async function attachSearchForm(host) {
  const config = parseProps(host) || {};
  const maxResults = Number(config.maxResults || 8) || 8;
  const groupOrder = Array.isArray(config.groupOrder) ? config.groupOrder : ['work', 'page'];
  const hotkey = typeof config.hotkey === 'string' ? config.hotkey : '';
  const onSearchPage = isOnSearchPage();

  const panel = (() => {
    try { return host.querySelector('[data-canopy-search-form-panel]'); } catch (_) { return null; }
  })();
  if (!panel) return;

  if (!onSearchPage) {
    try {
      const wrapper = host.querySelector('.relative');
      if (wrapper) wrapper.setAttribute('data-canopy-search-form-auto', '1');
    } catch (_) {}
  }

  if (onSearchPage) hidePanel(panel);

  const list = (() => {
    try { return panel.querySelector('#cplist'); } catch (_) { return null; }
  })();
  if (!list) return;

  const input = (() => {
    try { return host.querySelector('[data-canopy-search-form-input]'); } catch (_) { return null; }
  })();
  if (!input) return;

  try {
    const params = new URLSearchParams(location.search || '');
    const qp = params.get('q');
    if (qp) input.value = qp;
  } catch (_) {}

  const records = await loadRecords();

  function render(items) {
    renderList(list, items, groupOrder);
  }

  function filterAndShow(query) {
    try {
      const q = toLower(query);
      if (!q) {
        list.innerHTML = '';
        hidePanel(panel);
        return;
      }
      const out = [];
      for (let i = 0; i < records.length; i += 1) {
        const record = records[i];
        const title = String(record && record.title || '');
        const parts = [toLower(title)];
        const metadata = Array.isArray(record && record.metadata) ? record.metadata : [];
        for (const value of metadata) {
          parts.push(toLower(value));
        }
        if (record && record.summary) parts.push(toLower(record.summary));
        if (record && record.annotation) parts.push(toLower(record.annotation));
        const haystack = parts.join(' ');
        if (haystack.includes(q)) out.push(record);
        if (out.length >= maxResults) break;
      }
      render(out);
    } catch (_) {}
  }

  input.addEventListener('input', () => {
    if (onSearchPage) {
      try {
        const ev = new CustomEvent('canopy:search:setQuery', { detail: { query: input.value || '' } });
        window.dispatchEvent(ev);
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
      if (!getItems(list).length) {
        filterAndShow(input.value || '');
      }
    },
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      hidePanel(panel);
    }
  });

  document.addEventListener('mousedown', (event) => {
    try {
      if (!panel.contains(event.target) && !host.contains(event.target)) {
        hidePanel(panel);
      }
    } catch (_) {}
  });

  if (hotkey) {
    document.addEventListener('keydown', (event) => {
      try {
        const want = hotkey.toLowerCase();
        if (!want) return;
        const isMod = event.metaKey || event.ctrlKey;
        const isCmd = (want === 'mod+k' || want === 'cmd+k' || want === 'ctrl+k') && (event.key === 'k' || event.key === 'K');
        if (isCmd && isMod) {
          event.preventDefault();
          if (onSearchPage) {
            try { window.dispatchEvent(new CustomEvent('canopy:search:setQuery', { detail: { hotkey: true } })); } catch (_) {}
            return;
          }
          if (input && input.focus) input.focus();
          filterAndShow(input && input.value || '');
        }
      } catch (_) {}
    });
  }

  function openPanel() {
    if (onSearchPage) {
      try { window.dispatchEvent(new CustomEvent('canopy:search:setQuery', { detail: {} })); } catch (_) {}
      return;
    }
    if (input && input.focus) input.focus();
    filterAndShow(input && input.value || '');
  }

  host.addEventListener('click', (event) => {
    const trigger = event.target && event.target.closest && event.target.closest('[data-canopy-search-form-trigger]');
    if (!trigger) return;
    const mode = (trigger.dataset && trigger.dataset.canopySearchFormTrigger) || '';
    if (mode === 'submit' || mode === 'form') return;
    event.preventDefault();
    openPanel();
  });

  try {
    input.addEventListener('focus', () => { openPanel(); });
  } catch (_) {}
}

ready(() => {
  const hosts = Array.from(document.querySelectorAll('[data-canopy-search-form]'));
  if (!hosts.length) return;
  hosts.forEach((host) => {
    attachSearchForm(host).catch((err) => {
      try {
        console.warn('[canopy][search-form] failed to initialise', err && (err.message || err));
      } catch (_) {}
    });
  });
});
