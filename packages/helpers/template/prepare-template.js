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

function rewritePackageJson(appVersion) {
  const p = path.join(OUTPUT_ROOT, 'package.json');
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  const vApp = appVersion || '';
  if (j.dependencies) {
    if (j.dependencies['@canopy-iiif/app']) {
      j.dependencies['@canopy-iiif/app'] = vApp ? ('^' + vApp) : '*';
    }
    for (const k of Object.keys(j.dependencies)) {
      if (j.dependencies[k] === 'workspace:*') j.dependencies[k] = '*';
    }
  }
  if (j.workspaces) delete j.workspaces;
  if (j.optionalDependencies) delete j.optionalDependencies;
  j.scripts = {
    build: 'tsx app/scripts/canopy-build.mts',
    dev: 'tsx app/scripts/canopy-build.mts',
  };
  j.devDependencies = j.devDependencies || {};
  const devDeps = {};
  const setDevDep = (name, fallback) => {
    const existing =
      (j.devDependencies && j.devDependencies[name]) ||
      (j.dependencies && j.dependencies[name]) ||
      null;
    if (existing) {
      devDeps[name] = existing;
    } else if (fallback) {
      devDeps[name] = fallback;
    }
  };

  setDevDep('@tailwindcss/cli', '^4.1.13');
  setDevDep('tailwindcss', '^4.1.13');
  setDevDep('tsx', '^4.19.1');

  const setDependency = (name, fallback) => {
    const existing =
      (j.dependencies && j.dependencies[name]) ||
      (j.devDependencies && j.devDependencies[name]) ||
      null;
    if (!j.dependencies) j.dependencies = {};
    if (existing) {
      j.dependencies[name] = existing;
    } else if (fallback) {
      j.dependencies[name] = fallback;
    }
    if (j.devDependencies) delete j.devDependencies[name];
  };

  setDependency('esbuild', '^0.21.4');

  const reactVersion =
    (j.dependencies && j.dependencies.react) ||
    (j.devDependencies && j.devDependencies.react) ||
    '^19.0.0';
  const reactDomVersion =
    (j.dependencies && j.dependencies['react-dom']) ||
    (j.devDependencies && j.devDependencies['react-dom']) ||
    '^19.0.0';

  if (!j.dependencies) j.dependencies = {};
  j.dependencies.react = reactVersion;
  j.dependencies['react-dom'] = reactDomVersion;

  delete j.devDependencies.react;
  delete j.devDependencies['react-dom'];

  j.devDependencies = devDeps;

  fs.writeFileSync(p, JSON.stringify(j, null, 2));
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
@import '@canopy-iiif/app/ui/styles/index.css';
`;
    fs.writeFileSync(path.join(stylesDir, 'index.css'), fallbackCss, 'utf8');
  }

  const tailwindConfigPath = path.join(stylesDir, 'tailwind.config.cjs');
  if (!fs.existsSync(tailwindConfigPath)) {
    const configSource = `const { pathToFileURL } = require('node:url');
const defineCanopyTailwindConfig = require('@canopy-iiif/app/ui/tailwind-config.js');

module.exports = defineCanopyTailwindConfig(pathToFileURL(__filename).href);
`;
    fs.writeFileSync(tailwindConfigPath, configSource, 'utf8');
  }

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

if (require.main === module) {
  try { main(); } catch (e) { console.error(e); process.exit(1); }
}
