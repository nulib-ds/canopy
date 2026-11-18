// WCAG 2.2 contrast for every theme `canopy.yml` can ask for: each palette as the
// accent and as the gray, and hex accents, in light and dark. Canopy's defaults are
// Canopy's responsibility (packages/app/DESIGN.md §0), so a failing pair is a Canopy bug.
//
// The pairs are measured on what the build emits (`theme-palette.js`: each role's text
// step held at 4.5:1, the hover fill derived from the rest fill), never on Radix's raw
// steps. KNOWN mirrors ACCESSIBILITY.md and only shrinks. A new failure fails this test;
// so does a known one that starts passing, until its entry is removed here and in
// ACCESSIBILITY.md.

const {
  AVAILABLE_PALETTES,
  accentHover,
  contrast,
  toTailwindScale,
} = require('../../../packages/app/ui/theme-palette');

const PALETTES = Array.from(AVAILABLE_PALETTES).sort();
const APPEARANCES = ['light', 'dark'];
// `accentColor` also takes a hex color: Clover's blue, and colors at the edges of what
// a site might ask for (a bright yellow, pure black and white, a mid gray).
const HEX_ACCENTS = [
  '#0f62fe',
  '#ffcc00',
  '#00c853',
  '#ff00ff',
  '#e5484d',
  '#7f7f7f',
  '#000000',
  '#ffffff',
];
const ACCENTS = [...PALETTES, ...HEX_ACCENTS];

// The pairs Canopy draws with its own tokens (Tailwind levels; `theme-palette.js` maps
// 50 → Radix step 1 … 900 → step 12, and `hover` is `--color-accent-hover`). `on` is
// the ground. Two grounds are named for what they are (`ui/styles/settings/_tokens.scss`):
// `surface`, a panel's solid fill (`--canopy-surface`, level 200), and `raised`, a card's
// (`--canopy-surface-raised`: the page in light mode, level 300 in dark). `control-edge`
// is a field's or an outline button's edge (`--canopy-control-edge`: the muted text mixed
// 80% into the page, in sRGB).
const TEXT = 4.5;
const NON_TEXT = 3;
const PAIRS = [
  // Body text on the page (app/styles/index.css, `--clover-color-primary`).
  { name: 'body-text', scale: 'gray', fg: '900', on: ['gray', '50'], min: TEXT },
  // Muted text: captions, summaries, `--color-gray-muted`, `--clover-color-primary-muted`.
  { name: 'muted-text', scale: 'gray', fg: '800', on: ['gray', '50'], min: TEXT },
  // Links and accent text (`--color-accent-default`, `--clover-color-accent-text`).
  { name: 'accent-text', scale: 'accent', fg: '800', on: ['gray', '50'], min: TEXT },
  // A secondary button's hover text (styles/components/_buttons.scss).
  { name: 'accent-hover-text', scale: 'accent', fg: '900', on: ['gray', '50'], min: TEXT },
  // A primary button's label on its fill, and on its hover fill (_buttons.scss, the
  // search form's submit and the search filters' primary button).
  { name: 'button-label', scale: 'accent', fg: '50', on: ['accent', '800'], min: TEXT },
  { name: 'button-hover-label', scale: 'accent', fg: '50', on: ['accent', 'hover'], min: TEXT },
  // Focus outlines and indicators in the accent against the page (1.4.11).
  { name: 'focus-ring', scale: 'accent', fg: '800', on: ['gray', '50'], min: NON_TEXT },
  // 2.x: text on panels (the search filters' facets, the shortcut's hint) and on cards
  // (a card's words, its title in the accent under the pointer, a page result's address).
  { name: 'body-on-surface', scale: 'gray', fg: '900', on: ['gray', 'surface'], min: TEXT },
  { name: 'muted-on-surface', scale: 'gray', fg: '800', on: ['gray', 'surface'], min: TEXT },
  { name: 'body-on-raised', scale: 'gray', fg: '900', on: ['gray', 'raised'], min: TEXT },
  { name: 'muted-on-raised', scale: 'gray', fg: '800', on: ['gray', 'raised'], min: TEXT },
  { name: 'accent-on-raised', scale: 'accent', fg: '800', on: ['gray', 'raised'], min: TEXT },
  // A field's and an outline button's edge against the page (1.4.11).
  { name: 'control-edge', scale: 'gray', fg: 'control-edge', on: ['gray', '50'], min: NON_TEXT },
];

// No known failures: C4 and C5 were fixed in 2.x Phase 3 (ACCESSIBILITY.md, Fixed).
// An entry here is `{ [appearance]: { [pair]: [palette, …] } }`.
const KNOWN = {};

