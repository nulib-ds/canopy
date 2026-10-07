const fs = require('fs');
const path = require('path');
const {spawnSync, spawn} = require('child_process');

function parseArgs(argv = []) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token) continue;
    const key = token.replace(/^--?/, '');
    if (token === '--source' || token === '-s') {
      args.source = argv[i + 1];
      i += 1;
    } else if (token === '--out' || token === '-o') {
      args.out = argv[i + 1];
      i += 1;
    } else if (token === '--name' || token === '-n') {
      args.name = argv[i + 1];
      i += 1;
    } else if (key === 'published') {
      args.published = true;
    } else if (key === 'help' || key === 'h') {
      args.help = true;
    }
  }
  return args;
}

function usage() {
  console.log('Usage: node packages/helpers/template/preview-template.js --source <dir> [--out <dir>] [--name <label>] [--published]');
  console.log('  --published  preview against the released @canopy-iiif/app instead of this checkout');
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    ...options,
  });
  if (result.status !== 0) {
    const cmd = [command].concat(args || []).join(' ');
    throw new Error(`Command failed: ${cmd}`);
  }
}

function npmCommand() {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

// Swap in this checkout's @canopy-iiif/app, packed the way `npm publish` packs
// it, so previews show unreleased lib/ui changes. A tarball rather than a
// symlink keeps its React resolving from the preview's node_modules.
function installLocalApp(cwd, outDir) {
  run(npmCommand(), ['-w', '@canopy-iiif/app', 'run', 'ui:build'], {cwd});
  const packed = spawnSync(
    npmCommand(),
    ['-w', '@canopy-iiif/app', 'pack', '--json', '--pack-destination', outDir],
    {cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit']},
  );
  if (packed.status !== 0) {
    throw new Error('Command failed: npm pack -w @canopy-iiif/app');
  }
  const tarball = path.join(outDir, JSON.parse(packed.stdout)[0].filename);
  try {
    run(npmCommand(), ['install', '--no-save', tarball], {cwd: outDir});
  } finally {
    fs.rmSync(tarball, {force: true});
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    process.exit(0);
    return;
  }

  const cwd = process.cwd();
  const resolvedSource = path.resolve(cwd, args.source || 'packages/helpers/template');
  if (!fs.existsSync(resolvedSource)) {
    throw new Error(`Template source not found: ${resolvedSource}`);
  }
  const templateName = args.name || path.basename(resolvedSource) || 'template-preview';
  const defaultOut = `.template-${templateName}-preview`;
  const resolvedOut = path.resolve(cwd, args.out || defaultOut);

  console.log(`[template preview] Preparing ${templateName} in ${resolvedOut}`);
  const env = {
    ...process.env,
    TEMPLATE_SOURCE_DIR: resolvedSource,
    TEMPLATE_OUT_DIR: resolvedOut,
  };

  run('node', ['packages/helpers/template/prepare-template.js'], {env});
  run(npmCommand(), ['install'], {cwd: resolvedOut});
  if (args.published) {
    console.log('[template preview] Using the published @canopy-iiif/app');
  } else {
    console.log('[template preview] Installing @canopy-iiif/app from this checkout');
    installLocalApp(cwd, resolvedOut);
  }

  console.log('[template preview] Starting dev server (Ctrl+C to stop)...');
  const child = spawn(npmCommand(), ['run', 'dev'], {
    cwd: resolvedOut,
    stdio: 'inherit',
  });

  const handleSignal = (signal) => {
    if (!child.killed) {
      child.kill(signal);
    }
  };

  process.on('SIGINT', () => handleSignal('SIGINT'));
  process.on('SIGTERM', () => handleSignal('SIGTERM'));

  child.on('exit', (code, signal) => {
    if (signal) {
      process.exit(1);
    } else {
      process.exit(code || 0);
    }
  });
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message || error);
    process.exit(1);
  }
}
