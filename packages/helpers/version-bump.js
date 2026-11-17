'use strict';

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { spawnSync } = require('child_process');

function parseArgs(argv) {
  const args = new Set(argv.slice(2));
  if (args.has('--major')) return 'major';
  if (args.has('--minor') || args.has('-m')) return 'minor';
  return 'patch';
}

function writeChangeset(bump) {
  const dir = path.resolve('.changeset');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.TZ-]/g, '').slice(0, 14);
  const name = `bump-${bump}-${ts}.md`;
  const file = path.join(dir, name);
  const header = [
    '---',
    // @nulib/canopy and @canopy-iiif/app are one fixed group (.changeset/config.json).
    "'@nulib/canopy': " + bump,
    '---',
    '',
    `chore: version bump (${bump}) via helper script.`,
    '',
  ].join('\n');
  fs.writeFileSync(file, header, 'utf8');
  return file;
}

function run(cmd, args, opts) {
  const res = spawnSync(cmd, args, { stdio: 'inherit', shell: false, ...opts });
  if (res.status !== 0) process.exit(res.status || 1);
}

function isInteractive() {
  if (process.env.CI) return false;
  return process.stdin.isTTY && process.stdout.isTTY;
}

function askQuestion(rl, prompt) {
  return new Promise((resolve) => rl.question(prompt, resolve));
}

async function promptForReleaseNotes(version) {
  if (!isInteractive()) {
    console.warn('[version-bump] Skipping release notes prompt (non-interactive environment).');
    return null;
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    console.log(`\n[version-bump] Compose release notes for ${version}. Leave blank to skip.`);
    const summary = (await askQuestion(rl, 'Summary (optional): ')).trim();
    console.log('[version-bump] Enter release highlights (blank line to finish).');
    const highlights = [];
    while (true) {
      const entry = (await askQuestion(rl, '  - ')).trim();
      if (!entry) break;
      highlights.push(entry);
    }
    if (!summary && highlights.length === 0) return null;
    return { summary, highlights };
  } finally {
    rl.close();
  }
}

function ensureReleaseFiles() {
  const dir = path.resolve('content/docs/releases');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const jsonPath = path.join(dir, 'releases.json');
  const modulePath = path.join(dir, 'releases.data.mjs');
  if (!fs.existsSync(jsonPath)) fs.writeFileSync(jsonPath, '[]\n', 'utf8');
  if (!fs.existsSync(modulePath)) {
    const emptyModule = ['const releases = [];', 'export default releases;', ''].join('\n');
    fs.writeFileSync(modulePath, emptyModule, 'utf8');
  }
  return {jsonPath, modulePath};
}

function loadReleaseEntries(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('[version-bump] Unable to read releases.json, starting fresh:', err.message);
    return [];
  }
}

function writeReleasesModule(modulePath, entries) {
  const source =
    'const releases = ' + JSON.stringify(entries, null, 2) + ';\nexport default releases;\n';
  fs.writeFileSync(modulePath, source, 'utf8');
}

function formatEasternDate(date = new Date()) {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(date);
  } catch (_) {
    return date.toISOString().slice(0, 10);
  }
}

function recordReleaseNotes(version, notes) {
  if (!notes) return;
  const {jsonPath, modulePath} = ensureReleaseFiles();
  const entries = loadReleaseEntries(jsonPath);
  const entry = {
    version,
    date: formatEasternDate(),
    summary: notes.summary || '',
    highlights: notes.highlights || [],
  };
  const filtered = entries.filter((item) => item && item.version !== version);
  filtered.unshift(entry);
  fs.writeFileSync(jsonPath, JSON.stringify(filtered, null, 2) + '\n', 'utf8');
  writeReleasesModule(modulePath, filtered);
  console.log(`[version-bump] Recorded release notes for ${version}.`);
}

async function main() {
  const bump = parseArgs(process.argv);
  const created = writeChangeset(bump);
  // Apply versioning based on pending changesets (including the one we just wrote)
  // Use the JS entry directly to avoid shell shim incompatibilities
  const runner = path.resolve('packages/helpers/run-changeset.js');
  run(process.execPath, [runner, 'version']);

  // Keep root app version in sync with fixed workspace packages
  let newVersion = null;
  try {
    const appPkgPath = path.resolve('packages/app/package.json');
    newVersion = fs.existsSync(appPkgPath)
      ? JSON.parse(fs.readFileSync(appPkgPath, 'utf8')).version
      : null;
    if (!newVersion) throw new Error('Could not determine new version from app');

    const rootPkgPath = path.resolve('package.json');
    const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf8'));
    const prev = rootPkg.version;
    if (prev !== newVersion) {
      rootPkg.version = newVersion;
      fs.writeFileSync(rootPkgPath, JSON.stringify(rootPkg, null, 2) + '\n');
      console.log(`[version-bump] Synced root version ${prev} -> ${newVersion}`);
    } else {
      console.log('[version-bump] Root version already matches', newVersion);
    }
  } catch (e) {
    console.warn('[version-bump] Warning syncing root version:', e.message);
  }

  ensureReleaseFiles();

  if (newVersion) {
    const notes = await promptForReleaseNotes(newVersion);
    recordReleaseNotes(newVersion, notes);
  } else {
    console.warn('[version-bump] Skipping release notes: unable to resolve new version.');
  }

  console.log(`[version-bump] Applied ${bump} bump using ${path.basename(created)}`);
}

main().catch((err) => {
  console.error('[version-bump] Failed:', err);
  process.exit(1);
});
