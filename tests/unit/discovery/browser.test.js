const { initializeWebMcp } = require('../../../packages/app/lib/discovery/browser');

const manifest = {
  '@context': 'http://iiif.io/api/presentation/3/context.json',
  id: 'https://provider.example/manifest/1',
  type: 'Manifest',
  label: { en: ['Herbarium'] },
  rights: 'https://creativecommons.org/publicdomain/zero/1.0/',
  items: [],
};
const catalog = {
  schemaVersion: '1.0',
  protocol: 'IIIF',
  datasetVersion: 'build-1',
  roots: [],
  resources: [
    {
      ...manifest,
      snapshotUrl: 'resources/1.json',
      citationUrl: '/canopy/works/herbarium.html',
      source: { uri: manifest.id },
    },
  ],
};
const toolNames = [
  'iiif_describe_site',
  'iiif_get_collection',
  'iiif_search_manifests',
  'iiif_get_manifest',
];
const states = [];

function browser({ supported = true, fetchJson } = {}) {
  const tools = new Map([['external_tool', { name: 'external_tool' }]]);
  const win = Object.assign(new EventTarget(), {
    location: { href: 'https://museum.example/canopy/works/herbarium.html' },
    AbortController,
    console: { warn: jest.fn() },
    fetch:
      fetchJson ||
      jest.fn(async (url) => ({
        ok: true,
        json: async () => (url.endsWith('index.json') ? catalog : manifest),
      })),
  });
  const modelContext = {
    registerTool: jest.fn(async (tool, { signal }) => {
      if (signal.aborted) throw new Error('Registration cancelled.');
      if (tools.has(tool.name)) throw new Error('Duplicate tool.');
      tools.set(tool.name, tool);
      signal.addEventListener('abort', () => tools.delete(tool.name), { once: true });
    }),
  };
  const doc = {
    baseURI: win.location.href,
    currentScript: { getAttribute: jest.fn(() => '../api/discovery/index.json') },
    ...(supported ? { modelContext } : {}),
  };
  return {
    doc,
    win,
    tools,
    modelContext,
    initialize() {
      const state = initializeWebMcp({ document: doc, window: win });
      if (state) states.push(state);
      return state;
    },
    event(type, persisted = false) {
      win.dispatchEvent(Object.assign(new Event(type), { persisted }));
    },
  };
}

afterEach(() => {
  states.splice(0).forEach((state) => state.dispose());
});

test('unsupported browsers do not register tools or load data', () => {
  const page = browser({ supported: false });
  expect(page.initialize()).toBeNull();
  expect(page.win.fetch).not.toHaveBeenCalled();
  expect(page.modelContext.registerTool).not.toHaveBeenCalled();
});

test('blocked modelContext access leaves the page unaffected', () => {
  const page = browser();
  Object.defineProperty(page.doc, 'modelContext', {
    get() {
      throw new Error('Permissions policy');
    },
  });
  expect(page.initialize()).toBeNull();
});

test('does not register without its own catalog attribute', () => {
  const page = browser();
  page.doc.currentScript.getAttribute.mockReturnValue(null);
  expect(page.initialize()).toBeNull();
  expect(page.modelContext.registerTool).not.toHaveBeenCalled();
});

test('registers IIIF schemas without loading data, then retrieves JSON directly', async () => {
  const page = browser();
  await expect(page.initialize().ready).resolves.toBe(true);
  expect([...page.tools.keys()].filter((name) => name !== 'external_tool').sort()).toEqual(
    toolNames.sort(),
  );
  expect(page.win.fetch).not.toHaveBeenCalled();
  const tool = page.tools.get('iiif_get_manifest');
  expect(tool.description).toContain('IIIF');
  expect(tool.inputSchema).toMatchObject({
    type: 'object',
    required: ['id'],
    additionalProperties: false,
  });
  expect(tool.annotations).toEqual({
    readOnlyHint: true,
    untrustedContentHint: true,
    consequentialHint: false,
  });
  const result = await tool.execute({ id: manifest.id });
  expect(result).toMatchObject({ protocol: 'IIIF', representation: 'full', resource: manifest });
  expect(result.snapshotUrl).toBe('https://museum.example/canopy/api/discovery/resources/1.json');
  expect(page.doc.currentScript.getAttribute).toHaveBeenCalledWith('data-canopy-discovery');
  expect(page.win.fetch.mock.calls.map(([url]) => url)).toEqual([
    'https://museum.example/canopy/api/discovery/index.json',
    'https://museum.example/canopy/api/discovery/resources/1.json',
  ]);
});

test('invalid arguments and unknown resource IDs never become request URLs', async () => {
  const page = browser();
  await page.initialize().ready;
  const tool = page.tools.get('iiif_get_manifest');
  await expect(
    tool.execute({ id: manifest.id, url: 'https://external.example' }),
  ).rejects.toThrow();
  expect(page.win.fetch).not.toHaveBeenCalled();
  await expect(tool.execute({ id: 'https://external.example/private' })).rejects.toThrow();
  expect(page.win.fetch).toHaveBeenCalledTimes(1);
});

test('duplicate initialization uses one registration, including after reloading the module', async () => {
  const page = browser();
  const first = page.initialize();
  await first.ready;
  jest.isolateModules(() => {
    const {
      initializeWebMcp: initializeAgain,
    } = require('../../../packages/app/lib/discovery/browser');
    expect(initializeAgain({ document: page.doc, window: page.win })).toBe(first);
  });
  expect(page.initialize()).toBe(first);
  expect(page.modelContext.registerTool).toHaveBeenCalledTimes(4);
});

