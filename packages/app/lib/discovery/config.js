const fs = require('node:fs');
const yaml = require('js-yaml');
const { resolveCanopyConfigPath } = require('../config-path');

function webMcpEnabled(config) {
  const value = config?.webmcp;
  if (value === undefined) return true;
  if (typeof value !== 'boolean') throw new TypeError('webmcp must be true or false.');
  return value;
}
function readWebMcpEnabled() {
  try {
    return webMcpEnabled(yaml.load(fs.readFileSync(resolveCanopyConfigPath(), 'utf8')));
  } catch (error) {
    if (error.code === 'ENOENT') return true;
    throw error;
  }
}
function webMcpScriptTag(withBase) {
  if (!readWebMcpEnabled()) return '';
  const escape = (value) =>
    String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  return `<script defer src="${escape(withBase('/scripts/canopy-webmcp.js'))}" data-canopy-discovery="${escape(withBase('/api/discovery/index.json'))}"></script>`;
}
module.exports = { webMcpEnabled, readWebMcpEnabled, webMcpScriptTag };
