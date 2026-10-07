const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const {
  LAYER_ORDER,
  THEME_MARKER,
  cssPreludeLength,
  withThemeBlock,
} = require('../../../packages/app/lib/build/theme-tokens');
const { injectThemeTokens } = require('../../../packages/app/lib/build/styles');

const THEME = '@layer properties {\n  :root {\n    --color-accent-800: #3a5bc7;\n  }\n}';
const BANNER = '/*! tailwindcss v4.1.13 | MIT License | https://tailwindcss.com */\n';
const AUTHOR = '@layer properties{:root{--color-accent-800:#4e2a84}}.a{color:red}';

function countBlocks(css) {
  return css.split(THEME_MARKER).length - 1;
}

test('places the theme after the banner and before the first rule', () => {
  const out = withThemeBlock(`${BANNER}${AUTHOR}`, THEME);
  expect(out.startsWith(`${BANNER}${THEME_MARKER}\n${LAYER_ORDER}\n${THEME}`)).toBe(true);
  expect(out.endsWith(AUTHOR)).toBe(true);
});

test('keeps statements that must come first ahead of the theme', () => {
  const prelude = [
    '@charset "utf-8";',
    '@import url("https://fonts.googleapis.com/css2?family=A:wght@400;700&display=swap");',
    '@import url(https://fonts.googleapis.com/css2?family=B:wght@400;700);',
    "@import 'local.css' layer(base);",
    '@layer properties, theme, base;',
    '@namespace svg url(http://www.w3.org/2000/svg);',
  ].join('');
  const css = `${BANNER}${prelude}${AUTHOR}`;
  expect(cssPreludeLength(css)).toBe(BANNER.length + prelude.length);
  const out = withThemeBlock(css, THEME);
  expect(out.indexOf(THEME_MARKER)).toBe(BANNER.length + prelude.length + 1);
});

test('treats an @layer block as the first rule, not a prelude statement', () => {
  expect(cssPreludeLength('@layer properties{:root{--x:1}}')).toBe(0);
  expect(cssPreludeLength('@layer base;@layer base{a{b:c}}')).toBe(12);
});

test('puts author overrides after the theme so they win by source order', () => {
  const out = withThemeBlock(`${BANNER}${AUTHOR}`, THEME);
  expect(out.indexOf('#3a5bc7')).toBeLessThan(out.indexOf('#4e2a84'));
});

test('is idempotent and moves a previously appended block to the top', () => {
  const once = withThemeBlock(`${BANNER}${AUTHOR}`, THEME);
  expect(withThemeBlock(once, THEME)).toBe(once);

  const legacy = `${BANNER}${AUTHOR}\n${THEME_MARKER}\n${THEME}\n/* canopy-theme:end */\n`;
  const moved = withThemeBlock(legacy, THEME);
  expect(countBlocks(moved)).toBe(1);
  expect(moved).toBe(`${once}\n`);
});

test('handles empty stylesheets and a missing theme', () => {
  expect(withThemeBlock('', THEME)).toBe(
    `${THEME_MARKER}\n${LAYER_ORDER}\n${THEME}\n/* canopy-theme:end */\n`,
  );
  const stale = withThemeBlock(AUTHOR, THEME);
  expect(withThemeBlock(stale, '')).toBe(AUTHOR);
});

