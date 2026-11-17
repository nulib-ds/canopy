// What the templates get (`packages/helpers/template/prepare-template.js`) and how the
// release publishes them (`.github/workflows/release-and-template.yml`), since 2.0: the
// published @nulib/canopy, its `canopy` command, Node from `.nvmrc`, and no template
// pushed for a prerelease.

const fs = require('fs');
const path = require('path');
const {templatePackageJson} = require('../../../packages/helpers/template/prepare-template');

const REPO = path.resolve(__dirname, '../../..');
const read = (rel) => fs.readFileSync(path.join(REPO, rel), 'utf8');
const root = JSON.parse(read('package.json'));

test('a template depends on @nulib/canopy, React and React DOM, and runs the canopy command', () => {
  const pkg = templatePackageJson(root, '2.0.0');
  expect(pkg.dependencies).toEqual({
    '@nulib/canopy': '^2.0.0',
    react: root.devDependencies.react,
    'react-dom': root.devDependencies['react-dom'],
  });
  expect(pkg.scripts).toEqual({build: 'canopy build', dev: 'canopy dev'});
  for (const key of ['devDependencies', 'workspaces', 'optionalDependencies', 'main']) {
    expect([key, pkg[key]]).toEqual([key, undefined]);
  }
  expect(pkg.private).toBe(true);
  expect(pkg.engines).toEqual(root.engines);
});

test('a preview names a packed tarball, and no version means any', () => {
  expect(templatePackageJson(root, '', 'file:/tmp/nulib-canopy-2.0.0.tgz').dependencies['@nulib/canopy']).toBe(
    'file:/tmp/nulib-canopy-2.0.0.tgz',
  );
  expect(templatePackageJson(root, '').dependencies['@nulib/canopy']).toBe('*');
});

test('the templates’ files name @nulib/canopy, and nothing of tsx or the old build script', () => {
  for (const rel of [
    'app/styles/index.css',
    'content/_app.mdx',
    'content/works/_layout.mdx',
    'content/search/_result-article.mdx',
    'content/search/_result-figure.mdx',
    'packages/helpers/template/_app.mdx',
    'packages/helpers/template-i18n/_app.mdx',
    'packages/helpers/template-northwestern/_app.mdx',
    'packages/helpers/template-northwestern/app/styles/index.css',
  ]) {
    const text = read(rel);
    expect([rel, /@nulib\/canopy/.test(text), /@canopy-iiif\/app/.test(text)]).toEqual([rel, true, false]);
  }
  expect(fs.existsSync(path.join(REPO, 'app/scripts'))).toBe(false);
  // No tsx of the site's own: the package brings it (`lib/cli.js`).
  expect(JSON.stringify(templatePackageJson(root, '2.0.0'))).not.toMatch(/\btsx\b|canopy-build/);
});

test('the templates’ workflows take Node from .nvmrc, and update @nulib/canopy', () => {
  expect(read('.nvmrc').trim()).toBe('24');
  for (const rel of [
    'packages/helpers/template/deploy-pages.yml',
    'packages/helpers/template/update-canopy-app.yml',
    '.github/workflows/deploy-pages.yml',
    '.github/workflows/release-and-template.yml',
  ]) {
    const text = read(rel);
    expect([rel, /node-version:/.test(text)]).toEqual([rel, false]);
    expect([rel, /node-version-file: "\.nvmrc"/.test(text)]).toEqual([rel, true]);
  }
  expect(read('packages/helpers/template/update-canopy-app.yml')).toMatch(
    /npm install --no-audit --no-fund @nulib\/canopy@"\$\{APP_TARGET\}"/,
  );
});

test('a prerelease is one on GitHub, and leaves the templates as they are', () => {
  const workflow = read('.github/workflows/release-and-template.yml');
  expect((workflow.match(/prerelease: version\.includes\("-"\)/g) || []).length).toBe(2);
  const templateJobs = workflow.match(/^ {2}template[a-z0-9-]*:\n(?: {4}.*\n)+/gm) || [];
  expect(templateJobs).toHaveLength(3);
  for (const job of templateJobs) {
    expect(job).toMatch(/!contains\(needs\.release\.outputs\.releaseVersion, '-'\)/);
  }
  expect(workflow).not.toMatch(/npm view @canopy-iiif\/app/);
  expect((workflow.match(/APP_VERSION: \$\{\{ needs\.release\.outputs\.releaseVersion \}\}/g) || []).length).toBe(3);
});

test('both packages release together, and a release with no notes still gets its templates', () => {
  // What a release is, not where the next one stands: `.changeset/` files come and go.
  const config = JSON.parse(read('.changeset/config.json'));
  expect(config.fixed).toEqual([['@nulib/canopy', '@canopy-iiif/app']]);
  const workflow = read('.github/workflows/release-and-template.yml');
  expect(workflow).toMatch(/if ! NOTES=\$\(node packages\/helpers\/release-notes-from-docs\.js/);
  expect(workflow).toMatch(/NOTES='\{\}'/);
});

test('the release publishes to npm by trusted publishing, with no token', () => {
  // CONTRIBUTING.md, "Publishing to npm": each package names this workflow on npmjs.com.
  const yaml = require('js-yaml');
  const text = read('.github/workflows/release-and-template.yml');
  const workflow = yaml.load(text);
  expect(workflow.permissions).toEqual({contents: 'write'});
  expect(workflow.jobs.release.permissions).toEqual({contents: 'write', 'id-token': 'write'});
  // Only the job that publishes gets an identity to publish with.
  for (const [name, job] of Object.entries(workflow.jobs)) {
    if (name === 'release') continue;
    expect([name, job.permissions]).toEqual([name, undefined]);
  }
  const setupNode = workflow.jobs.release.steps.find((step) =>
    String(step.uses || '').startsWith('actions/setup-node'),
  );
  expect(setupNode.with['registry-url']).toBe('https://registry.npmjs.org');
  expect(text).not.toMatch(/NPM_TOKEN|NODE_AUTH_TOKEN|always-auth/);
});
