const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');

const retrieved = new WeakMap();
const resourceKey = (id) => createHash('sha256').update(String(id)).digest('hex');
function publicUrl(value) {
  try {
    const url = new URL(value);
    return /^https?:$/.test(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch (_) {
    return null;
  }
}
function presentationVersion(resource) {
  const context = JSON.stringify(resource?.['@context'] || '');
  if (context.includes('/presentation/3/')) return '3.0';
  if (context.includes('/presentation/2/')) return '2.1';
  return null;
}
function rememberRetrieved(resource, uri) {
  if (resource && typeof resource === 'object') {
    retrieved.set(resource, {
      uri: publicUrl(uri),
      presentationVersion: presentationVersion(resource),
      retrievedAt: new Date().toISOString(),
      transformation: null,
    });
  }
  return resource;
}
function inheritProvenance(original, normalized) {
  if (normalized && typeof normalized === 'object' && retrieved.has(original)) {
    const source = retrieved.get(original);
    retrieved.set(normalized, {
      ...source,
      transformation:
        source.presentationVersion === '2.1' && presentationVersion(normalized) === '3.0'
          ? 'presentation-2-to-3'
          : source.transformation,
    });
  }
  return normalized;
}
async function saveProvenance(resource, cacheDir = path.resolve('.cache/iiif')) {
  const source = retrieved.get(resource);
  const id = resource?.id || resource?.['@id'];
  if (!source || !id) return;
  const dir = path.join(cacheDir, 'provenance');
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, `${resourceKey(id)}.json`), JSON.stringify(source));
}
async function readProvenance(resource, cacheDir = path.resolve('.cache/iiif')) {
  if (retrieved.has(resource)) return retrieved.get(resource);
  try {
    return JSON.parse(
      await fs.readFile(
        path.join(cacheDir, 'provenance', `${resourceKey(resource.id)}.json`),
        'utf8',
      ),
    );
  } catch (_) {
    return {
      uri: publicUrl(resource.id),
      presentationVersion: null,
      retrievedAt: null,
      transformation: null,
    };
  }
}
module.exports = {
  resourceKey,
  publicUrl,
  presentationVersion,
  rememberRetrieved,
  inheritProvenance,
  saveProvenance,
  readProvenance,
};
