const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { exportDiscovery, facetsFor } = require('../../../packages/app/lib/discovery/export');
const {
  rememberRetrieved,
  inheritProvenance,
  saveProvenance,
  readProvenance,
} = require('../../../packages/app/lib/discovery/provenance');
const { createIngestionReport } = require('../../../packages/app/lib/discovery/ingestion');
const context = 'http://iiif.io/api/presentation/3/context.json';
const collection = (id, items = []) => ({
  '@context': context,
  id,
  type: 'Collection',
  label: { en: ['Collection'] },
  items,
});
const manifest = (id) => ({
  '@context': context,
  id,
  type: 'Manifest',
  label: { en: ['Book'], fr: ['Livre'] },
  items: [],
  metadata: [
    { label: { en: ['Subject'] }, value: { en: ['History'] } },
    { label: { en: ['Private search field'] }, value: { en: ['unindexed'] } },
  ],
  rights: 'https://creativecommons.org/publicdomain/mark/1.0/',
  requiredStatement: { label: { en: ['Attribution'] }, value: { en: ['Example library'] } },
});
let outDir;
let options;
beforeEach(async () => {
  outDir = await fs.mkdtemp(path.join(os.tmpdir(), 'canopy-discovery-'));
  options = {
    outDir,
    cacheDir: path.join(outDir, 'cache'),
    config: { webmcp: true, metadata: ['Subject'] },
    absoluteUrl: (url) => `https://example.org/sub${url}`,
  };
});
afterEach(async () => {
  await fs.rm(outDir, { recursive: true, force: true });
});

test('exports IIIF identity, membership, citations and searchable fields independently of full snapshots', async () => {
  const work = manifest('https://iiif.example/work');
  const child = collection('https://iiif.example/child', [{ id: work.id, type: 'Manifest' }]);
  const root = collection('https://iiif.example/root', [{ id: child.id, type: 'Collection' }]);
  const catalog = await exportDiscovery({
    ...options,
    entries: [root, child, work].map((resource) => ({ resource })),
    roots: [root.id],
    records: [{ id: work.id, href: '/works/book.html' }],
  });
  const record = catalog.resources.find((r) => r.id === work.id);
  expect(record.collectionIds).toEqual([child.id, root.id]);
  expect(record.citationUrl).toBe('https://example.org/sub/works/book.html');
  expect(record.searchText).toContain('History');
  expect(record.searchText).not.toContain('unindexed');
  expect(record.source.retrievedAt).toBeNull();
  expect(
    JSON.parse(await fs.readFile(path.join(outDir, 'api/discovery', record.snapshotUrl), 'utf8')),
  ).toEqual(work);
  expect(catalog.coverage.complete).toBe(true);
});

test('stable IDs and dataset version survive input reorder and content changes create new snapshot URLs', async () => {
  const a = manifest('https://iiif.example/a');
  const b = manifest('https://iiif.example/b');
  const first = await exportDiscovery({ ...options, entries: [{ resource: a }, { resource: b }] });
  const second = await exportDiscovery({ ...options, entries: [{ resource: b }, { resource: a }] });
  expect(first.datasetVersion).toBe(second.datasetVersion);
  const third = await exportDiscovery({
    ...options,
    entries: [{ resource: { ...a, label: { en: ['Changed'] } } }],
  });
  expect(third.resources[0].id).toBe(a.id);
  expect(third.resources[0].snapshotUrl).not.toBe(first.resources[0].snapshotUrl);
  expect(await fs.readdir(path.join(outDir, 'api/discovery/resources'))).toHaveLength(1);
});

test.each([false, 'false', '0', 'no', 0, null, undefined, ''])(
  'search exclusions honor an explicit enabled value of %j',
  async (enabled) => {
    const work = {
      ...manifest('https://iiif.example/work'),
      summary: { en: ['excluded-summary'] },
    };
    const catalog = await exportDiscovery({
      ...options,
      config: {
        ...options.config,
        search: {
          index: {
            metadata: { enabled, all: true },
            summary: { enabled },
            annotations: { enabled },
          },
        },
      },
      entries: [{ resource: work }],
      records: [
        {
          id: work.id,
          searchMetadataValues: ['excluded-metadata'],
          searchAnnotation: 'excluded-annotation',
        },
      ],
    });
    const record = catalog.resources[0];
    expect(record.searchText).toBe('Book Livre');
    expect(record.facets).toEqual({});
    expect(record.summary).toEqual(work.summary);
    expect(record.metadata).toEqual(work.metadata);
    expect(
      JSON.parse(await fs.readFile(path.join(outDir, 'api/discovery', record.snapshotUrl), 'utf8')),
    ).toEqual(work);
  },
);

