// Color math for the theme: WCAG 2.2 contrast, and mixing in OKLab, so a step moves
// toward black or white only as far as a ratio needs, keeping its hue. Pure, with no
// fs or config access: theme-palette.js bundles it into the SSR UI entry.

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

function parseHex(value) {
  const match = HEX.exec(String(value == null ? "" : value).trim());
  if (!match) return null;
  let hex = match[1].toLowerCase();
  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((digit) => digit + digit)
      .join("");
  }
  const value24 = parseInt(hex, 16);
  return [(value24 >> 16) & 255, (value24 >> 8) & 255, value24 & 255];
}

function toHex(rgb) {
  return `#${rgb
    .map((channel) =>
      Math.max(0, Math.min(255, Math.round(channel)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

// `#rgb` or `#rrggbb`, with or without its `#`, as `#rrggbb`; "" for anything else.
function normalizeHex(value) {
  const rgb = parseHex(value);
  return rgb ? toHex(rgb) : "";
}

function toLinear(channel) {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function fromLinear(value) {
  const clipped = Math.max(0, Math.min(1, value));
  return (
    255 *
    (clipped <= 0.0031308 ? 12.92 * clipped : 1.055 * clipped ** (1 / 2.4) - 0.055)
  );
}

// WCAG 2.2 relative luminance and contrast ratio, unrounded.
function luminance(hex) {
  const [r, g, b] = parseHex(hex).map(toLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}

// sRGB ↔ OKLab (Björn Ottosson's matrices). Out-of-gamut results clip per channel.
function toOklab(hex) {
  const [r, g, b] = parseHex(hex).map(toLinear);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function fromOklab([lightness, a, b]) {
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return toHex(
    [
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
    ].map(fromLinear),
  );
}

// `share` (0 to 1) of `other` mixed into `color`, as CSS's
// `color-mix(in oklab, color, other share)`.
function mix(color, other, share) {
  const from = toOklab(color);
  const to = toOklab(other);
  return fromOklab(from.map((value, index) => value + (to[index] - value) * share));
}

// `color` moved toward `toward` (black or white) only as far as it needs to reach `min`
// against every one of `grounds`: unchanged where it already does. Moving away from a
// ground's lightness only raises the ratio, so the worst ground decides.
function ensureContrast(color, grounds, min, toward) {
  const base = normalizeHex(color);
  const list = (Array.isArray(grounds) ? grounds : [grounds]).filter(Boolean);
  const worst = (candidate) =>
    Math.min(...list.map((ground) => contrast(candidate, ground)));
  if (!list.length || worst(base) >= min) return base;
  if (worst(mix(base, toward, 1)) < min) return normalizeHex(toward);
  let low = 0;
  let high = 1;
  for (let step = 0; step < 24; step += 1) {
    const middle = (low + high) / 2;
    if (worst(mix(base, toward, middle)) >= min) high = middle;
    else low = middle;
  }
  // Rounding to a hex can land a hair under; step on until the hex itself passes.
  let share = high;
  let out = mix(base, toward, share);
  while (worst(out) < min && share < 1) {
    share = Math.min(1, share + 0.002);
    out = mix(base, toward, share);
  }
  return out;
}

module.exports = {
  contrast,
  ensureContrast,
  luminance,
  mix,
  normalizeHex,
  parseHex,
  toHex,
};
