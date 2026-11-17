const fs = require('fs');
const path = require('path');

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function fail(msg) {
  console.error(`[guard-publish] ${msg}`);
  process.exit(1);
}

(function main() {
  const rootPkgPath = path.resolve('package.json');
  if (!fs.existsSync(rootPkgPath)) fail('Root package.json not found');
  const root = readJson(rootPkgPath);

  // 1) Root must be private
  if (!root.private) fail('Root package must be private to avoid publishing the app. Set "private": true.');

  // 2) Only @nulib/canopy and its 1.x name, @canopy-iiif/app (packages/app-alias), are
  // publishable
  const pkgDir = path.resolve('packages');
  if (!fs.existsSync(pkgDir)) {
    console.log('[guard-publish] No packages/ directory; nothing to validate.');
    return;
  }
  const entries = fs.readdirSync(pkgDir, { withFileTypes: true }).filter((e) => e.isDirectory());
  for (const e of entries) {
    const dir = path.join(pkgDir, e.name);
    const pkgPath = path.join(dir, 'package.json');
    if (!fs.existsSync(pkgPath)) continue;
    const pkg = readJson(pkgPath);
    const name = pkg.name || '(unnamed)';
    const isPrivate = !!pkg.private;
    const allowedPublic = new Set(['@nulib/canopy', '@canopy-iiif/app']);
    if (allowedPublic.has(name)) {
      if (isPrivate) fail(`${name} is marked private; unset "private" to allow publishing.`);
      continue;
    }
    // All other workspace packages must be private
    if (!isPrivate) fail(`Workspace ${name} must be private or removed before release.`);
  }
  // 3) The alias passes through to @nulib/canopy at exactly its version: published apart,
  // a 1.x site would get a different Canopy than its version says.
  const main = readJson(path.join(pkgDir, 'app', 'package.json'));
  const alias = readJson(path.join(pkgDir, 'app-alias', 'package.json'));
  const pinned = alias.dependencies && alias.dependencies[main.name];
  if (alias.version !== main.version || pinned !== main.version) {
    fail(
      `${alias.name}@${alias.version} must depend on ${main.name} at exactly ${main.version}, ` +
        `its own version (found ${pinned || 'none'}). Version both together (.changeset/config.json, fixed).`
    );
  }
  console.log(
    `[guard-publish] OK: only ${main.name} and ${alias.name} are publishable, both at ${main.version}; root app is private.`
  );
})();
