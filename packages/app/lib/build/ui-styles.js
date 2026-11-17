// What comes ahead of the UI stylesheet's own rules in `ui/styles/index.css`, written by
// both of its compilers: the UI build (`ui/scripts/build-ui.mjs`) and the dev server's
// Sass watcher (`dev.js`). Clover's stylesheet comes first, in its own `@layer clover`,
// which the theme's layer order places between Tailwind's base and Canopy's components
// (`theme-tokens.js`); every site already imports this file. Its templates' sheet is for
// Scroll, Clover's Document template for now. Then 1.x's styling of Clover 3, carried
// over to Clover 4's markup (`version-parity.css`).
//
// The theme is added to each site's stylesheet at build time (`styles.js`); never bake it
// into this published file.

const UI_STYLES_IMPORTS = [
  '@import "@nulib/clover/styles.css";',
  '@import "@nulib/clover/templates.css";',
  '@import "./version-parity.css";',
];

function withUiStylesImports(css) {
  return [...UI_STYLES_IMPORTS, css || ''].join('\n');
}

module.exports = {
  UI_STYLES_IMPORTS,
  withUiStylesImports,
};
