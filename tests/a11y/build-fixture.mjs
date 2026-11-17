// Builds the accessibility fixture once per template and appearance into
// tests/a11y/.site/<template>-<appearance> (see `TEMPLATES` in lib/sites.mjs). Each is
// that template as a new project gets it (its app shell, pages, styles and theme over
// the repository's works and search layouts), plus the fixture's pages of every
// Clover-backed component and of Markdown, over IIIF the site serves itself.
//
// Skipped when CANOPY_A11Y_SITE names a site you built yourself.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import yaml from 'js-yaml';
import { fixtureIiif } from './fixture/iiif.mjs';
import { writePng } from './lib/png.mjs';
import { serve } from './lib/serve.mjs';
import { HERE, IS_EXTERNAL, SITES, baseUrlFor } from './lib/sites.mjs';

const REPO = path.resolve(HERE, '../..');
// IIIF Content State 1.0: base64url of the URI-encoded JSON.
const encodeState = (state) => Buffer.from(encodeURIComponent(JSON.stringify(state))).toString('base64url');

function copy(from, to) {
  if (!fs.existsSync(from)) return;
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.cpSync(from, to, { recursive: true });
}

// The template's own `canopy.yml` decides its theme and locales; the fixture decides
// what it shows.
function canopyConfig(site, iiif) {
  // A template with no `canopy.yml` of its own ships the repository's (the default one).
  const own = [path.join(REPO, site.template.source, 'canopy.yml'), path.join(REPO, 'canopy.yml')]
    .filter((file) => fs.existsSync(file))
    .map((file) => yaml.load(fs.readFileSync(file, 'utf8')) || {})[0] || {};
  const theme = {
    accentColor: 'indigo',
    grayColor: 'slate',
    ...(own.theme || {}),
    appearance: site.appearance,
  };
  return yaml.dump({
    title: `Canopy accessibility fixture (${site.template.name})`,
    ...(own.locales ? { locales: own.locales } : {}),
    manifest: iiif.manifests,
    metadata: ['Subject', 'Date'],
    featured: iiif.featured,
    search: {
      page: { title: 'Search', description: 'Discover results across the entire collection.' },
      results: {
        work: { layout: 'grid', result: 'figure' },
        page: { layout: 'list', result: 'article' },
      },
      index: { metadata: { enabled: true, all: false }, summary: { enabled: true } },
    },
    webmcp: true,
    theme,
  });
}

function run(command, args, options) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { ...options, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', (chunk) => (output += chunk));
    child.stderr.on('data', (chunk) => (output += chunk));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve(output);
      else
        reject(
          new Error(`Build exited with ${code}:\n${output.split('\n').slice(-60).join('\n')}`),
        );
    });
  });
}

async function buildSite(site) {
  const base = baseUrlFor(site.port);
  const template = path.join(REPO, site.template.source);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `canopy-a11y-${site.name}-`));
  const started = Date.now();
  try {
    fs.symlinkSync(path.join(REPO, 'node_modules'), path.join(dir, 'node_modules'), 'dir');

    // What every template shares with the repository, as template preparation copies it.
    copy(path.join(REPO, 'app/styles'), path.join(dir, 'app/styles'));
    copy(path.join(REPO, 'content/works/_layout.mdx'), path.join(dir, 'content/works/_layout.mdx'));
    for (const name of ['_layout.mdx', '_result-article.mdx', '_result-figure.mdx']) {
      copy(path.join(REPO, 'content/search', name), path.join(dir, 'content/search', name));
    }
    copy(path.join(REPO, 'content/locale.yml'), path.join(dir, 'content/locale.yml'));
    copy(path.join(HERE, 'fixture/navigation.yml'), path.join(dir, 'content/navigation.yml'));

    // The template's own files, over those.
    copy(path.join(template, '_app.mdx'), path.join(dir, 'content/_app.mdx'));
    copy(path.join(template, 'content'), path.join(dir, 'content'));
    copy(path.join(template, 'app'), path.join(dir, 'app'));

    // The fixture's pages and IIIF.
    // `v1-imports.mdx` imports Canopy by its 1.x name, as 1.x sites' pages do.
    for (const name of ['components.mdx', 'prose.mdx', 'content-state.mdx', 'v1-imports.mdx']) {
      fs.writeFileSync(
        path.join(dir, 'content', name),
        fs.readFileSync(path.join(HERE, 'fixture', name), 'utf8').replaceAll('__BASE__', base)
          // The three forms of a content state Canopy's docs rely on (`share-content.mdx`).
          .replaceAll('__CS_MANIFEST__', encodeState({ id: `${base}/iiif/m1.json`, type: 'Manifest' }))
          .replaceAll('__CS_TARGET__', encodeState({
            id: `${base}/iiif/m1/canvas/2`,
            type: 'Canvas',
            partOf: [{ id: `${base}/iiif/m1.json`, type: 'Manifest' }],
          }))
          .replaceAll('__CS_CANVAS__', encodeState({
            '@context': 'http://iiif.io/api/presentation/3/context.json',
            type: 'Annotation',
            motivation: ['contentState'],
            target: { id: `${base}/iiif/m1/canvas/2`, type: 'Canvas', partOf: [{ id: `${base}/iiif/m1.json`, type: 'Manifest' }] },
          })),
      );
    }
    const iiif = fixtureIiif(base);
    for (const [rel, json] of Object.entries(iiif.files)) {
      const target = path.join(dir, 'assets', rel);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, `${JSON.stringify(json, null, 2)}\n`);
    }
    for (const image of iiif.images) {
      const target = path.join(dir, 'assets', image.path);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      writePng(target, image.width, image.height, image.paint);
    }
    fs.writeFileSync(path.join(dir, 'canopy.yml'), canopyConfig(site, iiif));

    // Featured Manifests are read by URL, so the fixture's IIIF is served at its base
    // while the site builds.
    const server = await serve(path.join(dir, 'assets'), site.port);
    try {
      await run(process.execPath, [path.join(REPO, 'packages/app/lib/build/build.js')], {
        cwd: dir,
        env: {
          ...process.env,
          INIT_CWD: dir,
          CANOPY_CONFIG: path.join(dir, 'canopy.yml'),
          CANOPY_BASE_URL: base,
          NODE_PATH: path.join(REPO, 'node_modules'),
        },
      });
    } finally {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    }

    fs.rmSync(site.dir, { recursive: true, force: true });
    copy(path.join(dir, 'site'), site.dir);
    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    console.log(`[a11y] Built ${site.name} in ${seconds}s → ${path.relative(REPO, site.dir)}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

if (IS_EXTERNAL) {
  console.log(`[a11y] Checking the site at ${SITES[0].dir}; the fixture is not built.`);
} else {
  if (!fs.existsSync(path.join(REPO, 'packages/app/ui/dist/server.mjs'))) {
    throw new Error('[a11y] Build the UI first: npm -w @nulib/canopy run ui:build');
  }
  fs.rmSync(path.join(HERE, '.site'), { recursive: true, force: true });
  await Promise.all(SITES.map((site) => buildSite(site)));
}
