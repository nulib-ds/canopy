const { createDiscoveryTools } = require('../../../packages/app/lib/discovery/tools');
const { MAX_RESPONSE_BYTES } = require('../../../packages/app/lib/discovery/envelope');

const rootId = 'https://example.org/collection/root';
const childId = 'https://example.org/collection/child';

function manifest(number, properties = {}) {
  const id = `https://example.org/manifest/${number}`;
  return {
    id,
    type: 'Manifest',
    label: { en: [`Work ${number}`], fr: [`Œuvre ${number}`] },
    metadata: [{ label: { en: ['Private search field'] }, value: { en: ['secretneedle'] } }],
    rights: 'https://creativecommons.org/publicdomain/mark/1.0/',
    requiredStatement: { label: { en: ['Attribution'] }, value: { en: ['Example Library'] } },
    source: {
      uri: id,
      presentationVersion: '2.1',
      retrievedAt: '2026-01-01T00:00:00.000Z',
      transformation: 'presentation-2-to-3',
    },
    snapshotUrl: `https://example.org/api/discovery/resources/${number}.json`,
    citationUrl: `https://example.org/works/${number}.html`,
    collectionIds: [rootId, childId],
    searchText: `Work ${number} blue painting`,
    facets: { Subject: ['Painting'], Creator: ['A'] },
    ...properties,
  };
}

function fixture(records = [manifest(1), manifest(2)]) {
  const child = {
    id: childId,
    type: 'Collection',
    label: { en: ['Child collection'] },
    items: records
      .filter((record) => record.collectionIds.length)
      .map(({ id, type, label }) => ({ id, type, label })),
    collectionIds: [rootId],
  };
  const root = {
    id: rootId,
    type: 'Collection',
    label: { en: ['Root collection'] },
    items: [{ id: child.id, type: child.type, label: child.label }],
    collectionIds: [],
  };
  const catalog = {
    schemaVersion: '1.0',
    protocol: 'IIIF',
    datasetVersion: 'v1',
    generatedAt: '2026-02-01T00:00:00.000Z',
    title: { en: ['Example Library'] },
    roots: [rootId],
    coverage: { failed: 1, skipped: 2 },
    resources: [root, child, ...records],
  };
  const snapshots = Object.fromEntries(
    records.map((record) => [
      record.id,
      {
        '@context': 'http://iiif.io/api/presentation/3/context.json',
        id: record.id,
        type: record.type,
        label: record.label,
        metadata: record.metadata,
        rights: record.rights,
        requiredStatement: record.requiredStatement,
        structures: [{ id: `${record.id}/range`, type: 'Range', label: { en: ['Chapter'] } }],
        items: [{ id: `${record.id}/canvas`, type: 'Canvas', width: 1000, height: 2000 }],
      },
    ]),
  );
  const loadCatalog = jest.fn(async () => catalog);
  const loadResource = jest.fn(async (record) => snapshots[record.id]);
  const tools = createDiscoveryTools({ loadCatalog, loadResource });
  const call = (name, input) => tools.find((tool) => tool.name === `iiif_${name}`).execute(input);
  return { catalog, snapshots, tools, call, loadCatalog, loadResource };
}