test('pagehide cancels owned registrations; a bfcache restore registers fresh tools', async () => {
  const page = browser();
  const state = page.initialize();
  await state.ready;
  const oldTool = page.tools.get('iiif_describe_site');
  page.event('pagehide', true);
  expect([...page.tools.keys()]).toEqual(['external_tool']);
  await expect(oldTool.execute({})).rejects.toMatchObject({ name: 'AbortError' });
  page.event('pageshow', true);
  await expect(state.ready).resolves.toBe(true);
  expect(page.tools.get('iiif_describe_site')).not.toBe(oldTool);
  expect(page.modelContext.registerTool).toHaveBeenCalledTimes(8);
  state.dispose();
  page.event('pageshow', true);
  expect([...page.tools.keys()]).toEqual(['external_tool']);
  expect(page.modelContext.registerTool).toHaveBeenCalledTimes(8);
});

test('rejected registration promises roll back owned tools and report the error once', async () => {
  const page = browser();
  const register = page.modelContext.registerTool.getMockImplementation();
  page.modelContext.registerTool.mockImplementation((tool, options) =>
    tool.name === 'iiif_get_manifest'
      ? Promise.reject(new Error('Registration denied'))
      : register(tool, options),
  );
  await expect(page.initialize().ready).resolves.toBe(false);
  expect([...page.tools.keys()]).toEqual(['external_tool']);
  expect(page.win.console.warn).toHaveBeenCalledTimes(1);
});

test('a conflicting registration preserves the other owner’s tool', async () => {
  const page = browser();
  const external = { name: 'iiif_get_manifest' };
  page.tools.set(external.name, external);
  await expect(page.initialize().ready).resolves.toBe(false);
  expect(page.tools.get(external.name)).toBe(external);
  expect(page.tools.size).toBe(2);
});

test('a restore can finish while registrations from the previous page lifetime settle', async () => {
  const page = browser();
  const register = page.modelContext.registerTool.getMockImplementation();
  const waiting = [];
  page.modelContext.registerTool.mockImplementation((tool, options) =>
    new Promise((resolve) => {
      waiting.push(resolve);
    }).then(() => register(tool, options)),
  );
  const state = page.initialize();
  const firstReady = state.ready;
  await new Promise(setImmediate);
  page.event('pagehide', true);
  page.event('pageshow', true);
  await new Promise(setImmediate);
  waiting
    .splice(0)
    .reverse()
    .forEach((resolve) => resolve());
  await expect(state.ready).resolves.toBe(true);
  await expect(firstReady).resolves.toBe(false);
  expect(page.tools.size).toBe(5);
  expect(page.win.console.warn).not.toHaveBeenCalled();
});

test('a call cancelled before execution does not start loading data', async () => {
  const page = browser();
  await page.initialize().ready;
  const controller = new AbortController();
  const pending = page.tools.get('iiif_describe_site').execute({}, { signal: controller.signal });
  controller.abort();
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  expect(page.win.fetch).not.toHaveBeenCalled();
});

test('a cancelled call rejects while a later caller can use the shared data request', async () => {
  let finishFetch;
  const fetchJson = jest.fn(
    () =>
      new Promise((resolve) => {
        finishFetch = resolve;
      }),
  );
  const page = browser({ fetchJson });
  await page.initialize().ready;
  const tool = page.tools.get('iiif_describe_site');
  const controller = new AbortController();
  const pending = tool.execute({}, { signal: controller.signal });
  const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  await new Promise(setImmediate);
  controller.abort();
  await rejected;
  finishFetch({ ok: true, json: async () => catalog });
  await expect(tool.execute({})).resolves.toMatchObject({ protocol: 'IIIF' });
  expect(fetchJson).toHaveBeenCalledTimes(1);
});

test('catalog fetch failure is reported to the caller and a later call retries', async () => {
  const page = browser();
  page.win.fetch.mockRejectedValueOnce(new Error('Offline'));
  await page.initialize().ready;
  const tool = page.tools.get('iiif_describe_site');
  await expect(tool.execute({})).rejects.toThrow();
  await expect(tool.execute({})).resolves.toMatchObject({ protocol: 'IIIF' });
  expect(page.win.fetch).toHaveBeenCalledTimes(2);
});

test('the shipped browser IIFE registers and executes without React or page DOM access', async () => {
  const { buildSync } = require('esbuild');
  const { runInNewContext } = require('node:vm');
  const page = browser();
  const bundle = buildSync({
    entryPoints: [require.resolve('../../../packages/app/lib/discovery/browser')],
    bundle: true,
    format: 'iife',
    platform: 'browser',
    write: false,
  }).outputFiles[0].text;
  runInNewContext(bundle, {
    document: page.doc,
    window: page.win,
    URL,
    TextEncoder,
    AbortController,
  });
  const state = page.doc[Symbol.for('canopy.iiif.webmcp')];
  states.push(state);
  await expect(state.ready).resolves.toBe(true);
  const result = await page.tools.get('iiif_get_manifest').execute({ id: manifest.id });
  expect(result.resource).toEqual(manifest);
  expect(page.win.fetch).toHaveBeenCalledTimes(2);
});
