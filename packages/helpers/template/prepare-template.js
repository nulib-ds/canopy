const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const OUTPUT_ROOT = path.resolve(
  process.cwd(),
  process.env.TEMPLATE_OUT_DIR || '.template-build'
);

function resolveTemplateRoot() {
  const provided = process.env.TEMPLATE_SOURCE_DIR;
  if (!provided) return __dirname;
  const rooted = path.resolve(process.cwd(), provided);
  if (!fs.existsSync(rooted)) {
    throw new Error(`TEMPLATE_SOURCE_DIR not found: ${rooted}`);
  }
  return rooted;
}

function rmrf(p) {
  try { fs.rmSync(p, { recursive: true, force: true }); } catch (_) {}
}
function mkdirp(p) {
  fs.mkdirSync(p, { recursive: true });
}

function copyDirContents(src, dest) {
  if (!fs.existsSync(src)) return;
  const entries = fs.readdirSync(src, { withFileTypes: true });
  mkdirp(dest);
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirContents(srcPath, destPath);
      continue;
    }
    if (entry.isFile()) {
      mkdirp(path.dirname(destPath));
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function copyRepoToTemplate() {
  const excludes = [
    '.git',
    'node_modules',
    'AGENTS.md',
    'tests',
    '.husky',
    'configs',
    'packages',
    '.cache',
    '.changeset',
    '.github/workflows/template.yml',
    '.github/workflows/retarget-pr-base.yml',
    '.github/workflows/release-and-template.yml',
    '.github/workflows/test.yml',
  ];
  const relativeOutput = path.relative(process.cwd(), OUTPUT_ROOT);
  if (relativeOutput && !relativeOutput.startsWith('..')) {
    excludes.push(relativeOutput);
  }
  const args = ['-a', '--delete'];
  for (const e of excludes) { args.push('--exclude', e); }
  const destArg = path.join(OUTPUT_ROOT, '');
  args.push('./', destArg.endsWith(path.sep) ? destArg : `${destArg}${path.sep}`);
  execFileSync('rsync', args, { stdio: 'inherit' });
}

function regeneratePackageLock() {
  const lockPath = path.join(OUTPUT_ROOT, 'package-lock.json');
  rmrf(lockPath);
  const npmArgs = ['install', '--package-lock-only', '--ignore-scripts'];
  execFileSync('npm', npmArgs, { cwd: OUTPUT_ROOT, stdio: 'inherit' });
  rmrf(path.join(OUTPUT_ROOT, 'node_modules'));
}

function applyTemplateOverrides(templateRoot) {
  const distRoot = OUTPUT_ROOT;
  const resolvedTemplateRoot = templateRoot || resolveTemplateRoot();

  const templateContentDir = path.join(resolvedTemplateRoot, 'content');
  const distContentDir = path.join(distRoot, 'content');
  mkdirp(distContentDir);
  if (fs.existsSync(templateContentDir) && fs.statSync(templateContentDir).isDirectory()) {
    copyDirContents(templateContentDir, distContentDir);
  }

  const templateAssetsDir = path.join(resolvedTemplateRoot, 'assets');
  const distAssetsDir = path.join(distRoot, 'assets');
  if (fs.existsSync(templateAssetsDir) && fs.statSync(templateAssetsDir).isDirectory()) {
    copyDirContents(templateAssetsDir, distAssetsDir);
  }

  const templateAppPath = path.join(resolvedTemplateRoot, '_app.mdx');
  if (fs.existsSync(templateAppPath)) {
    const destAppPath = path.join(distRoot, 'content', '_app.mdx');
    mkdirp(path.dirname(destAppPath));
    fs.copyFileSync(templateAppPath, destAppPath);
  }

  const docsDir = path.join(distRoot, 'content', 'docs');
  rmrf(docsDir);

  const contributingPath = path.join(distRoot, 'CONTRIBUTING.md');
  rmrf(contributingPath);

  const tsconfigPath = path.join(distRoot, 'tsconfig.json');
  rmrf(tsconfigPath);

  const templateReadme = path.join(resolvedTemplateRoot, 'README.md');
  if (fs.existsSync(templateReadme)) {
    const destReadme = path.join(distRoot, 'README.md');
    fs.copyFileSync(templateReadme, destReadme);
  }

  const templateAgents = path.join(resolvedTemplateRoot, 'AGENTS.md');
  if (fs.existsSync(templateAgents)) {
    const destAgents = path.join(distRoot, 'AGENTS.md');
    fs.copyFileSync(templateAgents, destAgents);
  }

  const templateDesign = path.join(resolvedTemplateRoot, 'DESIGN.md');
  if (fs.existsSync(templateDesign)) {
    const destDesign = path.join(distRoot, 'DESIGN.md');
    fs.copyFileSync(templateDesign, destDesign);
  }

  const templateCanopy = path.join(resolvedTemplateRoot, 'canopy.yml');
  if (fs.existsSync(templateCanopy)) {
    const destCanopy = path.join(distRoot, 'canopy.yml');
    fs.copyFileSync(templateCanopy, destCanopy);
  }

  const workflowDir = path.join(distRoot, '.github', 'workflows');
  const workflowsToRemove = ['deploy-org-site.yml'];
  for (const workflow of workflowsToRemove) {
    const target = path.join(workflowDir, workflow);
    if (fs.existsSync(target)) rmrf(target);
  }
}

// The template's package.json, from the repository's: the published @nulib/canopy, which
// brings Clover, esbuild, tsx, Tailwind and its parsers itself, beside React and React DOM;
// its scripts run the package's `canopy` command. `APP_SOURCE` names another source for
// @nulib/canopy (a packed tarball, `file:…`), as `preview-template.js` passes one.
function templatePackageJson(source, appVersion, appSource) {
  const j = JSON.parse(JSON.stringify(source));
  const dependencies = j.dependencies || {};
  const devDependencies = j.devDependencies || {};
  const react = dependencies.react || devDependencies.react || '^19.0.0';
  const reactDom = dependencies['react-dom'] || devDependencies['react-dom'] || '^19.0.0';
  delete j.workspaces;
  delete j.optionalDependencies;
  delete j.main;
  delete j.devDependencies;
  j.scripts = {
    build: 'canopy build',
    dev: 'canopy dev',
  };
  j.dependencies = {
    '@nulib/canopy': appSource || (appVersion ? '^' + appVersion : '*'),
    react,
    'react-dom': reactDom,
  };
  return j;
}

function rewritePackageJson(appVersion) {
  const p = path.join(OUTPUT_ROOT, 'package.json');
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  const next = templatePackageJson(j, appVersion, process.env.APP_SOURCE || '');
  fs.writeFileSync(p, JSON.stringify(next, null, 2));
}

function writeTailwindFiles() {
  const stylesDir = path.join(OUTPUT_ROOT, 'app', 'styles');
  const srcStylesDir = path.join(process.cwd(), 'app', 'styles');
  mkdirp(stylesDir);

  const entries = fs.readdirSync(srcStylesDir, { withFileTypes: true });
  let copiedIndex = false;

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith('.css')) continue;
    const src = path.join(srcStylesDir, entry.name);
    const dest = path.join(stylesDir, entry.name);
    fs.copyFileSync(src, dest);
    if (entry.name === 'index.css') copiedIndex = true;
  }

  if (!copiedIndex) {
    const fallbackCss = `@import 'tailwindcss';
@import '@nulib/canopy/ui/styles/index.css';
`;
    fs.writeFileSync(path.join(stylesDir, 'index.css'), fallbackCss, 'utf8');
  }

  // No tailwind.config.*: Tailwind v4 reads a JS config only through
  // `@config`, so sites customize Tailwind in app/styles/index.css.
  const legacyMjsConfig = path.join(stylesDir, 'tailwind.config.mjs');
  if (fs.existsSync(legacyMjsConfig)) {
    rmrf(legacyMjsConfig);
  }
}

// Variants may ship their own `app/` files (e.g. `app/styles/custom.css`).
// Runs after writeTailwindFiles so variant styles win over the monorepo copies.
function applyTemplateAppOverrides(templateRoot) {
  const templateAppDir = path.join(templateRoot, 'app');
  if (!fs.existsSync(templateAppDir) || !fs.statSync(templateAppDir).isDirectory()) return;
  copyDirContents(templateAppDir, path.join(OUTPUT_ROOT, 'app'));
}

function main(templateRoot) {
  const appVersion = process.env.APP_VERSION || '';
  const resolvedTemplateRoot = templateRoot || resolveTemplateRoot();
  rmrf(OUTPUT_ROOT);
  mkdirp(OUTPUT_ROOT);
  copyRepoToTemplate();
  applyTemplateOverrides(resolvedTemplateRoot);
  rewritePackageJson(appVersion);
  regeneratePackageLock();
  const writeTemplateDeploy = require('./write-template-deploy');
  writeTemplateDeploy(OUTPUT_ROOT);
  writeTailwindFiles();
  applyTemplateAppOverrides(resolvedTemplateRoot);
}

module.exports = { templatePackageJson };

if (require.main === module) {
  try { main(); } catch (e) { console.error(e); process.exit(1); }
}
