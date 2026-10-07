/**
 * canopy-iiif-preset
 *
 * A Tailwind preset that sources design tokens (colors, fonts, sizes, etc.)
 * from Sass under packages/ui/styles, injects them as CSS variables, and maps
 * Tailwind theme.extend values to those variables for easy use in utilities.
 *
 * @deprecated Removed in the next major release. Under Tailwind v4 this preset
 * adds no styles; the build injects the theme into each site's stylesheet.
 */
const plugin = require("tailwindcss/plugin");
const {loadCanopyTheme} = require("./theme");

function compileVarsCss() {
  const theme = loadCanopyTheme();
  if (theme && theme.css) {
    if (process.env.CANOPY_DEBUG_THEME) {
      console.log("[preset] using theme css");
    }
    return theme.css;
  }
}

module.exports = {
  plugins: [
    // Inject CSS variables (tokens) derived from Sass variables
    plugin(function ({addBase, postcss}) {
      const css = compileVarsCss();
      if (css && postcss && postcss.parse) addBase(postcss.parse(css));
    }),
  ],
};
