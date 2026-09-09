const { discoveryError, DEFAULT_PAGE_SIZE } = require('./validation');
const { byteLength, boundedResponse, MAX_RESPONSE_BYTES } = require('./envelope');

function fingerprint(value) {
  const text = JSON.stringify(value);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash = Math.imul(hash ^ text.charCodeAt(index), 16777619);
  }
  return (hash >>> 0).toString(36);
}

function paginate(records, input, catalog, scope) {
  let offset = 0;
  const query = fingerprint(scope);
  if (input.cursor !== undefined) {
    let cursor;
    try {
      cursor = JSON.parse(decodeURIComponent(input.cursor));
    } catch {
      throw discoveryError('INVALID_CURSOR', 'The cursor is invalid. Restart the query.');
    }
    if (!cursor || typeof cursor !== 'object' || cursor.version !== catalog.datasetVersion) {
      throw discoveryError(
        'STALE_CURSOR',
        'The dataset changed. Restart the query without a cursor.',
      );
    }
    if (
      cursor.query !== query ||
      !Number.isSafeInteger(cursor.offset) ||
      cursor.offset < 0 ||
      cursor.offset > records.length
    ) {
      throw discoveryError('INVALID_CURSOR', 'The cursor does not belong to this query.');
    }
    offset = cursor.offset;
  }
  const limit = input.limit ?? DEFAULT_PAGE_SIZE;
  const end = Math.min(offset + limit, records.length);
  const nextCursor =
    end < records.length
      ? encodeURIComponent(JSON.stringify({ version: catalog.datasetVersion, query, offset: end }))
      : null;
  return {
    records: records.slice(offset, end),
    pagination: { total: records.length, limit, nextCursor },
  };
}

function paginateResponse(records, input, catalog, scope, render) {
  let page = paginate(records, input, catalog, scope);
  let result = render(page);
  while (byteLength(result) > MAX_RESPONSE_BYTES && page.records.length > 1) {
    page = paginate(
      records,
      { ...input, limit: Math.floor(page.records.length / 2) },
      catalog,
      scope,
    );
    result = render(page);
  }
  return boundedResponse(result);
}

module.exports = { paginateResponse };