describe('IIIF discovery tool contract', () => {
  it('provides explicit read-only IIIF tools without eagerly loading data', () => {
    const { tools, loadCatalog, loadResource } = fixture();
    expect(tools.map((tool) => tool.name)).toEqual([
      'iiif_describe_site',
      'iiif_get_collection',
      'iiif_search_manifests',
      'iiif_get_manifest',
    ]);
    for (const tool of tools) {
      expect(tool.description).toContain('IIIF');
      expect(tool.annotations.readOnlyHint).toBe(true);
      expect(tool.inputSchema.additionalProperties).toBe(false);
    }
    expect(loadCatalog).not.toHaveBeenCalled();
    expect(loadResource).not.toHaveBeenCalled();
  });

  it('requires loaders', () => {
    expect(() => createDiscoveryTools({})).toThrow('requires loadCatalog and loadResource');
  });

  it('describes coverage, root collections, facets, and unparented manifests', async () => {
    const records = [manifest(1), manifest(2, { collectionIds: [], source: {} })];
    const { call } = fixture(records);
    const result = await call('describe_site');
    expect(result).toMatchObject({
      protocol: 'IIIF',
      version: '3.0',
      title: 'Example Library',
      representation: 'summary',
      coverage: { failed: 1, skipped: 2 },
      counts: { collections: 2, manifests: 2 },
      sourcePresentationVersions: ['2.1'],
    });
    expect(result.roots.map((record) => record.id)).toEqual([rootId]);
    expect(result.standaloneManifests.map((record) => record.id)).toEqual([records[1].id]);
    expect(result.facets).toContainEqual({
      label: 'Subject',
      values: ['Painting'],
      totalValues: 1,
      truncated: false,
    });
  });

  it('reports truncated facet lists instead of implying that 100 values are exhaustive', async () => {
    const { call } = fixture([
      manifest(1, { facets: { Subject: Array.from({ length: 101 }, (_, i) => `Subject ${i}`) } }),
    ]);
    const { facets } = await call('describe_site');
    expect(facets[0]).toMatchObject({ totalValues: 101, truncated: true });
    expect(facets[0].values).toHaveLength(100);
  });

  it('retains configured root order independently of catalog record order', async () => {
    const { call, catalog } = fixture();
    catalog.roots = [childId, rootId];
    const { roots } = await call('describe_site');
    expect(roots.map((record) => record.id)).toEqual([childId, rootId]);
  });

  it('preserves IIIF IDs, full snapshots, language maps, and normalization provenance', async () => {
    const { call, catalog, snapshots, loadResource } = fixture();
    const record = catalog.resources[2];
    const result = await call('get_manifest', { id: record.id, language: 'fr-CA' });
    expect(result).toMatchObject({
      representation: 'full',
      title: 'Œuvre 1',
      source: record.source,
      generatedAt: '2026-02-01T00:00:00.000Z',
      citationUrl: record.citationUrl,
    });
    expect(result.resource).toEqual(snapshots[record.id]);
    expect(result.resource.label).toEqual(record.label);
    expect(loadResource).toHaveBeenCalledWith(record, catalog);
    expect(record.label.fr).toEqual(['Œuvre 1']);
  });

  it('keeps unknown public provenance unknown', async () => {
    const record = manifest(1, {
      source: {},
      snapshotUrl: null,
      citationUrl: null,
      label: { none: ['Untitled'] },
    });
    const result = await fixture([record]).call('get_manifest', { id: record.id, language: 'de' });
    expect(result.source).toEqual({
      uri: null,
      presentationVersion: null,
      retrievedAt: null,
      transformation: null,
    });
    expect(result).toMatchObject({ title: 'Untitled', snapshotUrl: null, citationUrl: null });
  });

  it('preserves identities when catalog order changes', async () => {
    const { call, catalog } = fixture([manifest(2), manifest(1)]);
    const before = await call('search_manifests', { query: 'blue' });
    catalog.resources.reverse();
    const after = await call('search_manifests', { query: 'blue' });
    expect(before).toEqual(after);
    expect(after.results.map((item) => item.resource.id)).toEqual([manifest(1).id, manifest(2).id]);
  });

  it('searches exported text only and never excluded metadata or labels', async () => {
    const { call } = fixture([manifest(1, { label: { en: ['Excluded title token'] } })]);
    expect((await call('search_manifests', { query: 'secretneedle' })).results).toEqual([]);
    expect((await call('search_manifests', { query: 'Excluded' })).results).toEqual([]);
    const result = await call('search_manifests', { query: 'PAINTING blue' });
    expect(result.results).toHaveLength(1);
    expect(result.results[0].resource.metadata).toBeUndefined();
    expect(result.results[0].matchSummary).toContain('blue painting');
  });

  it('uses intersection across facet labels, union within values, and ancestor membership', async () => {
    const records = [
      manifest(1),
      manifest(2, { facets: { Subject: ['Drawing'], Creator: ['A'] } }),
      manifest(3, { facets: { Subject: ['Painting'], Creator: ['B'] } }),
      manifest(4, { collectionIds: [] }),
    ];
    const result = await fixture(records).call('search_manifests', {
      query: '',
      collectionId: rootId,
      facets: { subject: ['painting', 'drawing'], Creator: ['a'] },
    });
    expect(result.results.map((item) => item.resource.id)).toEqual([records[0].id, records[1].id]);
  });

  it('rejects unknown collection and facet filters rather than silently broadening a search', async () => {
    const { call } = fixture();
    await expect(
      call('search_manifests', { query: '', collectionId: 'unknown' }),
    ).rejects.toMatchObject({ code: 'UNKNOWN_RESOURCE' });
    await expect(
      call('search_manifests', { query: '', facets: { Unknown: ['value'] } }),
    ).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });
    expect(
      (await call('search_manifests', { query: '', facets: { Subject: ['missing'] } })).results,
    ).toEqual([]);
  });
});

