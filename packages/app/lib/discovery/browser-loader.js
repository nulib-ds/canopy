const { validateCatalog } = require('./validation');

function createBrowserLoader({ catalogUrl, origin, fetch: fetchJson, signal }) {
  const catalog = new URL(catalogUrl);
  const directory = new URL('.', catalog);

  function resolveUrl(value) {
    const url = new URL(value, catalog);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.origin !== origin ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !url.pathname.startsWith(directory.pathname) ||
      /%(?:2f|5c|00)/i.test(url.pathname)
    ) {
      throw new Error('IIIF discovery data must use a public URL within this site’s catalog.');
    }
    return url.href;
  }

  const resolvedCatalogUrl = resolveUrl(catalog.href);
  const requests = new Map();

  async function readJson(value, transform = (data) => data) {
    const url = resolveUrl(value);
    if (!requests.has(url)) {
      const request = Promise.resolve()
        .then(() =>
          fetchJson(url, {
            signal,
            credentials: 'omit',
            redirect: 'error',
            cache: 'no-cache',
          }),
        )
        .then((response) => {
          if (!response.ok) {
            throw new Error(`IIIF discovery data could not be loaded (HTTP ${response.status}).`);
          }
          if (response.url) resolveUrl(response.url);
          return response.json();
        })
        .then(transform)
        .catch((error) => {
          requests.delete(url);
          throw error;
        });
      requests.set(url, request);
      if (requests.size > 65) {
        const oldest = [...requests.keys()].find((key) => key !== resolvedCatalogUrl);
        requests.delete(oldest);
      }
    }
    return requests.get(url);
  }

  return {
    loadCatalog: () =>
      readJson(resolvedCatalogUrl, (data) => {
        validateCatalog(data);
        if (typeof data.datasetVersion !== 'string') {
          throw new Error('The IIIF discovery catalog has an invalid dataset version.');
        }
        const ids = new Set();
        const resources = data.resources.map((record) => {
          if (
            !record ||
            typeof record.id !== 'string' ||
            !record.id ||
            ids.has(record.id) ||
            !['Collection', 'Manifest'].includes(record.type) ||
            typeof record.snapshotUrl !== 'string' ||
            !record.snapshotUrl
          ) {
            throw new Error('The IIIF discovery catalog contains an invalid resource.');
          }
          ids.add(record.id);
          const citation = record.citationUrl
            ? new URL(record.citationUrl, new URL('../../', catalog))
            : null;
          return {
            ...record,
            snapshotUrl: resolveUrl(record.snapshotUrl),
            citationUrl:
              citation &&
              ['http:', 'https:'].includes(citation.protocol) &&
              !citation.username &&
              !citation.password
                ? citation.href
                : null,
          };
        });
        return { ...data, resources };
      }),
    loadResource: (record) => {
      if (!record || typeof record.snapshotUrl !== 'string' || !record.snapshotUrl) {
        throw new Error('This IIIF resource has no published snapshot.');
      }
      return readJson(record.snapshotUrl);
    },
  };
}

module.exports = { createBrowserLoader };
