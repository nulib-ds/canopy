// A visitor's built search index, kept in their browser's IndexedDB so the next page
// that searches imports it rather than building it again: for 4,000 records, about 20 ms
// against 450 (measured in Node, 2026-11-16). One index is kept, the current one. Any
// failure (no IndexedDB, a private window, a full disk) only means building it again.

'use strict';

const DB_NAME = 'canopy-search';
const STORE = 'indexes';

function hasIndexedDb() {
  try {
    return typeof indexedDB !== 'undefined';
  } catch (_) {
    return false;
  }
}

function openDb() {
  return new Promise((resolve) => {
    if (!hasIndexedDb()) return resolve(null);
    try {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'version' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch (_) {
      resolve(null);
    }
  });
}

async function readEntry(key) {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const request = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => resolve(null);
    } catch (_) {
      resolve(null);
    }
  });
}

// Writes the entry and drops every other, 1.x's FlexSearch 0.7 indexes among them.
async function writeEntry(entry) {
  const db = await openDb();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const transaction = db.transaction(STORE, 'readwrite');
      const store = transaction.objectStore(STORE);
      store.put(entry);
      const keys = store.getAllKeys();
      keys.onsuccess = () => {
        (keys.result || []).forEach((key) => {
          if (key !== entry.version) store.delete(key);
        });
      };
      transaction.oncomplete = () => resolve(true);
      transaction.onerror = () => resolve(false);
    } catch (_) {
      resolve(false);
    }
  });
}

// Resolves to { index, cached }: the index for these records, imported from the cache
// when this engine stored one for this version, or else built and stored.
async function openIndex({ engine, records, version }) {
  const key = `${engine.id}:${version}`;
  if (version) {
    const entry = await readEntry(key);
    if (entry && entry.exportData) {
      try {
        return { index: await engine.importIndex(entry.exportData), cached: true };
      } catch (_) {}
    }
  }
  const index = engine.buildIndex(records);
  if (version) {
    try {
      const exportData = await engine.exportIndex(index);
      await writeEntry({ version: key, exportData, ts: Date.now() });
    } catch (_) {}
  }
  return { index, cached: false };
}

module.exports = { openIndex };