describe('discovery validation and pagination', () => {
  it('rejects prototype-named input properties from parsed JSON', async () => {
    const { call, loadCatalog } = fixture();
    for (const input of ['{"__proto__":{}}', '{"constructor":{}}', '{"toString":{}}']) {
      await expect(call('describe_site', JSON.parse(input))).rejects.toMatchObject({
        code: 'INVALID_ARGUMENT',
      });
    }
    expect(loadCatalog).not.toHaveBeenCalled();
  });

  it.each([
    ['get_manifest', {}],
    ['get_manifest', { id: 1 }],
    ['get_manifest', { id: '  ' }],
    ['describe_site', { surprise: true }],
    ['describe_site', { constructor: 'unknown' }],
    ['describe_site', null],
    ['describe_site', []],
    ['describe_site', { language: false }],
    ['search_manifests', {}],
    ['search_manifests', { query: null }],
    ['search_manifests', { query: '', limit: 0 }],
    ['search_manifests', { query: '', limit: 101 }],
    ['search_manifests', { query: '', limit: 1.5 }],
    ['search_manifests', { query: '', limit: '20' }],
    ['search_manifests', { query: '', facets: [] }],
    ['search_manifests', { query: '', facets: { Subject: [] } }],
    ['search_manifests', { query: '', facets: { Subject: [1] } }],
    ['search_manifests', { query: '', cursor: '' }],
    ['search_manifests', { query: 'x'.repeat(2049) }],
  ])('rejects invalid input for %s before loading a dataset: %j', async (name, args) => {
    const { call, loadCatalog } = fixture();
    await expect(call(name, args)).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });
    expect(loadCatalog).not.toHaveBeenCalled();
  });

  it('rejects unknown IDs and resource type mismatches before loading a snapshot', async () => {
    const { call, loadResource } = fixture();
    await expect(call('get_manifest', { id: rootId })).rejects.toMatchObject({
      code: 'UNKNOWN_RESOURCE',
    });
    await expect(call('get_collection', { id: manifest(1).id })).rejects.toMatchObject({
      code: 'UNKNOWN_RESOURCE',
    });
    await expect(call('get_manifest', { id: 'https://elsewhere.org/' })).rejects.toMatchObject({
      code: 'UNKNOWN_RESOURCE',
    });
    expect(loadResource).not.toHaveBeenCalled();
  });

  it('rejects unsupported and incomplete catalogs', async () => {
    const { call, catalog } = fixture();
    catalog.schemaVersion = '2.0';
    await expect(call('describe_site')).rejects.toMatchObject({ code: 'UNSUPPORTED_SCHEMA' });
    catalog.schemaVersion = '1.0';
    catalog.datasetVersion = '';
    await expect(call('describe_site')).rejects.toMatchObject({ code: 'RESOURCE_UNAVAILABLE' });
  });

  it('defaults to 20 results and accepts 100 with explicit end-of-list cursors', async () => {
    const { call } = fixture(Array.from({ length: 101 }, (_, i) => manifest(i)));
    const first = await call('search_manifests', { query: '' });
    expect(first.results).toHaveLength(20);
    expect(first.pagination).toMatchObject({
      total: 101,
      limit: 20,
      nextCursor: expect.any(String),
    });
    const second = await call('search_manifests', {
      query: '',
      cursor: first.pagination.nextCursor,
      limit: 100,
    });
    expect(second.results).toHaveLength(81);
    expect(second.pagination.nextCursor).toBeNull();
    expect(
      new Set([...first.results, ...second.results].map((item) => item.resource.id)).size,
    ).toBe(101);
  });

  it('preserves collection order through pagination without changing the catalog', async () => {
    const records = [manifest(3), manifest(1), manifest(2)];
    const { call, catalog } = fixture(records);
    const original = JSON.stringify(catalog);
    const first = await call('get_collection', { id: childId, limit: 1 });
    const second = await call('get_collection', {
      id: childId,
      limit: 2,
      cursor: first.pagination.nextCursor,
    });
    expect(first.resource.items.map((item) => item.id)).toEqual([records[0].id]);
    expect(second.resource.items.map((item) => item.id)).toEqual([records[1].id, records[2].id]);
    expect(second).toMatchObject({
      representation: 'summary',
      pagination: { total: 3, nextCursor: null },
    });
    expect(JSON.stringify(catalog)).toBe(original);
  });

  it('rejects stale cursors after a dataset change', async () => {
    const { call, catalog } = fixture();
    const first = await call('search_manifests', { query: '', limit: 1 });
    catalog.datasetVersion = 'v2';
    await expect(
      call('search_manifests', { query: '', cursor: first.pagination.nextCursor }),
    ).rejects.toMatchObject({ code: 'STALE_CURSOR' });
  });

  it('binds cursors to filters and tool scope, with malformed cursor errors', async () => {
    const { call } = fixture();
    const first = await call('search_manifests', { query: '', limit: 1 });
    const cursor = first.pagination.nextCursor;
    await expect(call('search_manifests', { query: 'blue', cursor })).rejects.toMatchObject({
      code: 'INVALID_CURSOR',
    });
    await expect(call('get_collection', { id: childId, cursor })).rejects.toMatchObject({
      code: 'INVALID_CURSOR',
    });
    await expect(call('search_manifests', { query: '', cursor: '%!' })).rejects.toMatchObject({
      code: 'INVALID_CURSOR',
    });
    const forged = JSON.parse(decodeURIComponent(cursor));
    forged.offset = -1;
    await expect(
      call('search_manifests', { query: '', cursor: encodeURIComponent(JSON.stringify(forged)) }),
    ).rejects.toMatchObject({ code: 'INVALID_CURSOR' });
  });

  it('permits equivalent filter ordering when following a cursor', async () => {
    const { call } = fixture();
    const first = await call('search_manifests', {
      query: 'blue painting',
      facets: { Subject: ['Painting', 'Drawing'], Creator: ['A'] },
      limit: 1,
    });
    const second = await call('search_manifests', {
      query: 'PAINTING BLUE',
      facets: { Creator: ['A'], Subject: ['Drawing', 'Painting'] },
      cursor: first.pagination.nextCursor,
    });
    expect(second.results).toHaveLength(1);
    expect(second.results[0].resource.id).not.toBe(first.results[0].resource.id);
  });
});