const scales = Object.fromEntries(
  APPEARANCES.map((appearance) => [
    appearance,
    {
      accent: Object.fromEntries(
        ACCENTS.map((name) => [name, toTailwindScale(name, { appearance, role: 'accent' })]),
      ),
      gray: Object.fromEntries(
        PALETTES.map((name) => [name, toTailwindScale(name, { appearance, role: 'gray' })]),
      ),
    },
  ]),
);

// sRGB mixing, as `color-mix(in srgb, a share, b)` draws it.
function mixSrgb(a, b, share) {
  const channels = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const [x, y] = [channels(a), channels(b)];
  return `#${x
    .map((v, i) => Math.round(v * share + y[i] * (1 - share)).toString(16).padStart(2, '0'))
    .join('')}`;
}

function colorAt(appearance, role, name, level) {
  const scale = scales[appearance][role][name];
  if (level === 'hover') return accentHover(scale, appearance);
  if (level === 'surface') return scale['200'];
  if (level === 'raised') return scale[appearance === 'dark' ? '300' : '50'];
  if (level === 'control-edge') return mixSrgb(scale['800'], scale['50'], 0.8);
  return scale[level];
}

// `${appearance} ${pair} ${palette}` for every failing pair. A pair that draws the
// accent on the gray fails for an accent if any gray fails it.
function measureFailures() {
  const failures = new Map();
  for (const appearance of APPEARANCES) {
    for (const pair of PAIRS) {
      const owners = pair.scale === 'accent' ? ACCENTS : PALETTES;
      for (const own of owners) {
        const grounds = pair.on[0] === pair.scale ? [own] : PALETTES;
        let worst = Infinity;
        for (const ground of grounds) {
          const fg = colorAt(appearance, pair.scale, own, pair.fg);
          const bg = colorAt(appearance, pair.on[0], ground, pair.on[1]);
          worst = Math.min(worst, contrast(fg, bg));
        }
        if (worst < pair.min) {
          failures.set(`${appearance} ${pair.name} ${own}`, worst.toFixed(2));
        }
      }
    }
  }
  return failures;
}

function knownFailures() {
  const keys = new Set();
  for (const [appearance, pairs] of Object.entries(KNOWN)) {
    for (const [pair, palettes] of Object.entries(pairs)) {
      for (const palette of palettes) keys.add(`${appearance} ${pair} ${palette}`);
    }
  }
  return keys;
}

