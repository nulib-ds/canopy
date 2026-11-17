// Canopy's text is a closed set of styles (packages/app/ui/styles/settings/_type.scss;
// DESIGN.md §1, "Type"): every size, weight and tracking comes from the scale in
// `settings/_tokens.scss`, through a style, so the pages read as one. This holds the UI's
// stylesheets to it: a size, weight or tracking written by hand, or uppercase outside the
// label style, fails here.

const fs = require('node:fs');
const path = require('node:path');

const STYLES = path.resolve(__dirname, '../../../packages/app/ui/styles');
// Where the scale and the styles are defined.
const DEFINITIONS = new Set(['settings/_tokens.scss', 'settings/_type.scss']);

function sources(dir, found = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) sources(full, found);
    else if (/\.scss$/.test(entry.name) || entry.name === 'version-parity.css') found.push(full);
  }
  return found;
}

const ALLOWED = {
  'font-size': /^(var\(--canopy-text-[a-z0-9-]+\)|var\(--storiiies-[a-z-]+\)|inherit)$/,
  'font-weight': /^(var\(--canopy-weight-(regular|bold)\)|inherit)$/,
  'letter-spacing': /^(var\(--canopy-tracking-[a-z]+\)|normal|inherit)$/,
};

function strays() {
  const found = [];
  for (const file of sources(STYLES)) {
    const rel = path.relative(STYLES, file).split(path.sep).join('/');
    if (DEFINITIONS.has(rel)) continue;
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, index) => {
      const text = line.replace(/\/\/.*$/, '');
      for (const [property, allowed] of Object.entries(ALLOWED)) {
        const match = text.match(new RegExp(`(?:^|[\\s;{])${property}:\\s*([^;]+);`));
        if (match && !allowed.test(match[1].trim())) {
          found.push(`${rel}:${index + 1} ${property}: ${match[1].trim()}`);
        }
      }
      if (/text-transform:\s*uppercase/.test(text)) {
        found.push(`${rel}:${index + 1} text-transform: uppercase (take the label style)`);
      }
    });
  }
  return found;
}

test('every size, weight and tracking comes from the type scale', () => {
  expect(strays()).toEqual([]);
});

test('the scale has two weights and the styles the Style guide names', () => {
  const tokens = fs.readFileSync(path.join(STYLES, 'settings/_tokens.scss'), 'utf8');
  const weights = [...tokens.matchAll(/--canopy-weight-([a-z]+):/g)].map((m) => m[1]);
  expect(weights).toEqual(['regular', 'bold']);
  const type = fs.readFileSync(path.join(STYLES, 'settings/_type.scss'), 'utf8');
  const styles = [...type.matchAll(/^@mixin ([a-z][a-z0-9-]*)/gm)].map((m) => m[1]);
  expect(styles).toEqual([
    'display',
    'title',
    'h2',
    'h3',
    'h4',
    'lede',
    'body',
    'ui',
    'ui-sm',
    'label',
    'code',
  ]);
  // Each is a class for authors, and the docs' Style guide shows each.
  const classes = fs.readFileSync(path.join(STYLES, 'base/_type.scss'), 'utf8');
  const guide = fs.readFileSync(
    path.resolve(__dirname, '../../../content/docs/theme/style-guide.mdx'),
    'utf8',
  );
  for (const style of styles) {
    expect([style, classes.includes(`.canopy-type-${style} {`)]).toEqual([style, true]);
    expect([style, guide.includes(`canopy-type-${style}`)]).toEqual([style, true]);
  }
});
