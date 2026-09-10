const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const run = promisify(execFile);
const repository = path.resolve(__dirname, '../../..');
let directory;

beforeEach(async () => {
  directory = await fs.mkdtemp(path.join(os.tmpdir(), 'canopy-runtime-build-'));
  await fs.symlink(
    path.join(repository, 'node_modules'),
    path.join(directory, 'node_modules'),
    'dir',
  );
  await fs.mkdir(path.join(directory, 'app/components'), { recursive: true });
  await fs.mkdir(path.join(directory, 'content/search'), { recursive: true });
  await fs.writeFile(path.join(directory, 'canopy.yml'), 'title: Runtime test\nwebmcp: false\n');
  await fs.writeFile(path.join(directory, 'content/_app.mdx'), '<main>{props.children}</main>');
  await fs.writeFile(path.join(directory, 'content/search/_layout.mdx'), '# Search');
  await fs.writeFile(
    path.join(directory, 'content/index.mdx'),
    '# Runtime test\n\n<CustomViewer />',
  );
  await fs.writeFile(
    path.join(directory, 'app/components/mdx.js'),
    "export const clientComponents = { CustomViewer: './viewer.client.tsx' };",
  );
});

afterEach(async () => {
  if (directory) await fs.rm(directory, { recursive: true, force: true });
});

function buildFixture() {
  return run(process.execPath, [path.join(repository, 'packages/app/lib/build/build.js')], {
    cwd: directory,
    env: {
      ...process.env,
      INIT_CWD: directory,
      CANOPY_CONFIG: path.join(directory, 'canopy.yml'),
      CANOPY_SKIP_IIIF: '1',
      CANOPY_SKIP_STYLES: '1',
      NODE_PATH: path.join(repository, 'node_modules'),
    },
    timeout: 120000,
    maxBuffer: 5 * 1024 * 1024,
  });
}

test('builds Clover hydration and custom TSX with native BigInt', async () => {
  await fs.writeFile(
    path.join(directory, 'app/components/viewer.client.tsx'),
    `import React from 'react';
     import Viewer from '@samvera/clover-iiif/viewer';
     export default function CustomViewer({ tileId = '9007199254740993' }) {
       const nextId = BigInt(tileId) + 1n;
       return <div data-tile-id={String(nextId)}><Viewer iiifContent="https://example.org/manifest" /></div>;
     }`,
  );
  const output = await buildFixture();
  expect(output.stderr).not.toContain('failed to build custom client runtime');
  for (const name of ['viewer', 'slider', 'image-story', 'custom-components']) {
    const bundle = await fs.readFile(
      path.join(directory, `site/scripts/canopy-${name}.js`),
      'utf8',
    );
    expect(bundle.length).toBeGreaterThan(0);
    if (name === 'custom-components') expect(bundle).toContain('1n');
  }
  const html = await fs.readFile(path.join(directory, 'site/index.html'), 'utf8');
  expect(html).toContain('data-canopy-client-component="CustomViewer"');
  expect(html).toContain('canopy-custom-components.js');
}, 130000);

test('exits nonzero when a custom runtime cannot bundle, even after page rendering catches it', async () => {
  await fs.writeFile(
    path.join(directory, 'app/components/viewer.client.tsx'),
    "import Missing from './missing-dependency'; export default Missing;",
  );
  await expect(buildFixture()).rejects.toMatchObject({
    code: 1,
    stderr: expect.stringContaining('Custom client component runtime failed to build'),
  });
}, 130000);