test('offers the palettes this test covers', () => {
  expect(PALETTES.length).toBeGreaterThanOrEqual(31);
  for (const appearance of APPEARANCES) {
    for (const role of ['accent', 'gray']) {
      for (const [name, scale] of Object.entries(scales[appearance][role])) {
        expect(scale).not.toBeNull();
        for (const level of ['50', '600', '800', '900']) {
          expect([name, scale[level]]).toEqual([name, expect.stringMatching(/^#[0-9a-f]{6}$/i)]);
        }
      }
    }
  }
});

// What draws on black in both appearances, whatever the theme: a `<Band>` (its words and
// muted words, `--canopy-band-*`) and a code block (its text and faint text,
// `.canopy-code-block`).
test('a band and a code block hold their ratios on black', () => {
  const black = '#000000';
  expect(contrast('#ffffff', black)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(mixSrgb('#ffffff', black, 0.72), black)).toBeGreaterThanOrEqual(4.5);
  expect(contrast('#eeffff', black)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(mixSrgb('#eeffff', black, 0.62), black)).toBeGreaterThanOrEqual(4.5);
  // A marked line's tint, the accent's solid step at 24% over black, under the code's text.
  for (const appearance of APPEARANCES) {
    for (const name of ACCENTS) {
      const tint = mixSrgb(scales[appearance].accent[name]['600'], black, 0.24);
      expect([appearance, name, contrast('#eeffff', tint) >= 4.5]).toEqual([appearance, name, true]);
    }
  }
});

test('the contrast ratio follows WCAG', () => {
  expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5);
  expect(contrast('#ffffff', '#ffffff')).toBeCloseTo(1, 5);
  expect(contrast('#767676', '#ffffff')).toBeGreaterThan(4.5);
  expect(contrast('#777777', '#ffffff')).toBeLessThan(4.5);
});

test('no theme pair fails beyond the known failures in ACCESSIBILITY.md', () => {
  const measured = measureFailures();
  const known = knownFailures();
  const added = [...measured.keys()]
    .filter((key) => !known.has(key))
    .map((key) => `${key} (${measured.get(key)}:1)`);
  expect(added).toEqual([]);
});

test('every known contrast failure still fails, so the list stays current', () => {
  const measured = measureFailures();
  const fixed = [...knownFailures()].filter((key) => !measured.has(key));
  // A key listed here passes now: remove it from KNOWN and from ACCESSIBILITY.md.
  expect(fixed).toEqual([]);
});

// Only a step that falls short moves, so most sites look exactly as they did in 1.x.
test("a text step that already passes stays Radix's own", () => {
  const unchanged = [];
  for (const appearance of APPEARANCES) {
    for (const name of PALETTES) {
      const raw = toTailwindScale(name, { appearance });
      for (const role of ['accent', 'gray']) {
        const built = scales[appearance][role][name];
        for (const level of ['50', '100', '200', '300', '400', '500', '600', '700', '900']) {
          expect(built[level]).toBe(raw[level]);
        }
        if (built['800'].toLowerCase() === raw['800'].toLowerCase()) unchanged.push(name);
      }
    }
  }
  // The default theme (gold on sand) keeps every step, in both appearances.
  for (const appearance of APPEARANCES) {
    expect(scales[appearance].accent.gold['800'].toLowerCase()).toBe(
      toTailwindScale('gold', { appearance })['800'].toLowerCase(),
    );
    expect(scales[appearance].gray.sand['800'].toLowerCase()).toBe(
      toTailwindScale('sand', { appearance })['800'].toLowerCase(),
    );
  }
  expect(unchanged.length).toBeGreaterThan(PALETTES.length * 2);
});

// The hero's slide buttons draw their dots in the muted gray over the hero's ground, at
// the share the build works out for the theme (`--canopy-dot-share`): where they sit, 63%
// of the way from accent 50 to accent 200, and on accent 200 itself, each dot holds 3:1
// (1.4.11). 80% for most themes, the most translucent it goes.
test("the hero's translucent dots hold 3:1 on its ground, in every palette", () => {
  const { dotShare } = require('../../../packages/app/ui/theme-palette');
  const failing = [];
  const shares = new Set();
  for (const appearance of APPEARANCES) {
    for (const accent of ACCENTS) {
      const own = scales[appearance].accent[accent];
      for (const gray of PALETTES) {
        const grayScale = scales[appearance].gray[gray];
        const share = dotShare(own, grayScale);
        shares.add(share);
        for (const ground of [mixSrgb(own['200'], own['50'], 0.63), own['200']]) {
          const ratio = contrast(mixSrgb(grayScale['800'], ground, share), ground);
          if (ratio < NON_TEXT) failing.push(`${appearance} ${gray}/${accent} ${ratio.toFixed(2)}:1`);
        }
      }
    }
  }
  expect(failing).toEqual([]);
  expect(Math.min(...shares)).toBe(0.8);
  // The default theme, gold on sand, is at 80% in both appearances.
  for (const appearance of APPEARANCES) {
    expect(dotShare(scales[appearance].accent.gold, scales[appearance].gray.sand)).toBe(0.8);
  }
});

// The hover fill moves away from the label (darker on light, lighter on dark), or toward
// it where the fill is already black or white; either way it shows, and the label's
// ratio holds (`button-hover-label` above).
test("a primary button's hover fill differs from its rest fill", () => {
  const { luminance } = require('../../../packages/app/ui/theme-color');
  const darkened = [];
  for (const appearance of APPEARANCES) {
    for (const name of ACCENTS) {
      const scale = scales[appearance].accent[name];
      const hover = accentHover(scale, appearance);
      expect([appearance, name, contrast(hover, scale['800']) >= 1.1]).toEqual([
        appearance,
        name,
        true,
      ]);
      if (appearance === 'light' && luminance(hover) < luminance(scale['800'])) darkened.push(name);
    }
  }
  // Only an accent already at black lightens on hover in light mode.
  expect(ACCENTS.filter((name) => !darkened.includes(name))).toEqual(['#000000']);
});

// Each pair's ratio for one theme: `accent` and `gray` as `canopy.yml` names them.
function ratiosFor(appearance, accent, gray) {
  const own = { accent, gray };
  return Object.fromEntries(
    PAIRS.map((pair) => {
      const fg = colorAt(appearance, pair.scale, own[pair.scale], pair.fg);
      const bg = colorAt(appearance, pair.on[0], own[pair.on[0]], pair.on[1]);
      return [pair.name, contrast(fg, bg)];
    }),
  );
}

test.each(APPEARANCES)(
  'the default theme (gold on sand) passes every pair in %s mode',
  (appearance) => {
    const ratios = ratiosFor(appearance, 'gold', 'sand');
    const failing = PAIRS.filter((pair) => ratios[pair.name] < pair.min).map(
      (pair) => `${pair.name} ${ratios[pair.name].toFixed(2)}:1`,
    );
    expect(failing).toEqual([]);
  },
);