describe('summary response byte budgets', () => {
  it('reduces search pages to fit, with cursors continuing at the next unreturned result', async () => {
    const records = Array.from({ length: 20 }, (_, i) =>
      manifest(i, { label: { en: ['x'.repeat(4000)] } }),
    );
    const { call } = fixture(records);
    let cursor;
    const ids = [];
    do {
      const page = await call('search_manifests', {
        query: '',
        limit: 20,
        ...(cursor ? { cursor } : {}),
      });
      expect(Buffer.byteLength(JSON.stringify(page))).toBeLessThanOrEqual(MAX_RESPONSE_BYTES);
      expect(page.results.length).toBeGreaterThan(0);
      ids.push(...page.results.map((item) => item.resource.id));
      cursor = page.pagination.nextCursor;
    } while (cursor);
    expect(ids).toHaveLength(20);
    expect(new Set(ids)).toEqual(new Set(records.map((record) => record.id)));
  });

  it('bounds collection children and omits unbounded metadata from summary responses', async () => {
    const records = Array.from({ length: 20 }, (_, i) =>
      manifest(i, { label: { en: ['x'.repeat(6000)] } }),
    );
    const { call, catalog } = fixture(records);
    catalog.resources[1].metadata = [{ value: { en: ['metadata'.repeat(100000)] } }];
    const result = await call('get_collection', { id: childId, limit: 20 });
    expect(result.resource.metadata).toBeUndefined();
    expect(result.resource.items.length).toBeLessThan(20);
    expect(result.pagination.nextCursor).toEqual(expect.any(String));
    expect(Buffer.byteLength(JSON.stringify(result))).toBeLessThanOrEqual(MAX_RESPONSE_BYTES);
    expect(catalog.resources[1].metadata).toHaveLength(1);
  });

  it('rejects oversized individual summaries and site descriptions with an explicit limit error', async () => {
    const { call, catalog } = fixture([manifest(1, { label: { en: ['x'.repeat(100000)] } })]);
    await expect(call('search_manifests', { query: '' })).rejects.toMatchObject({
      code: 'RESOURCE_TOO_LARGE',
    });
    catalog.coverage = { note: 'x'.repeat(100000) };
    await expect(call('describe_site')).rejects.toMatchObject({ code: 'RESOURCE_TOO_LARGE' });
  });
});