test.each([true, 'true', ' YES ', 1, '1'])(
  'search settings honor an enabled value of %j',
  async (enabled) => {
    const work = {
      ...manifest('https://iiif.example/work'),
      summary: { en: ['included-summary'] },
    };
    const catalog = await exportDiscovery({
      ...options,
      config: {
        ...options.config,
        search: {
          index: {
            metadata: { enabled },
            summary: { enabled },
            annotations: { enabled },
          },
        },
      },
      entries: [{ resource: work }],
      records: [{ id: work.id, searchAnnotation: 'included-annotation' }],
    });
    expect(catalog.resources[0].searchText).toContain('History');
    expect(catalog.resources[0].searchText).toContain('included-summary');
    expect(catalog.resources[0].searchText).toContain('included-annotation');
  },
);

test.each([false, 'false', '0', 'no', 0, null, undefined, ''])(
  'metadata.all=%j retains configured field exclusions',
  (all) => {
    const config = { ...options.config, search: { index: { metadata: { all } } } };
    expect(facetsFor(manifest('https://iiif.example/work'), config)).toEqual({
      Subject: ['History'],
    });
  },
);

test.each([true, 'true', ' YES ', 1, '1'])(
  'metadata.all=%j includes all metadata fields',
  (all) => {
    const config = { ...options.config, search: { index: { metadata: { all } } } };
    expect(facetsFor(manifest('https://iiif.example/work'), config)).toEqual({
      Subject: ['History'],
      'Private search field': ['unindexed'],
    });
  },
);

test('missing enabled settings retain metadata and summary defaults while annotations stay excluded', async () => {
  const work = { ...manifest('https://iiif.example/work'), summary: { en: ['included-summary'] } };
  const catalog = await exportDiscovery({
    ...options,
    entries: [{ resource: work }],
    records: [{ id: work.id, searchAnnotation: 'excluded-annotation' }],
  });
  expect(catalog.resources[0].searchText).toContain('History');
  expect(catalog.resources[0].searchText).toContain('included-summary');
  expect(catalog.resources[0].searchText).not.toContain('excluded-annotation');
});

test('tracks provenance across normalization and cached rebuilds without modifying IIIF JSON', async () => {
  const original = rememberRetrieved(
    {
      '@context': 'http://iiif.io/api/presentation/2/context.json',
      '@id': 'https://iiif.example/a',
    },
    'https://iiif.example/a',
  );
  const normalized = inheritProvenance(original, manifest('https://iiif.example/a'));
  await saveProvenance(normalized, options.cacheDir);
  const loaded = await readProvenance(JSON.parse(JSON.stringify(normalized)), options.cacheDir);
  expect(loaded).toMatchObject({
    presentationVersion: '2.1',
    transformation: 'presentation-2-to-3',
    uri: original['@id'],
  });
  expect(loaded.retrievedAt).toMatch(/^20/);
  expect(normalized).not.toHaveProperty('source');
});

test('reports missing/unsupported resources and never publishes local paths', async () => {
  const local = manifest('file:///private/collection.json');
  const catalog = await exportDiscovery({
    ...options,
    entries: [{ resource: local }],
    requestedManifests: ['/private/missing.json'],
    failures: [{ id: '/private/failed.json' }],
  });
  expect(catalog.resources).toEqual([]);
  expect(catalog.coverage.complete).toBe(false);
  expect(JSON.stringify(catalog)).not.toContain('/private/');
});

test('webmcp: false removes previous exports', async () => {
  await exportDiscovery({ ...options, entries: [] });
  await exportDiscovery({ ...options, config: { webmcp: false } });
  await expect(fs.stat(path.join(outDir, 'api/discovery'))).rejects.toThrow();
});

test('ingestion resolves local source aliases, preserves paged membership and deduplicates children', () => {
  const report = createIngestionReport(options.config);
  const c = collection('https://iiif.example/c');
  const a = manifest('https://iiif.example/a');
  const b = manifest('https://iiif.example/b');
  report.collection(c, [{ id: a.id, type: 'Manifest' }], true);
  report.collection(c, [
    { id: a.id, type: 'Manifest' },
    { id: b.id, type: 'Manifest' },
  ]);
  report.request('assets/manifest.json');
  report.manifest(a, 'assets/manifest.json');
  expect(report.result().requestedManifests).toEqual([a.id]);
  expect(report.result().entries[0].items).toHaveLength(2);
});
