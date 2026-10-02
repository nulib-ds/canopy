const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  buildVariablesMap,
  loadCanopyTheme,
  toTailwindScale,
  variablesToCss,
} = require('../../../packages/app/ui/theme');

const CLOVER_COLOR_MAP = {
  '--clover-color-accent': 'var(--color-accent-default)',
  '--clover-color-accent-alt': 'var(--color-accent-900)',
  '--clover-color-primary': 'var(--color-gray-default)',
  '--clover-color-primary-alt': 'var(--color-gray-900)',
  '--clover-color-primary-muted': 'var(--color-gray-muted)',
  '--clover-color-secondary': 'var(--color-gray-50)',
  '--clover-color-secondary-alt': 'var(--color-gray-400)',
  '--clover-color-secondary-muted': 'var(--color-gray-300)',
};

function scales(appearance = 'light') {
  return [toTailwindScale('plum', { appearance }), toTailwindScale('sand', { appearance })];
}

function resolve(vars, value) {
  const match = /^var\((--[\w-]+)\)$/.exec(value);
  return match ? resolve(vars, vars[match[1]]) : value;
}

function luminance(hex) {
  const [r, g, b] = hex
    .replace('#', '')
    .match(/../g)
    .map((part) => parseInt(part, 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

test('maps Clover color tokens onto Canopy tokens', () => {
  const vars = buildVariablesMap(...scales());
  for (const [prop, value] of Object.entries(CLOVER_COLOR_MAP)) {
    expect(vars[prop]).toBe(value);
    expect(vars[prop]).not.toMatch(/!important/);
  }
});

test('every Clover reference resolves to a theme value', () => {
  const [brand, gray] = scales();
  const vars = buildVariablesMap(brand, gray);
  expect(resolve(vars, vars['--clover-color-accent'])).toBe(brand['800']);
  expect(resolve(vars, vars['--clover-color-accent-alt'])).toBe(brand['900']);
  expect(resolve(vars, vars['--clover-color-primary'])).toBe(gray['900']);
  expect(resolve(vars, vars['--clover-color-primary-muted'])).toBe(gray['800']);
  expect(resolve(vars, vars['--clover-color-secondary'])).toBe(gray['50']);
  for (const prop of Object.keys(CLOVER_COLOR_MAP)) {
    expect(resolve(vars, vars[prop])).toMatch(/^#[0-9a-f]{6}$/i);
  }
});

test.each([
  ['light', (surface, text) => surface > text],
  ['dark', (surface, text) => surface < text],
])('keeps Clover surfaces and text contrasting in %s mode', (appearance, ok) => {
  const vars = buildVariablesMap(...scales(appearance), { appearance });
  const surface = luminance(resolve(vars, vars['--clover-color-secondary']));
  const text = luminance(resolve(vars, vars['--clover-color-primary']));
  expect(ok(surface, text)).toBe(true);
  expect(vars['color-scheme']).toBe(appearance);
});

test('keeps legacy Clover variables for Stitches-based releases', () => {
  const [brand, gray] = scales();
  const vars = buildVariablesMap(brand, gray);
  expect(vars['--colors-accent']).toBe(`${brand['800']} !important`);
  expect(vars['--colors-primary']).toBe(`${gray['900']} !important`);
  expect(vars['--colors-secondary']).toBe(`${gray['50']} !important`);
});

test('emits Clover tokens only for the scales that are present', () => {
  const [brand, gray] = scales();
  const accentOnly = buildVariablesMap(brand, null);
  expect(accentOnly['--clover-color-accent']).toBeDefined();
  expect(accentOnly['--clover-color-primary']).toBeUndefined();
  expect(accentOnly['--colors-accent']).toBeUndefined();

  const grayOnly = buildVariablesMap(null, gray);
  expect(grayOnly['--clover-color-accent']).toBeUndefined();
  expect(grayOnly['--clover-color-secondary']).toBeDefined();

  expect(buildVariablesMap(null, null)).toEqual({ 'color-scheme': 'light' });
});

test('writes Clover tokens into the generated theme CSS', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'canopy-theme-'));
  try {
    const configPath = path.join(directory, 'canopy.yml');
    fs.writeFileSync(configPath, 'theme:\n  accentColor: plum\n  grayColor: sand\n');
    const theme = loadCanopyTheme({ configPath });
    expect(theme.accent.name).toBe('plum');
    expect(theme.css).toContain('--clover-color-accent: var(--color-accent-default);');
    expect(theme.css).toContain(`--color-accent-default: ${theme.accent.scale['800']};`);
    expect(variablesToCss(theme.variables)).toBe(theme.css);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
