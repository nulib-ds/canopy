// A static file server for built Canopy sites: `/docs/` → docs/index.html,
// `/docs/viewer` → docs/viewer.html, anything missing → 404.html. CORS is open so a
// site on one port can read IIIF JSON served from another.
//
//   node tests/a11y/lib/serve.mjs <dir> <port>

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml; charset=utf-8',
  '.yml': 'text/yaml; charset=utf-8',
};

function resolveFile(root, url) {
  let pathname = '/';
  try {
    pathname = decodeURIComponent(new URL(url, 'http://localhost').pathname);
  } catch (_) {
    return null;
  }
  const target = path.normalize(path.join(root, pathname));
  if (target !== root && !target.startsWith(root + path.sep)) return null;
  for (const candidate of [target, `${target}.html`, path.join(target, 'index.html')]) {
    try {
      if (fs.statSync(candidate).isFile()) return candidate;
    } catch (_) {}
  }
  return null;
}

export function serve(dir, port, host = '127.0.0.1') {
  const root = path.resolve(dir);
  const server = http.createServer((request, response) => {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' };
    const file = resolveFile(root, request.url || '/');
    if (!file) {
      const notFound = path.join(root, '404.html');
      response.writeHead(404, { ...headers, 'Content-Type': TYPES['.html'] });
      if (fs.existsSync(notFound)) fs.createReadStream(notFound).pipe(response);
      else response.end('Not found');
      return;
    }
    const type = TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
    response.writeHead(200, { ...headers, 'Content-Type': type });
    fs.createReadStream(file).pipe(response);
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => resolve(server));
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [dir, port] = process.argv.slice(2);
  if (!dir || !port) {
    console.error('Usage: node tests/a11y/lib/serve.mjs <dir> <port>');
    process.exit(1);
  }
  serve(dir, Number(port)).then(() => {
    console.log(`[a11y] serving ${dir} at http://127.0.0.1:${port}/`);
  });
}
