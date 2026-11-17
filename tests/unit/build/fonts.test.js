// Google Sans Flex and Source Serif 4, shipped with the package and served from each site
// (lib/build/fonts.js),
// and the header both compilers write atop the UI stylesheet (lib/build/ui-styles.js).

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  FACES,
  FONT_FILES,
  FONT_SOURCE_DIR,
  copyFonts,
  fontFaceCss,
} = require('../../../packages/app/lib/build/fonts');
const {
  UI_STYLES_IMPORTS,
  withUiStylesImports,
} = require('../../../packages/app/lib/build/ui-styles');

test('ships each face and the license it comes under', () => {
  for (const file of FONT_FILES) {
    expect([file, fs.existsSync(path.join(FONT_SOURCE_DIR, file))]).toEqual([file, true]);
  }
  const license = fs.readFileSync(path.join(FONT_SOURCE_DIR, 'OFL.txt'), 'utf8');
  expect(license).toContain('SIL OPEN FONT LICENSE Version 1.1');
  expect(license).toContain('Copyright 2015 Google LLC');
  expect(license).toContain('2014 - 2021 Adobe Systems Incorporated');
  expect(license).toContain("Reserved Font Name\n'Source'");
  const pkg = require('../../../packages/app/package.json');
  expect(pkg.files).toContain('ui/fonts/**');
});

// Relative to the stylesheet, so a site served under a base path finds them.
test('declares the faces with relative URLs, both weights from one file', () => {
  const css = fontFaceCss();
  expect(css.match(/@font-face/g)).toHaveLength(FACES.length);
  for (const face of FACES) expect(css).toContain(`src:url("fonts/${face.file}") format("woff2")`);
  expect(css).toContain('font-family:"Google Sans Flex"');
  // The reading serif, upright and italic.
  expect(css).toContain('font-family:"Source Serif 4";font-style:normal');
  expect(css).toContain('font-family:"Source Serif 4";font-style:italic');
  expect(css).toContain('font-weight:400 700');
  expect(css).toContain('font-display:swap');
  expect(css).not.toMatch(/url\("\//);
  expect(css).not.toMatch(/https?:/);
});

test('copies the faces beside the stylesheet, and leaves them alone once there', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'canopy-fonts-'));
  try {
    copyFonts(dir);
    for (const file of FONT_FILES) {
      const copied = path.join(dir, 'fonts', file);
      expect(fs.statSync(copied).size).toBe(fs.statSync(path.join(FONT_SOURCE_DIR, file)).size);
    }
    const target = path.join(dir, 'fonts', FONT_FILES[0]);
    const before = fs.statSync(target).mtimeMs;
    copyFonts(dir);
    expect(fs.statSync(target).mtimeMs).toBe(before);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("puts Clover's stylesheets ahead of Canopy's rules, as both compilers write them", () => {
  const css = withUiStylesImports('.a{color:red}');
  expect(css.split('\n').slice(0, UI_STYLES_IMPORTS.length)).toEqual(UI_STYLES_IMPORTS);
  expect(UI_STYLES_IMPORTS[0]).toBe('@import "@nulib/clover/styles.css";');
  expect(css.endsWith('.a{color:red}')).toBe(true);
  const built = fs.readFileSync(
    path.join(__dirname, '../../../packages/app/ui/styles/index.css'),
    'utf8',
  );
  expect(built.startsWith(UI_STYLES_IMPORTS.join('\n'))).toBe(true);
});