describe('manifest response limits and failures', () => {
  it('returns complete JSON up to the exact UTF-8 byte budget', async () => {
    const { call, snapshots } = fixture();
    const id = manifest(1).id;
    snapshots[id].padding = '';
    const initial = await call('get_manifest', { id });
    const bytes = Buffer.byteLength(JSON.stringify(initial));
    snapshots[id].padding = 'x'.repeat(MAX_RESPONSE_BYTES - bytes);
    const full = await call('get_manifest', { id });
    expect(Buffer.byteLength(JSON.stringify(full))).toBe(MAX_RESPONSE_BYTES);
    expect(full.representation).toBe('full');
    snapshots[id].padding += 'é';
    const partial = await call('get_manifest', { id });
    expect(partial.representation).toBe('partial');
    expect(partial.partial.fullResponseBytes).toBe(MAX_RESPONSE_BYTES + 2);
  });

  it('labels oversized manifests, preserves rights, and links complete JSON', async () => {
    const { call, snapshots } = fixture();
    const id = manifest(1).id;
    snapshots[id].items[0].annotations = [{ text: '🖼'.repeat(30000) }];
    const result = await call('get_manifest', { id });
    expect(result).toMatchObject({
      representation: 'partial',
      snapshotUrl: manifest(1).snapshotUrl,
    });
    expect(result.resource.rights).toBe(snapshots[id].rights);
    expect(result.resource.requiredStatement).toEqual(snapshots[id].requiredStatement);
    expect(result.partial.omittedFields).toContain('items');
    expect(Buffer.byteLength(JSON.stringify(result))).toBeLessThanOrEqual(MAX_RESPONSE_BYTES);
  });

  it('bounds even unusually large summary metadata and attributes every omission', async () => {
    const record = manifest(1, { metadata: [{ value: { en: ['x'.repeat(100000)] } }] });
    const { call } = fixture([record]);
    const result = await call('get_manifest', { id: record.id });
    expect(result.partial.omittedFields).toContain('metadata');
    expect(result.resource.metadata).toBeUndefined();
    expect(result.resource.requiredStatement).toEqual(record.requiredStatement);
    expect(Buffer.byteLength(JSON.stringify(result))).toBeLessThanOrEqual(MAX_RESPONSE_BYTES);
  });

  it('does not turn fetch failures into empty resources or expose loader internals', async () => {
    const { call, loadResource } = fixture();
    loadResource.mockRejectedValue(new Error('local path /private/sensitive/data.json'));
    await expect(call('get_manifest', { id: manifest(1).id })).rejects.toMatchObject({
      code: 'RESOURCE_UNAVAILABLE',
    });
    await expect(call('get_manifest', { id: manifest(1).id })).rejects.not.toThrow(
      '/private/sensitive',
    );
  });

  it('rejects snapshots belonging to a different resource', async () => {
    const { call, loadResource } = fixture();
    loadResource.mockResolvedValue({ id: 'https://wrong.example/', type: 'Manifest' });
    await expect(call('get_manifest', { id: manifest(1).id })).rejects.toMatchObject({
      code: 'RESOURCE_UNAVAILABLE',
    });
  });
});
