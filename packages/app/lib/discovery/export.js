const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { webMcpEnabled } = require('./config');
const { resourceKey, publicUrl, presentationVersion, readProvenance } = require('./provenance');

// Match the IIIF builder's search configuration coercion, including quoted YAML booleans.
function resolveBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (value === undefined || value === null) return false;
  return ['1', 'true', 'yes'].includes(String(value).trim().toLowerCase());
}
function indexEnabled(config, fallback) {
  return Object.prototype.hasOwnProperty.call(config || {}, 'enabled')
    ? resolveBoolean(config.enabled)
    : fallback;
}

const values = (value) =>
  typeof value === 'string'
    ? [value]
    : Object.values(value || {})
        .flat()
        .filter((v) => typeof v === 'string');
const labelKey = (value) =>
  value
    .trim()
    .replace(/[:\s]+$/g, '')
    .toLowerCase();
const text = (value) =>
  values(value)
    .join(' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stable(value[key])]),
    );
  return value;
}
function safeResource(resource) {
  // Never publish local paths or credential-bearing URLs, including nested IIIF IDs.
  if (Array.isArray(resource)) return resource.map(safeResource);
  if (!resource || typeof resource !== 'object') return resource;
  return Object.fromEntries(
    Object.entries(resource).flatMap(([key, value]) => {
      if ((key === 'id' || key === '@id') && typeof value === 'string' && !publicUrl(value))
        throw new Error('Resource contains a non-public identifier.');
      return [[key, safeResource(value)]];
    }),
  );
}
function facetsFor(resource, config) {
  const index = config.search?.index?.metadata || {};
  if (!indexEnabled(index, true)) return {};
  const includeAll = resolveBoolean(index.all);
  const allowed = new Set((config.metadata || []).map((label) => labelKey(String(label))));
  const result = Object.create(null);
  for (const entry of resource.metadata || []) {
    const label = text(entry.label);
    if (!label || (!includeAll && !allowed.has(labelKey(label)))) continue;
    result[label] = [
      ...new Set([...(result[label] || []), ...values(entry.value).map(text).filter(Boolean)]),
    ];
  }
  return result;
}
function addMembership(records) {
  const byId = new Map(records.map((record) => [record.id, record]));
  for (const parent of records.filter((record) => record.type === 'Collection')) {
    const visit = (id, seen) => {
      if (seen.has(id)) return;
      seen.add(id);
      const child = byId.get(id);
      if (!child) return;
      if (child.id !== parent.id && !child.collectionIds.includes(parent.id))
        child.collectionIds.push(parent.id);
      for (const item of child.items || []) visit(item.id, seen);
    };
    for (const item of parent.items || []) visit(item.id, new Set([parent.id]));
  }
  for (const record of records) record.collectionIds.sort();
}

