const { createBrowserLoader } = require('../../../packages/app/lib/discovery/browser-loader');

const catalogUrl = 'https://museum.example/canopy/api/discovery/index.json';
const manifest = {
  '@context': 'http://iiif.io/api/presentation/3/context.json',
  id: 'https://provider.example/manifest/1',
  type: 'Manifest',
  label: { en: ['Herbarium'] },
};
const record = {
  ...manifest,
  snapshotUrl: 'resources/manifest-1.json',
  citationUrl: '/canopy/works/herbarium.html',
};
const catalog = {
  schemaVersion: '1.0',
  protocol: 'IIIF',
  datasetVersion: 'build-1',
  resources: [record],
};

function response(data) {
  return { ok: true, json: async () => data };
}

function loader(fetchJson, options = {}) {
  return createBrowserLoader({
    catalogUrl,
    origin: 'https://museum.example',
    fetch: fetchJson,
    ...options,
  });
}

test('loads lazily, shares pending reads, and returns usable base-path links', async () => {
  const fetchJson = jest.fn(async (url) => response(url === catalogUrl ? catalog : manifest));
  const source = loader(fetchJson);
  expect(fetchJson).not.toHaveBeenCalled();
  const [first, second] = await Promise.all([source.loadCatalog(), source.loadCatalog()]);
  expect(first).toBe(second);
  expect(first.resources[0]).toMatchObject({
    snapshotUrl: 'https://museum.example/canopy/api/discovery/resources/manifest-1.json',
    citationUrl: 'https://museum.example/canopy/works/herbarium.html',
  });
  expect(await source.loadResource(first.resources[0], first)).toEqual(manifest);
  expect(await source.loadResource(first.resources[0], first)).toEqual(manifest);
  expect(fetchJson).toHaveBeenCalledTimes(2);
  expect(fetchJson.mock.calls[0][1]).toMatchObject({ credentials: 'omit', redirect: 'error' });
});

test('resolves a bare citation path against the site root', async () => {
  const source = loader(async () =>
    response({ ...catalog, resources: [{ ...record, citationUrl: 'works/herbarium.html' }] }),
  );
  expect((await source.loadCatalog()).resources[0].citationUrl).toBe(
    'https://museum.example/canopy/works/herbarium.html',
  );
});

test.each([
  'https://external.example/private.json',
  'https://user:password@museum.example/canopy/api/discovery/resources/a.json',
  '/canopy/api/private.json',
  '../private.json',
  'resources/%2e%2e/%2e%2e/private.json',
  'resources/..%2f..%2fprivate.json',
  'resources/..%5c..%5cprivate.json',
  'resources/private.json?token=secret',
  'resources/private.json#fragment',
  'file:///private/data.json',
])('rejects an unsafe snapshot URL without fetching it: %s', async (snapshotUrl) => {
  const fetchJson = jest.fn(async () =>
    response({ ...catalog, resources: [{ ...record, snapshotUrl }] }),
  );
  await expect(loader(fetchJson).loadCatalog()).rejects.toThrow();
  expect(fetchJson).toHaveBeenCalledTimes(1);
});

test('rejects an external catalog before any fetch', () => {
  const fetchJson = jest.fn();
  expect(() =>
    loader(fetchJson, { catalogUrl: 'https://other.example/api/discovery/index.json' }),
  ).toThrow();
  expect(fetchJson).not.toHaveBeenCalled();
});

test.each([
  { ...catalog, schemaVersion: '2.0' },
  { ...catalog, resources: null },
  { ...catalog, resources: [record, record] },
  { ...catalog, resources: [{ ...record, snapshotUrl: undefined }] },
])('rejects malformed catalogs and retries after correction', async (invalid) => {
  const fetchJson = jest
    .fn()
    .mockResolvedValueOnce(response(invalid))
    .mockResolvedValueOnce(response(catalog));
  const source = loader(fetchJson);
  await expect(source.loadCatalog()).rejects.toThrow();
  await expect(source.loadCatalog()).resolves.toMatchObject({ datasetVersion: 'build-1' });
  expect(fetchJson).toHaveBeenCalledTimes(2);
});

test('reports a failed fetch and permits retry instead of caching the failure', async () => {
  const fetchJson = jest
    .fn()
    .mockResolvedValueOnce({ ok: false, status: 503 })
    .mockResolvedValueOnce(response(catalog));
  const source = loader(fetchJson);
  await expect(source.loadCatalog()).rejects.toThrow('HTTP 503');
  await expect(source.loadCatalog()).resolves.toMatchObject({ protocol: 'IIIF' });
});

test('passes the registration signal to fetch and rejects redirected responses', async () => {
  const controller = new AbortController();
  const fetchJson = jest.fn(async () => ({
    ...response(catalog),
    url: 'https://outside.example/data.json',
  }));
  await expect(loader(fetchJson, { signal: controller.signal }).loadCatalog()).rejects.toThrow();
  expect(fetchJson.mock.calls[0][1].signal).toBe(controller.signal);
});
