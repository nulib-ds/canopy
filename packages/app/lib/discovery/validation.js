const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 20;

function discoveryError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validateValue(value, schema, name) {
  const invalid = (detail) => {
    throw discoveryError('INVALID_ARGUMENT', `${name} ${detail}.`);
  };
  if (schema.type === 'string') {
    if (typeof value !== 'string') invalid('must be a string');
    if (value.length > schema.maxLength) invalid(`must not exceed ${schema.maxLength} characters`);
    if (schema.minLength && !value.trim()) invalid('must not be empty');
  } else if (schema.type === 'integer') {
    if (!Number.isInteger(value) || value < schema.minimum || value > schema.maximum) {
      invalid(`must be an integer from ${schema.minimum} to ${schema.maximum}`);
    }
  } else if (schema.type === 'array') {
    if (!Array.isArray(value) || value.length < schema.minItems || value.length > schema.maxItems) {
      invalid(`must contain from ${schema.minItems} to ${schema.maxItems} values`);
    }
    value.forEach((item) => validateValue(item, schema.items, name));
  } else if (schema.type === 'object') {
    if (!isObject(value)) invalid('must be an object');
    if (schema.maxProperties && Object.keys(value).length > schema.maxProperties) {
      invalid(`must not contain more than ${schema.maxProperties} properties`);
    }
    for (const key of schema.required || []) {
      if (!Object.prototype.hasOwnProperty.call(value, key)) invalid(`requires ${key}`);
    }
    for (const [key, entry] of Object.entries(value)) {
      const child = Object.prototype.hasOwnProperty.call(schema.properties || {}, key)
        ? schema.properties[key]
        : undefined;
      if (child) validateValue(entry, child, key);
      else if (schema.additionalProperties === false) invalid(`contains unknown property ${key}`);
      else {
        if (!key.trim() || key.length > 256) invalid('contains an invalid facet label');
        validateValue(entry, schema.additionalProperties, key);
      }
    }
  }
}

function stringSchema(description, maxLength = 2048, minLength = 1) {
  return { type: 'string', description, minLength, maxLength };
}

const language = stringSchema('Preferred display language, such as en or fr-CA.', 64);
const paging = {
  cursor: stringSchema('Cursor from the previous page of this same query and dataset.', 4096),
  limit: {
    type: 'integer',
    description: 'Maximum number of results to return.',
    minimum: 1,
    maximum: MAX_PAGE_SIZE,
    default: DEFAULT_PAGE_SIZE,
  },
};
const id = stringSchema('The exact public IIIF resource ID returned by this site.');

function inputSchema(properties, required = []) {
  return { type: 'object', properties, required, additionalProperties: false };
}

const schemas = {
  describe: inputSchema({ language }),
  collection: inputSchema({ id, language, ...paging }, ['id']),
  search: inputSchema(
    {
      query: stringSchema(
        'Words to find in indexed IIIF text. Use an empty string to browse.',
        2048,
        0,
      ),
      collectionId: id,
      facets: {
        type: 'object',
        description:
          'Facet labels mapped to allowed values; labels combine with AND, values with OR.',
        maxProperties: 50,
        additionalProperties: {
          type: 'array',
          minItems: 1,
          maxItems: 100,
          items: stringSchema('An indexed facet value.'),
        },
      },
      language,
      ...paging,
    },
    ['query'],
  ),
  manifest: inputSchema({ id, language }, ['id']),
};

function validateCatalog(catalog) {
  if (!isObject(catalog) || catalog.schemaVersion !== '1.0' || catalog.protocol !== 'IIIF') {
    throw discoveryError(
      'UNSUPPORTED_SCHEMA',
      'Expected a Canopy IIIF discovery catalog, schema 1.0.',
    );
  }
  if (
    typeof catalog.datasetVersion !== 'string' ||
    !catalog.datasetVersion ||
    !Array.isArray(catalog.resources)
  ) {
    throw discoveryError('RESOURCE_UNAVAILABLE', 'The IIIF discovery catalog is incomplete.');
  }
}

module.exports = { discoveryError, validateValue, validateCatalog, schemas, DEFAULT_PAGE_SIZE };
