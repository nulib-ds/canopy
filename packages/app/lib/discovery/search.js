const { discoveryError } = require('./validation');

const normalize = (value) => String(value).normalize('NFKC').toLowerCase().trim();

function searchCriteria(input) {
  const facets = Object.entries(input.facets || {})
    .map(([label, values]) => [normalize(label), [...new Set(values.map(normalize))].sort()])
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return {
    query: [...new Set(normalize(input.query).split(/\s+/).filter(Boolean))].sort(),
    collectionId: input.collectionId ?? null,
    facets,
  };
}

function facetEntries(record) {
  return Object.entries(record.facets || {}).map(([label, values]) => [
    normalize(label),
    values.map(normalize),
  ]);
}

function searchRecords(catalog, criteria) {
  const manifests = catalog.resources.filter((record) => record.type === 'Manifest');
  const knownLabels = new Set(
    manifests.flatMap((record) => facetEntries(record).map(([label]) => label)),
  );
  for (const [label] of criteria.facets) {
    if (!knownLabels.has(label)) {
      throw discoveryError(
        'INVALID_ARGUMENT',
        `Unknown indexed facet: ${label}. Use iiif_describe_site to find facet labels.`,
      );
    }
  }
  return manifests
    .filter((record) => {
      if (criteria.collectionId && !record.collectionIds?.includes(criteria.collectionId))
        return false;
      // Search only the exported index text, never excluded metadata in the descriptive record.
      const text = normalize(record.searchText || '');
      if (!criteria.query.every((token) => text.includes(token))) return false;
      const facets = facetEntries(record);
      return criteria.facets.every(([label, accepted]) =>
        facets.some(
          ([key, values]) => key === label && accepted.some((value) => values.includes(value)),
        ),
      );
    })
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

function facetSummary(catalog) {
  const labels = new Map();
  for (const record of catalog.resources) {
    if (record.type !== 'Manifest') continue;
    for (const [label, values] of Object.entries(record.facets || {})) {
      if (!labels.has(label)) labels.set(label, new Set());
      for (const value of values) labels.get(label).add(value);
    }
  }
  return [...labels]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([label, values]) => ({
      label,
      values: [...values].sort().slice(0, 100),
      totalValues: values.size,
      truncated: values.size > 100,
    }));
}

function matchSummary(record, tokens) {
  const text = String(record.searchText || '')
    .replace(/\s+/g, ' ')
    .trim();
  const firstMatch = tokens.length ? normalize(text).indexOf(tokens[0]) : 0;
  const start = Math.max(0, firstMatch - 80);
  return `${start ? '…' : ''}${text.slice(start, start + 400)}${start + 400 < text.length ? '…' : ''}`;
}

module.exports = { searchCriteria, searchRecords, facetSummary, matchSummary };
