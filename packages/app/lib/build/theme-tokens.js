const THEME_MARKER = "/* canopy-theme */";
const THEME_MARKER_END = "/* canopy-theme:end */";
const THEME_BLOCK_PATTERN =
  /\/\* canopy-theme \*\/[\s\S]*?\/\* canopy-theme:end \*\/\n?/g;
const PRELUDE_AT_RULE = /^@(charset|import|layer|namespace)\b/i;

// Index just past the `;` that ends the statement starting at `start`, or -1
// when a `{` opens a block first. Skips quoted strings and parentheses, since
// font URLs often contain `;`.
function statementEnd(css, start) {
  let quote = "";
  let depth = 0;
  for (let i = start; i < css.length; i++) {
    const ch = css[i];
    if (quote) {
      if (ch === "\\") i++;
      else if (ch === quote) quote = "";
    } else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === "(") depth++;
    else if (ch === ")") depth--;
    else if (depth === 0 && ch === ";") return i + 1;
    else if (depth === 0 && ch === "{") return -1;
  }
  return -1;
}

// Length of the leading comments and `@charset` / `@import` / `@layer a, b;` /
// `@namespace` statements. Those must precede every other rule, so nothing
// can be inserted ahead of them without invalidating them.
function cssPreludeLength(css) {
  let i = 0;
  for (;;) {
    while (i < css.length && /\s/.test(css[i])) i++;
    if (css.startsWith("/*", i)) {
      const end = css.indexOf("*/", i + 2);
      if (end === -1) return i;
      i = end + 2;
      continue;
    }
    if (!PRELUDE_AT_RULE.test(css.slice(i, i + 12))) return i;
    const end = statementEnd(css, i);
    if (end === -1) return i;
    i = end;
  }
}

// Tailwind's `@layer theme` holds its defaults (`--spacing`, `--text-*`) and a
// site's own `@theme` values. Declaring it ahead of `properties` keeps those
// below Canopy's tokens and `app/styles` overrides, so Tailwind's default
// `--color-gray-*` and `--font-*` values can't override them.
const LAYER_ORDER = "@layer theme, properties;";

// Places the generated theme ahead of the stylesheet's own rules. The theme
// and author overrides share `@layer properties`, so source order decides:
// putting the theme first lets `app/styles` overrides win without
// `!important`. A previously injected block is replaced, so repeat calls
// return identical output.
function withThemeBlock(css, themeCss) {
  const sanitized = String(css || "").replace(THEME_BLOCK_PATTERN, "");
  if (!themeCss) return sanitized;
  const block = `${THEME_MARKER}\n${LAYER_ORDER}\n${themeCss}\n${THEME_MARKER_END}\n`;
  const at = cssPreludeLength(sanitized);
  const head = sanitized.slice(0, at);
  const separator = head && !head.endsWith("\n") ? "\n" : "";
  return `${head}${separator}${block}${sanitized.slice(at)}`;
}

module.exports = {
  LAYER_ORDER,
  THEME_MARKER,
  THEME_MARKER_END,
  cssPreludeLength,
  withThemeBlock,
};
