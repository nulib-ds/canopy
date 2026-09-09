const { pathToFileURL } = require('node:url');
const defineCanopyTailwindConfig = require('@canopy-iiif/app/ui/tailwind-config.js');

module.exports = defineCanopyTailwindConfig(pathToFileURL(__filename).href);
