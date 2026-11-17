// Notes for a site made before 2.0, said once when it builds: what it carries from 1.x
// that 2.x does without, and the package's new name. Each is a suggestion; the site
// builds as it is (the MDX API is a contract, AGENTS.md).

'use strict';

const fs = require('fs');
const path = require('path');
const {PACKAGE_NAME, LEGACY_NAMES} = require('./package-names');

// What 1.x sites installed for Canopy and 2.x does without.
const LEFT_OVER = [
  {name: '@samvera/clover-iiif', label: 'Clover 3', why: 'Canopy 2 brings Clover 4 itself'},
  {name: 'embla-carousel', label: '', why: 'the hero’s carousel no longer uses it'},
];
const GUIDE = 'https://nulib-ds.github.io/canopy/docs/developers/upgrading.html';
const COMPONENT_EXTENSIONS = new Set(['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.mts', '.cts']);

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (_) {
    return null;
  }
}

// The site's own components that import a package, as paths from the site's root.
function filesImporting(root, name) {
  const found = [];
  const pattern = new RegExp(`['"]${name.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}(?:/[^'"]*)?['"]`);
  const stack = [path.join(root, 'app', 'components')];
  while (stack.length) {
    const dir = stack.pop();
    let entries = [];
    try {
      entries = fs.readdirSync(dir, {withFileTypes: true});
    } catch (_) {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules') stack.push(full);
      } else if (COMPONENT_EXTENSIONS.has(path.extname(entry.name))) {
        try {
          if (pattern.test(fs.readFileSync(full, 'utf8'))) {
            found.push(path.relative(root, full).split(path.sep).join('/'));
          }
        } catch (_) {}
      }
    }
  }
  return found.sort();
}

function upgradeNotices(root = process.cwd()) {
  const pkg = readJson(path.join(root, 'package.json'));
  if (!pkg || typeof pkg !== 'object') return [];
  const deps = {...(pkg.devDependencies || {}), ...(pkg.dependencies || {})};
  const notes = [];

  const legacy = LEGACY_NAMES.find((name) => deps[name]);
  if (legacy && !deps[PACKAGE_NAME]) {
    notes.push(
      `Canopy is published as ${PACKAGE_NAME} since 2.0. ${legacy} passes through to it and keeps ` +
        `working; to switch, name ${PACKAGE_NAME} in package.json and app/styles/index.css. ${GUIDE}`,
    );
  }

  for (const {name, label, why} of LEFT_OVER) {
    if (!deps[name]) continue;
    const named = label ? `${name} (${label})` : name;
    const users = filesImporting(root, name);
    notes.push(
      users.length
        ? `${users.join(', ')} import${users.length === 1 ? 's' : ''} ${named}, which Canopy 2 no ` +
            'longer uses. It keeps working while it stays in package.json.'
        : `${named} is in package.json and nothing imports it: ${why}, so it can be removed.`,
    );
  }

  const throughTsx = Object.entries(pkg.scripts || {})
    .filter(([, command]) => /\btsx\b[^&|;]*canopy-build/.test(String(command)))
    .map(([script]) => script);
  if (throughTsx.length) {
    notes.push(
      `package.json runs Canopy through tsx (${throughTsx.join(', ')}). "canopy build" and ` +
        '"canopy dev" do the same without it; tsx and app/scripts/canopy-build.mts can then go.',
    );
  }

  return notes;
}

// Once a process, even when `npm run dev` reloads this module after a change under lib/.
function printUpgradeNotices(root = process.cwd()) {
  if (globalThis.__CANOPY_UPGRADE_NOTICES__) return;
  globalThis.__CANOPY_UPGRADE_NOTICES__ = true;
  for (const note of upgradeNotices(root)) console.warn(`[canopy] ${note}`);
}

// A search layout of the site's own, such as the one a 1.x template gave it, may render
// the search page with no `h1`, and so its results with no heading above them (1.3.1;
// the default layout opens with one since 2.0). Read from the page the layout renders.
function searchHeadingNotice(body) {
  if (typeof body !== 'string' || /<h1[\s>]/i.test(body)) return null;
  return (
    'content/search/_layout.mdx gives the search page no h1, so its results have no ' +
    'heading above them. Open it with one, such as <h1>{props.page?.title || "Search"}</h1>: ' +
    'https://nulib-ds.github.io/canopy/docs/content/search.html'
  );
}

function printSearchHeadingNotice(body) {
  const note = searchHeadingNotice(body);
  if (!note || globalThis.__CANOPY_SEARCH_HEADING_NOTICE__) return;
  globalThis.__CANOPY_SEARCH_HEADING_NOTICE__ = true;
  console.warn(`[canopy] ${note}`);
}

module.exports = {upgradeNotices, printUpgradeNotices, searchHeadingNotice, printSearchHeadingNotice};