async function exportDiscovery({
  config = {},
  entries = [],
  roots = [],
  requestedManifests = [],
  failures = [],
  records = [],
  outDir,
  cacheDir,
  absoluteUrl = (url) => url,
}) {
  const dest = path.join(outDir, 'api', 'discovery');
  if (!webMcpEnabled(config)) {
    await fs.rm(dest, { recursive: true, force: true });
    return null;
  }
  const index = config.search?.index || {};
  const metadataEnabled = indexEnabled(index.metadata, true);
  const summaryEnabled = indexEnabled(index.summary, true);
  const annotationsEnabled = indexEnabled(index.annotations, false);
  const recordsById = new Map(records.map((record) => [record.id, record]));
  const resources = [];
  const snapshots = new Map();
  const unavailable = failures.map((entry) => ({
    id: publicUrl(entry.id),
    reason: entry.reason || 'retrieval_failed',
  }));
  for (const entry of entries) {
    const original = entry.resource;
    const id = original?.id;
    if (
      !publicUrl(id) ||
      !['Manifest', 'Collection'].includes(original?.type) ||
      presentationVersion(original) !== '3.0'
    ) {
      unavailable.push({ id: publicUrl(id), reason: 'unsupported_resource' });
      continue;
    }
    if (snapshots.has(id)) continue;
    let resource;
    try {
      resource = safeResource(original);
    } catch (_) {
      unavailable.push({ id, reason: 'non_public_identifier' });
      continue;
    }
    const source = await readProvenance(original, cacheDir);
    const display = recordsById.get(id);
    const facets = facetsFor(resource, config);
    const record = {
      id,
      type: resource.type,
      label: resource.label || { none: [id] },
      source: { ...source, uri: publicUrl(source.uri) },
      snapshotUrl: `resources/${resourceKey(id)}-${resourceKey(JSON.stringify(stable(resource)))}.json`,
      citationUrl: display?.href
        ? absoluteUrl(display.href)
        : publicUrl(resource.homepage?.[0]?.id) || publicUrl(id),
      collectionIds: [],
      facets,
      searchText: [
        text(resource.label),
        ...(metadataEnabled ? display?.searchMetadataValues || Object.values(facets).flat() : []),
        summaryEnabled ? text(resource.summary) : '',
        annotationsEnabled ? display?.searchAnnotation || '' : '',
      ]
        .join(' ')
        .trim(),
    };
    for (const key of ['summary', 'metadata', 'rights', 'requiredStatement', 'provider'])
      if (resource[key] !== undefined) record[key] = resource[key];
    if (resource.type === 'Collection') {
      record.items = (entry.items || resource.items || [])
        .filter((item) => publicUrl(item.id) && ['Manifest', 'Collection'].includes(item.type))
        .map((item) => ({
          id: item.id,
          type: item.type,
          ...(item.label ? { label: item.label } : {}),
        }));
    }
    resources.push(record);
    snapshots.set(id, resource);
  }
  resources.sort((a, b) => a.id.localeCompare(b.id));
  addMembership(resources);
  const ids = new Set(resources.map((record) => record.id));
  for (const id of requestedManifests)
    if (!ids.has(id)) unavailable.push({ id: publicUrl(id), reason: 'manifest_unavailable' });
  const uniqueFailures = [
    ...new Map(unavailable.map((entry) => [JSON.stringify(entry), entry])).values(),
  ];
  const datasetVersion = createHash('sha256')
    .update(
      JSON.stringify(
        stable({
          resources,
          roots,
          failures: uniqueFailures,
          snapshots: [...snapshots].sort(([a], [b]) => a.localeCompare(b)),
        }),
      ),
    )
    .digest('hex');
  const catalog = {
    schemaVersion: '1.0',
    protocol: 'IIIF',
    datasetVersion,
    generatedAt: new Date().toISOString(),
    title: config.title || config.site?.title || 'IIIF Collections',
    roots: roots.filter((id) => ids.has(id)),
    coverage: {
      manifests: resources.filter((r) => r.type === 'Manifest').length,
      collections: resources.filter((r) => r.type === 'Collection').length,
      providerTotal: null,
      complete: uniqueFailures.length === 0,
      unavailable: uniqueFailures,
    },
    resources,
  };
  await fs.mkdir(path.join(outDir, 'api'), { recursive: true });
  const staging = await fs.mkdtemp(path.join(outDir, 'api', '.discovery-'));
  try {
    await fs.mkdir(path.join(staging, 'resources'));
    for (const record of resources)
      await fs.writeFile(
        path.join(staging, record.snapshotUrl),
        JSON.stringify(snapshots.get(record.id)),
      );
    await fs.writeFile(path.join(staging, 'index.json'), JSON.stringify(catalog));
    await fs.rm(dest, { recursive: true, force: true });
    await fs.rename(staging, dest);
  } finally {
    await fs.rm(staging, { recursive: true, force: true });
  }
  return catalog;
}
module.exports = { exportDiscovery, facetsFor, addMembership };