describe('injectThemeTokens', () => {
  let directory;
  let previousConfig;

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'canopy-theme-tokens-'));
    previousConfig = process.env.CANOPY_CONFIG;
    process.env.CANOPY_CONFIG = path.join(directory, 'canopy.yml');
    fs.writeFileSync(process.env.CANOPY_CONFIG, 'theme:\n  accentColor: plum\n  grayColor: sand\n');
  });

  afterEach(() => {
    if (previousConfig === undefined) delete process.env.CANOPY_CONFIG;
    else process.env.CANOPY_CONFIG = previousConfig;
    fs.rmSync(directory, { recursive: true, force: true });
  });

  test('injects once and skips rewriting an up-to-date file', () => {
    const target = path.join(directory, 'styles.css');
    fs.writeFileSync(target, `${BANNER}${AUTHOR}`);
    injectThemeTokens(target);
    const first = fs.readFileSync(target, 'utf8');
    expect(countBlocks(first)).toBe(1);
    expect(first.indexOf(THEME_MARKER)).toBe(BANNER.length);
    expect(first).toContain('--clover-color-accent: var(--color-accent-default);');

    const writes = jest.spyOn(fs, 'writeFileSync');
    try {
      injectThemeTokens(target);
      expect(writes).not.toHaveBeenCalled();
    } finally {
      writes.mockRestore();
    }
    expect(fs.readFileSync(target, 'utf8')).toBe(first);
  });

  test('keeps Tailwind CLI output valid around the theme', () => {
    const input = path.join(directory, 'index.css');
    const output = path.join(directory, 'styles.css');
    fs.writeFileSync(
      input,
      [
        '@import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap");',
        '@layer properties { :root { --color-accent-800: #4e2a84; } }',
        '.a { color: var(--color-accent-800); }',
      ].join('\n'),
    );
    const cli = path.join(
      path.dirname(require.resolve('@tailwindcss/cli/package.json')),
      'dist/index.mjs',
    );
    const result = spawnSync(process.execPath, [cli, '-i', input, '-o', output, '--minify'], {
      encoding: 'utf8',
    });
    expect(result.status).toBe(0);

    injectThemeTokens(output);
    const css = fs.readFileSync(output, 'utf8');
    const importAt = css.indexOf('@import');
    const themeAt = css.indexOf(THEME_MARKER);
    expect(importAt).toBeGreaterThan(-1);
    expect(importAt).toBeLessThan(themeAt);
    expect(themeAt).toBeLessThan(css.indexOf('#4e2a84'));
    expect(
      css
        .slice(0, themeAt)
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .trim(),
    ).toBe('@import "https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap";');
  });

  test('keeps Tailwind defaults and @theme values, layered below Canopy tokens', () => {
    const input = path.join(directory, 'index.css');
    const output = path.join(directory, 'styles.css');
    const tailwind = path.join(
      path.dirname(require.resolve('tailwindcss/package.json')),
      'index.css',
    );
    fs.writeFileSync(
      input,
      [
        `@import "${tailwind}";`,
        '@source inline("p-4 bg-brand bg-gray-500");',
        '@theme { --color-brand: #123456; }',
        '@layer properties { :root { --font-sans: "Author Sans"; } }',
      ].join('\n'),
    );
    const cli = path.join(
      path.dirname(require.resolve('@tailwindcss/cli/package.json')),
      'dist/index.mjs',
    );
    const result = spawnSync(process.execPath, [cli, '-i', input, '-o', output, '--minify'], {
      encoding: 'utf8',
    });
    expect(result.status).toBe(0);

    injectThemeTokens(output);
    const css = fs.readFileSync(output, 'utf8');
    // The site's own @theme value and Tailwind's spacing scale survive...
    expect(css).toMatch(/@layer theme\{[^]*--color-brand:#123456/);
    expect(css).toMatch(/--spacing:\.25rem/);
    expect(css).toContain('.bg-brand{background-color:var(--color-brand)}');
    expect(css).toContain('.p-4{padding:calc(var(--spacing)*4)}');
    // ...and the theme layer is declared ahead of properties, so Canopy's grays
    // and author fonts in @layer properties outrank Tailwind's defaults.
    expect(css.indexOf(LAYER_ORDER)).toBeGreaterThan(-1);
    expect(css.indexOf(LAYER_ORDER)).toBeLessThan(css.search(/@layer (theme|properties)\s*\{/));
    expect(css).toContain('.bg-gray-500{background-color:var(--color-gray-500)}');
  });
});
