const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createIngestionReport } = require('../../../packages/app/lib/discovery/ingestion');
const { exportDiscovery } = require('../../../packages/app/lib/discovery/export');
const { createDiscoveryTools } = require('../../../packages/app/lib/discovery/tools');

const config = { webmcp: true };
const context = 'http://iiif.io/api/presentation/3/context.json';
const rootId = 'https://iiif.example/collection';
const childId = 'https://iiif.example/child';
const manifestId = 'https://iiif.example/manifest';
const childAlias = 'https://iiif.example/child-alias';
const manifestAlias = 'https://iiif.example/manifest-alias';
const resource = (id, type, items = []) => ({
  '@context': context,
  id,
  type,
  label: { en: [type] },
  items,
});
let outDir;

afterEach(async () => {
  if (outDir) await fs.rm(outDir, { recursive: true, force: true });
  outDir = undefined;
});

test('canonical aliases remain retrievable through collection tools and preserve source snapshots', async () => {
  const childReference = { id: childAlias, type: 'Collection', label: { en: ['Child'] } };
  const manifestReference = { id: manifestAlias, type: 'Manifest', label: { en: ['Work'] } };
  const root = resource(rootId, 'Collection', [childReference]);
  const child = resource(childId, 'Collection', [manifestReference]);
  const manifest = resource(manifestId, 'Manifest');
  const report = createIngestionReport(config);
  report.collection(root, root.items, true, 'assets/root.json');
  report.collection(child, child.items, false, childAlias);
  report.request(manifestAlias);
  report.manifest(manifest, manifestAlias);
  // The child is also a configured entry point after first being reached from its parent.
  report.collection(child, child.items, true, childId);
  outDir = await fs.mkdtemp(path.join(os.tmpdir(), 'canopy-ingestion-'));
  const catalog = await exportDiscovery({
    ...report.result(),
    config,
    outDir,
    cacheDir: path.join(outDir, 'cache'),
  });
  const tools = new Map(
    createDiscoveryTools({
      loadCatalog: async () => catalog,
      loadResource: async (record) =>
        JSON.parse(
          await fs.readFile(path.join(outDir, 'api/discovery', record.snapshotUrl), 'utf8'),
        ),
    }).map((tool) => [tool.name, tool]),
  );

  const overview = await tools.get('iiif_describe_site').execute({});
  expect(overview.roots.map((entry) => entry.id)).toEqual(
    expect.arrayContaining([rootId, childId]),
  );
  expect(overview.standaloneManifests).toEqual([]);
  const children = await tools.get('iiif_get_collection').execute({ id: rootId });
  expect(children.resource.items[0].id).toBe(childId);
  const works = await tools.get('iiif_get_collection').execute({ id: childId });
  expect(works.resource.items[0].id).toBe(manifestId);
  const fetched = await tools.get('iiif_get_manifest').execute({ id: works.resource.items[0].id });
  expect(fetched.resource).toEqual(manifest);
  const matches = await tools
    .get('iiif_search_manifests')
    .execute({ query: '', collectionId: rootId });
  expect(matches.results.map((entry) => entry.resource.id)).toEqual([manifestId]);
  expect(catalog.coverage.complete).toBe(true);

  const childRecord = catalog.resources.find((entry) => entry.id === childId);
  const snapshot = JSON.parse(
    await fs.readFile(path.join(outDir, 'api/discovery', childRecord.snapshotUrl), 'utf8'),
  );
  expect(snapshot).toEqual(child);
  expect(snapshot.items[0].id).toBe(manifestAlias);
  expect(root.items[0].id).toBe(childAlias);
});

test('aliases resolve after all resources arrive and duplicate references retain collection order', () => {
  const report = createIngestionReport(config);
  const child = resource(childId, 'Collection');
  report.collection(
    child,
    [
      { id: manifestAlias, type: 'Manifest' },
      { id: manifestId, type: 'Manifest' },
      { id: 'https://iiif.example/second', type: 'Manifest' },
    ],
    true,
  );
  report.request(manifestAlias);
  report.request(manifestId);
  report.manifest(resource(manifestId, 'Manifest'), manifestAlias);
  const result = report.result();
  expect(result.entries[0].items.map((entry) => entry.id)).toEqual([
    manifestId,
    'https://iiif.example/second',
  ]);
  expect(result.requestedManifests).toEqual([manifestId]);
  expect(report.result()).toEqual(result);
});

test('webmcp: false keeps ingestion reports empty', () => {
  const report = createIngestionReport({ webmcp: false });
  report.request(manifestAlias);
  report.manifest(resource(manifestId, 'Manifest'), manifestAlias);
  report.collection(resource(rootId, 'Collection'), [], true, 'assets/root.json');
  report.failure('assets/missing.json');
  expect(report.result()).toEqual({ entries: [], roots: [], requestedManifests: [], failures: [] });
});
