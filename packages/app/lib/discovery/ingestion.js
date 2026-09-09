const { webMcpEnabled } = require('./config');
const { publicUrl } = require('./provenance');

function createIngestionReport(config) {
  const enabled = webMcpEnabled(config);
  const entries = new Map();
  const roots = new Set();
  const failures = [];
  const requested = new Set();
  const aliases = new Map();
  const resolveId = (id) => {
    const seen = new Set();
    while (aliases.has(id) && !seen.has(id)) {
      seen.add(id);
      id = aliases.get(id);
    }
    return id;
  };
  return {
    collection(resource, items, root = false, requestedId) {
      if (!enabled || !resource?.id) return;
      if (requestedId && requestedId !== resource.id) aliases.set(requestedId, resource.id);
      const existing = entries.get(resource.id);
      const children = [...(existing?.items || []), ...items];
      entries.set(resource.id, {
        resource,
        items: [...new Map(children.map((child) => [child.id, child])).values()],
      });
      if (root) roots.add(resource.id);
    },
    manifest(resource, requestedId) {
      if (enabled && resource?.id) {
        if (requestedId && requestedId !== resource.id) aliases.set(requestedId, resource.id);
        entries.set(resource.id, { resource });
        requested.delete(requestedId);
        requested.add(resource.id);
      }
    },
    request(id) {
      if (enabled) requested.add(id);
    },
    failure(id, reason = 'retrieval_failed') {
      if (enabled) failures.push({ id: publicUrl(id), reason });
    },
    result() {
      return {
        entries: [...entries.values()].map((entry) => {
          if (!entry.items) return entry;
          const children = entry.items.map((child) => ({ ...child, id: resolveId(child.id) }));
          return {
            ...entry,
            items: [...new Map(children.map((child) => [child.id, child])).values()],
          };
        }),
        roots: [...new Set([...roots].map(resolveId))],
        requestedManifests: [...new Set([...requested].map(resolveId))],
        failures,
      };
    },
  };
}
module.exports = { createIngestionReport };
