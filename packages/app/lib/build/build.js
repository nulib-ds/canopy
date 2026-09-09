const {
  fs,
  fsp,
  path,
  CONTENT_DIR,
  OUT_DIR,
  absoluteUrl,
  ensureDirSync,
  cleanDir,
} = require("../common");
const { exportDiscovery } = require("../discovery/export");
const { webMcpEnabled } = require("../discovery/config");
const mdx = require("./mdx");
const iiif = require("./iiif");
const pages = require("./pages");
const searchBuild = require("./search");
const {buildSearchIndex} = require("./search-index");
const runtimes = require("./runtimes");
const {writeSitemap} = require("./sitemap");
const {ensureSearchInitialized, finalizeSearch} = require("./search-workflow");
const {ensureStyles} = require("./styles");
const {copyAssets} = require("./assets");
const {logLine} = require("./log");
const navigation = require("../components/navigation");
const referenced = require("../components/referenced");
const bibliography = require("../components/bibliography");

// hold records between builds if skipping IIIF
let iiifRecordsCache = [];
let iiifManifestIdsCache = [];
let iiifCollectionIdsCache = [];
let pageRecords = [];
let discoveryCache = null;

function nowMs() {
  try {
    return Number(process.hrtime.bigint()) / 1e6;
  } catch (_) {
    return Date.now();
  }
}

