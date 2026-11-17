// The 2.x look's two families, shipped with the package (`ui/fonts/`, under the SIL Open
// Font License, `ui/fonts/OFL.txt`) and copied next to each site's stylesheet, so a
// visitor's browser asks no third party for them: Google Sans Flex, for headings and the
// interface, and Source Serif 4, for reading text (DESIGN.md §1, "Type").
//
// The faces are declared in the block the build writes at the top of the compiled
// stylesheet (`theme-tokens.js`), after Tailwind has run. A relative `url()` there
// resolves against `styles/styles.css` itself, so it holds under any base path; a face
// declared in the UI stylesheet would have its `url()` rewritten by Tailwind, relative to
// the site's entry stylesheet, and point outside `site/`.
//
// Only the latin and latin-ext subsets ship. Text outside them falls back down the
// family's stack. A browser fetches a face only for text drawn in it, so a site that
// sets its own families loads none of these.

const fs = require('fs');
const path = require('path');

const FONT_SOURCE_DIR = path.resolve(__dirname, '..', '..', 'ui', 'fonts');
const FONT_DIR_NAME = 'fonts';

const LATIN =
  'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD';
const latinExt = (lastCurrency) =>
  `U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-${lastCurrency}, U+2113, U+2C60-2C7F, U+A720-A7FF`;

// One variable file a subset and style, spanning the two weights the look uses (400 and
// 700).
const FACES = [
  {
    family: 'Google Sans Flex',
    style: 'normal',
    file: 'google-sans-flex-latin.woff2',
    unicodeRange: LATIN,
  },
  {
    family: 'Google Sans Flex',
    style: 'normal',
    file: 'google-sans-flex-latin-ext.woff2',
    unicodeRange: latinExt('20C0'),
  },
  { family: 'Source Serif 4', style: 'normal', file: 'source-serif-4-latin.woff2', unicodeRange: LATIN },
  {
    family: 'Source Serif 4',
    style: 'normal',
    file: 'source-serif-4-latin-ext.woff2',
    unicodeRange: latinExt('20C4'),
  },
  {
    family: 'Source Serif 4',
    style: 'italic',
    file: 'source-serif-4-italic-latin.woff2',
    unicodeRange: LATIN,
  },
  {
    family: 'Source Serif 4',
    style: 'italic',
    file: 'source-serif-4-italic-latin-ext.woff2',
    unicodeRange: latinExt('20C4'),
  },
];

const FONT_FAMILIES = Array.from(new Set(FACES.map((face) => face.family)));
const FONT_FILES = [...FACES.map((face) => face.file), 'OFL.txt'];

function fontFaceCss() {
  return FACES.map(
    (face) =>
      `@font-face{font-family:"${face.family}";font-style:${face.style};font-weight:400 700;` +
      `font-stretch:100%;font-display:swap;` +
      `src:url("${FONT_DIR_NAME}/${face.file}") format("woff2");` +
      `unicode-range:${face.unicodeRange}}`,
  ).join('\n');
}

// Copies the faces and their license into `<stylesDir>/fonts/`, leaving files that are
// already the same size alone, so the dev watcher's repeat runs write nothing.
function copyFonts(stylesDir) {
  const dest = path.join(stylesDir, FONT_DIR_NAME);
  try {
    fs.mkdirSync(dest, { recursive: true });
  } catch (_) {}
  for (const name of FONT_FILES) {
    const from = path.join(FONT_SOURCE_DIR, name);
    const to = path.join(dest, name);
    try {
      const source = fs.statSync(from);
      let same = false;
      try {
        same = fs.statSync(to).size === source.size;
      } catch (_) {}
      if (!same) fs.copyFileSync(from, to);
    } catch (_) {}
  }
}

module.exports = {
  FACES,
  FONT_DIR_NAME,
  FONT_FAMILIES,
  FONT_FILES,
  FONT_SOURCE_DIR,
  copyFonts,
  fontFaceCss,
};
