const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const run = promisify(execFile);
const repository = path.resolve(__dirname, '../../..');
let directory;
afterEach(async () => {
  if (directory) await fs.rm(directory, { recursive: true, force: true });
});

test('builds WebMCP by default, preserves explicit enablement and cleans disabled exports', async () => {
  directory = await fs.mkdtemp(path.join(os.tmpdir(), 'canopy-discovery-build-'));
  await fs.symlink(
    path.join(repository, 'node_modules'),
    path.join(directory, 'node_modules'),
    'dir',
  );
  await fs.mkdir(path.join(directory, 'content/works'), { recursive: true });
  await fs.mkdir(path.join(directory, 'content/search'), { recursive: true });
  await fs.writeFile(path.join(directory, 'content/_app.mdx'), '<main>{props.children}</main>');
  await fs.writeFile(path.join(directory, 'content/search/_layout.mdx'), '# Search');
  await fs.writeFile(path.join(directory, 'content/index.mdx'), '# IIIF test site');
  await fs.writeFile(
    path.join(directory, 'content/works/_layout.mdx'),
    '<h1>{props.manifest.label.en[0]}</h1>',
  );
  const config =
    'title: Discovery test\ncollection:\n  - https://iiif.example/collection\n  - https://iiif.example/child\nsite:\n  baseUrl: https://site.example/sub\n';
  await fs.writeFile(path.join(directory, 'canopy.yml'), config);
  const fixtures = {
    'https://iiif.example/collection': {
      '@context': 'http://iiif.io/api/presentation/2/context.json',
      '@id': 'https://iiif.example/collection',
      '@type': 'sc:Collection',
      label: 'Books',
      collections: [
        { '@id': 'https://iiif.example/child', '@type': 'sc:Collection', label: 'Child' },
      ],
    },
    'https://iiif.example/child': {
      '@context': 'http://iiif.io/api/presentation/3/context.json',
      id: 'https://iiif.example/canonical-child',
      type: 'Collection',
      label: { en: ['Child'] },
      items: [{ id: 'https://iiif.example/book', type: 'Manifest', label: { en: ['Book'] } }],
    },
    'https://iiif.example/book': {
      '@context': 'http://iiif.io/api/presentation/3/context.json',
      id: 'https://iiif.example/canonical-book',
      type: 'Manifest',
      label: { en: ['Book'] },
      items: [],
      requiredStatement: { label: { en: ['Attribution'] }, value: { en: ['Library'] } },
    },
  };
  const script = `
    const fs = require('node:fs/promises');
    const fixtures = ${JSON.stringify(fixtures)};
    global.fetch = async (uri) => new Response(JSON.stringify(fixtures[String(uri)] || {}), {status: fixtures[String(uri)] ? 200 : 404});
    const {build} = require(${JSON.stringify(path.join(repository, 'packages/app/lib/build/build.js'))});
    (async () => {
      await build();
      const catalog = JSON.parse(await fs.readFile('site/api/discovery/index.json', 'utf8'));
      await fs.writeFile('catalog-first.json', JSON.stringify(catalog));
      await fs.cp('site', 'default-site', {recursive: true});
      await fs.writeFile('canopy.yml', ${JSON.stringify(config + 'webmcp: true\n')});
      await build({skipIiif: true});
      const warm = JSON.parse(await fs.readFile('site/api/discovery/index.json', 'utf8'));
      await fs.writeFile('catalog-warm.json', JSON.stringify(warm));
      delete require.cache[require.resolve(${JSON.stringify(path.join(repository, 'packages/app/lib/build/build.js'))})];
      const coldBuild = require(${JSON.stringify(path.join(repository, 'packages/app/lib/build/build.js'))}).build;
      await coldBuild({skipIiif: true});
      await fs.copyFile('site/api/discovery/index.json', 'catalog-cold.json');
      await fs.cp('site', 'enabled-site', {recursive: true});
      await fs.writeFile('canopy.yml', ${JSON.stringify(config + 'webmcp: false\n')});
      await coldBuild({skipIiif: true});
    })().catch(error => { console.error(error); process.exitCode = 1; });
  `;
  const output = await run(process.execPath, ['-e', script], {
    cwd: directory,
    env: {
      ...process.env,
      INIT_CWD: directory,
      CANOPY_CONFIG: path.join(directory, 'canopy.yml'),
      CANOPY_SKIP_STYLES: '1',
      CANOPY_BASE_PATH: '/sub',
      NODE_PATH: path.join(repository, 'node_modules'),
    },
    timeout: 120000,
    maxBuffer: 5 * 1024 * 1024,
  });
  if (output.stdout.includes('IIIF: failed to render')) {
    throw new Error(
      'The IIIF build fixture could not render its work page.\n' +
        output.stdout +
        '\n' +
        output.stderr,
    );
  }
  const catalog = JSON.parse(await fs.readFile(path.join(directory, 'catalog-first.json'), 'utf8'));
  const warm = JSON.parse(await fs.readFile(path.join(directory, 'catalog-warm.json'), 'utf8'));
  const cold = JSON.parse(await fs.readFile(path.join(directory, 'catalog-cold.json'), 'utf8'));
  expect(catalog.coverage).toMatchObject({ collections: 2, manifests: 1, complete: true });
  expect(catalog.roots).toEqual([
    'https://iiif.example/collection',
    'https://iiif.example/canonical-child',
  ]);
  const root = catalog.resources.find((r) => r.id === 'https://iiif.example/collection');
  const child = catalog.resources.find((r) => r.id === 'https://iiif.example/canonical-child');
  const work = catalog.resources.find((r) => r.type === 'Manifest');
  expect(root.items[0].id).toBe(child.id);
  expect(child.items[0].id).toBe(work.id);
  expect(work.collectionIds).toEqual([child.id, root.id]);
  expect(work.citationUrl).toMatch(/^https:\/\/site\.example\/sub\/works\/book(?:-\d+)?\.html$/);
  expect(root.source).toMatchObject({
    presentationVersion: '2.1',
    transformation: 'presentation-2-to-3',
  });
  expect(warm.datasetVersion).toBe(catalog.datasetVersion);
  expect(cold).toEqual(warm);
  const workPage = new URL(work.citationUrl).pathname.replace('/sub/', '');
  for (const site of ['default-site', 'enabled-site']) {
    for (const page of ['index.html', 'search/index.html', workPage]) {
      const html = await fs.readFile(path.join(directory, site, page), 'utf8').catch((error) => {
        throw new Error(error.message + '\n' + output.stdout + '\n' + output.stderr);
      });
      expect(html).toContain('src="/sub/scripts/canopy-webmcp.js"');
      expect(html).toContain('data-canopy-discovery="/sub/api/discovery/index.json"');
    }
  }
  const bundle = await fs.readFile(
    path.join(directory, 'enabled-site/scripts/canopy-webmcp.js'),
    'utf8',
  );
  expect(bundle).toContain('iiif_get_manifest');
  expect(bundle).not.toContain('react-dom');
  await expect(fs.stat(path.join(directory, 'site/api/discovery'))).rejects.toThrow();
  await expect(fs.stat(path.join(directory, 'site/scripts/canopy-webmcp.js'))).rejects.toThrow();
  expect(await fs.readFile(path.join(directory, 'site/index.html'), 'utf8')).not.toContain(
    'data-canopy-discovery',
  );
}, 130000);