function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms < 0) return "0ms";
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms)}ms`;
}

async function timeStage(label, store, fn) {
  const start = nowMs();
  try {
    return await fn();
  } finally {
    const durationMs = nowMs() - start;
    if (Array.isArray(store)) store.push({label, durationMs});
    try {
      logLine(
        `⏱ ${label} completed in ${formatDuration(durationMs)}`,
        "cyan",
        {
          dim: true,
        },
      );
    } catch (_) {}
  }
}

async function ensureNoJekyllMarker() {
  try {
    await fsp.mkdir(OUT_DIR, {recursive: true});
    const markerPath = path.join(OUT_DIR, ".nojekyll");
    await fsp.writeFile(markerPath, "", "utf8");
  } catch (_) {}
}

async function build(options = {}) {
  const skipIiif = !!(
    options?.skipIiif ||
    process.env.CANOPY_SKIP_IIIF === "1" ||
    process.env.CANOPY_SKIP_IIIF === "true"
  );
  if (!fs.existsSync(CONTENT_DIR)) {
    console.error("No content directory found at", CONTENT_DIR);
    process.exit(1);
  }
  const stageTimings = [];
  const buildStart = nowMs();

  /**
   * Clean and prepare output directory
   */
  await timeStage("Clean and prepare directories", stageTimings, async () => {
    logLine("\nClean and prepare directories", "magenta", {
      bright: true,
      underscore: true,
    });
    logLine("• Reset MDX cache", "blue", {dim: true});
    mdx?.resetMdxCaches();
    navigation?.resetNavigationCache?.();
    referenced?.resetReferenceIndex?.();
    bibliography?.resetBibliographyIndex?.();
    if (!skipIiif) {
      await cleanDir(OUT_DIR);
      await ensureNoJekyllMarker();
      logLine(`• Cleaned output directory`, "blue", {dim: true});
    } else {
      logLine("• Retaining cache (skipping IIIF rebuild)", "blue", {dim: true});
    }
    if (skipIiif) {
      await ensureNoJekyllMarker();
    }
  });

  /**
   * Build IIIF Collection content from configured source(s).
   * This includes building IIIF manifests for works and collections,
   * as well as collecting search records for works.
   */
  let iiifRecords = [];
  let CONFIG;
  let currentManifestIds = [];
  let currentCollectionIds = [];
  await timeStage("Build IIIF Collection content", stageTimings, async () => {
    logLine("\nBuild IIIF Collection content", "magenta", {
      bright: true,
      underscore: true,
    });
    CONFIG = await iiif.loadConfig();
    const sources = iiif.resolveIiifSources(CONFIG);
    const hasIiifSources =
      Array.isArray(sources?.collections) && sources.collections.length
        ? true
        : Array.isArray(sources?.manifests) && sources.manifests.length > 0;
    if (!skipIiif && hasIiifSources) {
      const results = await iiif.buildIiifCollectionPages(CONFIG);
      iiifRecords = results?.iiifRecords;
      discoveryCache = webMcpEnabled(CONFIG) ? results?.discovery || {} : null;
      iiifRecordsCache = Array.isArray(iiifRecords) ? iiifRecords : [];
      currentManifestIds = Array.isArray(results?.manifestIds)
        ? results.manifestIds
        : [];
      currentCollectionIds = Array.isArray(results?.collectionIds)
        ? results.collectionIds
        : [];
      iiifManifestIdsCache = currentManifestIds;
      iiifCollectionIdsCache = currentCollectionIds;
      logLine(
        `• IIIF records collected: ${Array.isArray(iiifRecords) ? iiifRecords.length : 0}`,
        "blue",
        {dim: true},
      );
    } else if (!skipIiif && !hasIiifSources) {
      iiifRecords = [];
      iiifRecordsCache = [];
      discoveryCache = {};
      currentManifestIds = [];
      currentCollectionIds = [];
      iiifManifestIdsCache = [];
      iiifCollectionIdsCache = [];
      logLine("• No IIIF sources configured; skipping", "blue", {dim: true});
    } else {
      iiifRecords = Array.isArray(iiifRecordsCache) ? iiifRecordsCache : [];
      currentManifestIds = Array.isArray(iiifManifestIdsCache)
        ? iiifManifestIdsCache
        : [];
      currentCollectionIds = Array.isArray(iiifCollectionIdsCache)
        ? iiifCollectionIdsCache
        : [];
      logLine(
        `• Reusing cached IIIF search records (${iiifRecords.length})`,
        "blue",
        {dim: true},
      );
    }
    // Ensure any configured featured manifests are cached (and thumbnails computed)
    // so SSR interstitials can resolve items even if they are not part of
    // the traversed collection or when IIIF build is skipped during incremental rebuilds.
    try {
      await iiif.ensureFeaturedInCache(CONFIG);
    } catch (_) {}
    if (!skipIiif && hasIiifSources && currentManifestIds.length) {
      try {
        const featuredKeepIds = Array.isArray(CONFIG?.featured)
          ? CONFIG.featured
          : [];
        await iiif.cleanupIiifCache({
          allowedManifestIds: currentManifestIds,
          allowedCollectionIds: currentCollectionIds,
          keepManifestIds: featuredKeepIds,
        });
      } catch (_) {}
    }
  });

  /**
   * Build contextual MDX content from the content directory.
   * This includes collecting page metadata for sitemap and search index,
   * as well as building all MDX pages to HTML.
   */
  await timeStage(
    "Build contextual content from Markdown pages",
    stageTimings,
    async () => {
      logLine("\nBuild contextual content from Markdown pages", "magenta", {
        bright: true,
        underscore: true,
      });
      // Interstitials read directly from the local IIIF cache; no API file needed
      try {
        bibliography?.buildBibliographyIndexSync?.();
      } catch (err) {
        logLine(
          "• Failed to build bibliography index: " +
            String(err && err.message ? err.message : err),
          "red",
          {dim: true},
        );
      }
      pageRecords = await searchBuild.collectMdxPageRecords();
      await pages.buildContentTree(CONTENT_DIR, pageRecords);
      logLine("✓ MDX pages built", "green");
    },
  );

  /**
   * Build search index from IIIF and MDX records, then build or update
   * the search.html page and search runtime bundle.
   * This is done after all content is built so that the index is comprehensive.
   */
  await timeStage("Create search indices", stageTimings, async () => {
    logLine("\nCreate search indices", "magenta", {
      bright: true,
      underscore: true,
    });
    try {
      await ensureSearchInitialized();
      const combined = await buildSearchIndex(iiifRecords, pageRecords);
      await finalizeSearch(combined);
    } catch (e) {
      logLine("✗ Search index creation failed", "red", {bright: true});
      logLine("  " + String(e), "red");
    }
  });

  await timeStage("Export IIIF discovery data", stageTimings, async () => {
    if (skipIiif && discoveryCache === null && webMcpEnabled(CONFIG)) {
      const catalogPath = path.join(OUT_DIR, "api", "discovery", "index.json");
      if (!fs.existsSync(catalogPath)) {
        throw new Error("IIIF discovery needs a full build before IIIF can be skipped.");
      }
      logLine(
        "• Retaining published IIIF discovery data (skipping IIIF rebuild)",
        "blue",
        {dim: true},
      );
      return;
    }
    await exportDiscovery({
      config: CONFIG,
      ...discoveryCache,
      records: iiifRecords,
      outDir: OUT_DIR,
      absoluteUrl,
    });
  });

  /**
   * Generate a sitemap so static hosts can discover every rendered page.
   */
  await timeStage("Write sitemap", stageTimings, async () => {
    logLine("\nWrite sitemap", "magenta", {
      bright: true,
      underscore: true,
    });
    try {
      await writeSitemap(iiifRecords, pageRecords);
    } catch (e) {
      logLine("✗ Failed to write sitemap.xml", "red", {bright: true});
      logLine("  " + String(e), "red");
    }
  });

  // No-op: Featured API file no longer written (SSR reads from cache directly)

  /**
   * Prepare client runtimes (e.g. search) by bundling with esbuild.
   * This is done early so that MDX content can reference runtime assets if needed.
   */
  await timeStage(
    "Prepare client runtimes and stylesheets",
    stageTimings,
    async () => {
      logLine("\nPrepare client runtimes and stylesheets", "magenta", {
        bright: true,
        underscore: true,
      });
      const tasks = [];
      if (!process.env.CANOPY_SKIP_STYLES) {
        tasks.push(
          (async () => {
            await ensureStyles();
            logLine("✓ Wrote styles.css", "cyan");
          })(),
        );
      }
      tasks.push(runtimes.prepareAllRuntimes());
      await Promise.all(tasks);
    },
  );

  /**
   * Copy static assets from the assets directory to the output directory.
   */
  await timeStage("Copy static assets", stageTimings, async () => {
    logLine("\nCopy static assets", "magenta", {
      bright: true,
      underscore: true,
    });
    await copyAssets();
  });

  const totalMs = nowMs() - buildStart;
  logLine("\nBuild phase timings", "magenta", {bright: true, underscore: true});
  for (const {label, durationMs} of stageTimings) {
    logLine(`• ${label}: ${formatDuration(durationMs)}`, "blue", {dim: true});
  }
  logLine(`Total build time: ${formatDuration(totalMs)}`, "green", {
    bright: true,
  });
}

module.exports = {build};

if (require.main === module) {
  build().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
