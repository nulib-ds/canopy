const { discoveryError } = require('./validation');

const MAX_RESPONSE_BYTES = 64 * 1024;
const summaryFields = [
  'id',
  'type',
  'label',
  'summary',
  'metadata',
  'rights',
  'requiredStatement',
  'provider',
];

function displayLabel(label, language) {
  if (typeof label === 'string') return label;
  if (!label || typeof label !== 'object') return '';
  const entries = Object.entries(label);
  const preferred = language?.toLowerCase();
  const entry =
    (preferred && entries.find(([key]) => key.toLowerCase() === preferred)) ||
    (preferred && entries.find(([key]) => key.toLowerCase() === preferred.split('-')[0])) ||
    (preferred &&
      entries.find(([key]) => key.toLowerCase().split('-')[0] === preferred.split('-')[0])) ||
    entries.find(([key]) => key === 'none') ||
    entries[0];
  const values = entry?.[1];
  return Array.isArray(values) ? values.join(' · ') : typeof values === 'string' ? values : '';
}

function baseEnvelope(catalog, representation = 'summary') {
  return {
    schemaVersion: '1.0',
    protocol: 'IIIF',
    api: 'Presentation',
    version: '3.0',
    representation,
    datasetVersion: catalog.datasetVersion,
    generatedAt: catalog.generatedAt ?? null,
  };
}

function resourceSummary(record) {
  return Object.fromEntries(
    summaryFields.filter((key) => record[key] !== undefined).map((key) => [key, record[key]]),
  );
}

function resourceEnvelope(record, catalog, language, resource, representation = 'summary') {
  return {
    ...baseEnvelope(catalog, representation),
    title: displayLabel(record.label, language) || record.id,
    resource: resource || resourceSummary(record),
    source: {
      uri: record.source?.uri ?? null,
      presentationVersion: record.source?.presentationVersion ?? null,
      retrievedAt: record.source?.retrievedAt ?? null,
      transformation: record.source?.transformation ?? null,
    },
    snapshotUrl: record.snapshotUrl ?? null,
    citationUrl: record.citationUrl ?? null,
    collectionIds: record.collectionIds || [],
    retrievalTool: record.type === 'Collection' ? 'iiif_get_collection' : 'iiif_get_manifest',
  };
}

function byteLength(value) {
  return new TextEncoder().encode(JSON.stringify(value)).length;
}

function boundedResponse(result) {
  if (byteLength(result) > MAX_RESPONSE_BYTES) {
    throw discoveryError(
      'RESOURCE_TOO_LARGE',
      'The IIIF response exceeds 64 KiB. Narrow the search or retrieve the published catalog or resource snapshot directly.',
    );
  }
  return result;
}

function manifestEnvelope(record, catalog, language, resource) {
  if (!resource || resource.id !== record.id || resource.type !== 'Manifest') {
    throw discoveryError(
      'RESOURCE_UNAVAILABLE',
      'The snapshot does not match the requested IIIF Manifest.',
    );
  }
  const full = resourceEnvelope(record, catalog, language, resource, 'full');
  const originalBytes = byteLength(full);
  if (originalBytes <= MAX_RESPONSE_BYTES) return full;
  const partial = resourceEnvelope(record, catalog, language, undefined, 'partial');
  partial.partial = {
    reason: 'response-limit',
    maxBytes: MAX_RESPONSE_BYTES,
    fullResponseBytes: originalBytes,
    omittedFields: Object.keys(resource).filter((key) => !(key in partial.resource)),
  };
  for (const field of ['metadata', 'summary', 'provider', 'label', 'requiredStatement', 'rights']) {
    if (byteLength(partial) <= MAX_RESPONSE_BYTES) break;
    if (field in partial.resource) {
      delete partial.resource[field];
      partial.partial.omittedFields.push(field);
    }
    if (field === 'label') partial.title = record.id;
  }
  if (byteLength(partial) > MAX_RESPONSE_BYTES) {
    throw discoveryError(
      'RESOURCE_TOO_LARGE',
      'The IIIF summary exceeds the response limit. Retrieve its published snapshot.',
    );
  }
  return partial;
}

module.exports = {
  baseEnvelope,
  resourceSummary,
  resourceEnvelope,
  manifestEnvelope,
  displayLabel,
  MAX_RESPONSE_BYTES,
  byteLength,
  boundedResponse,
};
