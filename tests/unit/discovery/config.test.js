const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  webMcpEnabled,
  readWebMcpEnabled,
  webMcpScriptTag,
} = require('../../../packages/app/lib/discovery/config');

let directory;
let previousConfig;
beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'canopy-webmcp-config-'));
  previousConfig = process.env.CANOPY_CONFIG;
  process.env.CANOPY_CONFIG = path.join(directory, 'canopy.yml');
});
afterEach(() => {
  if (previousConfig === undefined) delete process.env.CANOPY_CONFIG;
  else process.env.CANOPY_CONFIG = previousConfig;
  fs.rmSync(directory, { recursive: true, force: true });
});

test.each([undefined, null, {}, { webmcp: true }, { webmcp: false }])(
  'resolves the root WebMCP option in %j',
  (config) => {
    expect(webMcpEnabled(config)).toBe(config?.webmcp !== false);
  },
);

test.each(['', '# No options\n', 'title: Example\n', 'webmcp: true\n', 'webmcp: TRUE\n'])(
  'registers tools when WebMCP is omitted or enabled in YAML: %j',
  (yaml) => {
    fs.writeFileSync(process.env.CANOPY_CONFIG, yaml);
    expect(readWebMcpEnabled()).toBe(true);
    expect(webMcpScriptTag((url) => `/exhibit${url}`)).toContain(
      'src="/exhibit/scripts/canopy-webmcp.js"',
    );
    expect(webMcpScriptTag((url) => `/exhibit${url}`)).toContain(
      'data-canopy-discovery="/exhibit/api/discovery/index.json"',
    );
  },
);

test('uses the default when no configuration file exists', () => {
  expect(readWebMcpEnabled()).toBe(true);
  expect(webMcpScriptTag((url) => url)).toContain('canopy-webmcp.js');
});

test('webmcp: false omits browser registration', () => {
  fs.writeFileSync(process.env.CANOPY_CONFIG, 'webmcp: false\n');
  expect(readWebMcpEnabled()).toBe(false);
  expect(webMcpScriptTag((url) => url)).toBe('');
});

test.each(['"false"', 'null', '0', '{ enabled: true }'])(
  'rejects a non-boolean setting instead of silently enabling tools: %s',
  (value) => {
    fs.writeFileSync(process.env.CANOPY_CONFIG, `webmcp: ${value}\n`);
    expect(readWebMcpEnabled).toThrow('webmcp must be true or false.');
  },
);

test('reports invalid YAML instead of silently enabling tools', () => {
  fs.writeFileSync(process.env.CANOPY_CONFIG, 'webmcp: [\n');
  expect(readWebMcpEnabled).toThrow();
});
