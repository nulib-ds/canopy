// Which built sites the browser checks run against, and the pages in each.
//
// By default: the fixture, built once per template and appearance
// (`build-fixture.mjs`): the default template in light, dark and auto (checked under a
// dark system), and the i18n and Northwestern templates in light. With CANOPY_A11Y_SITE=<dir>: any site you built,
// such as this repository's `site/`.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const HERE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const RESULTS = path.join(HERE, '.results');
export const FIXTURE_SITES = path.join(HERE, '.site');

export const TEMPLATES = [
  { name: 'template', source: 'packages/helpers/template', appearances: ['light', 'dark', 'auto'] },
  { name: 'i18n', source: 'packages/helpers/template-i18n', appearances: ['light'] },
  {
    name: 'northwestern',
    source: 'packages/helpers/template-northwestern',
    appearances: ['light'],
  },
];

const external = process.env.CANOPY_A11Y_SITE
  ? path.resolve(process.cwd(), process.env.CANOPY_A11Y_SITE)
  : '';

export const IS_EXTERNAL = Boolean(external);
// Report what is found without failing: for a first look at a site.
export const REPORT_ONLY = process.env.CANOPY_A11Y_REPORT === '1';

export const SITES = external
  ? [{ name: 'site', dir: external, port: 4329, appearance: 'light' }]
  : TEMPLATES.flatMap((template) =>
      template.appearances.map((appearance) => ({ template, appearance })),
    ).map(({ template, appearance }, index) => ({
      name: `${template.name}-${appearance}`,
      template,
      appearance,
      dir: path.join(FIXTURE_SITES, `${template.name}-${appearance}`),
      port: 4317 + index,
    }));

export function baseUrlFor(port) {
  return `http://127.0.0.1:${port}`;
}

function walk(dir, found = []) {
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (_) {
    return found;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, found);
    else if (entry.name.endsWith('.html')) found.push(full);
  }
  return found;
}

// Every HTML page in a built site, as a URL path. Fragments without an <html>
// element (search result templates) are left out.
export function pagesIn(dir) {
  const filter = process.env.CANOPY_A11Y_PAGES ? new RegExp(process.env.CANOPY_A11Y_PAGES) : null;
  return walk(dir)
    .filter((file) => /<html[\s>]/i.test(fs.readFileSync(file, 'utf8').slice(0, 4096)))
    .map((file) => {
      const rel = path.relative(dir, file).split(path.sep).join('/');
      if (rel === 'index.html') return '/';
      if (rel.endsWith('/index.html')) return `/${rel.slice(0, -'index.html'.length)}`;
      return `/${rel}`;
    })
    .filter((page) => !filter || filter.test(page))
    .sort();
}

// The pages a keyboard walk visits: all of a fixture's, or on another site the
// first of each kind (home, docs, works, search, and the rest by top folder).
function keyboardPagesIn(dir) {
  const pages = pagesIn(dir);
  if (!IS_EXTERNAL || process.env.CANOPY_A11Y_PAGES) return pages;
  const seen = new Set();
  return pages.filter((page) => {
    const kind = page === '/' ? '/' : page.split('/')[1];
    if (seen.has(kind)) return false;
    seen.add(kind);
    return true;
  });
}

const pagesBySite = new Map(SITES.map((site) => [site.name, new Set(pagesIn(site.dir))]));
const keyboardBySite = new Map(
  SITES.map((site) => [site.name, new Set(keyboardPagesIn(site.dir))]),
);

// Tests are generated for every page any site has; each project skips the pages its
// own site does not have.
export const PAGES = [...new Set([...pagesBySite.values()].flatMap((pages) => [...pages]))].sort();
export const KEYBOARD_PAGES = [
  ...new Set([...keyboardBySite.values()].flatMap((pages) => [...pages])),
].sort();

export function hasPage(project, pagePath) {
  return Boolean(pagesBySite.get(project) && pagesBySite.get(project).has(pagePath));
}

export function hasKeyboardPage(project, pagePath) {
  return Boolean(keyboardBySite.get(project) && keyboardBySite.get(project).has(pagePath));
}
