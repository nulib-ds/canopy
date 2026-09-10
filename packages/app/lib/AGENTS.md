Lib Agent Notes
===============

Mission
-------
- Provides the Node-side builder, SSR utilities, and client runtime bundles consumed by the static site.
- Owns IIIF ingestion, MDX compilation, site generation, and search indexing.

Core Areas
----------
- `build/`: Orchestrates the site build pipeline (MDX, assets, search, IIIF).
- `components/`: Shared SSR-ready React components (MDX placeholders, layout helpers).
- `iiif/`: Fetching, caching, and normalizing Presentation 3 manifests.
- `search/`: Search runtime bundler + index writer.
- `discovery/`: IIIF catalog exports, resource retrieval, and the WebMCP browser runtime.
- `common.js` / `index.js`: Entry points that wire CLI commands `build()` and `dev()`.

Invariants
----------
- Server code must import UI through `@canopy-iiif/app/ui/server`; never pull browser-only modules into SSR paths.
- Bundled runtimes rely on browser React globals from `site/scripts/react-globals.js`; maintain esbuild shims for `react`, `react-dom`, `react-dom/client`, `flexsearch`, and any new browser deps the UI marks external.
- Keep IIIF cache writes confined to `.cache/iiif/`; document any format changes here before implementation.

Active Cleanup Goals
--------------------
1. Document and untangle build orchestration in `build/` (identify stages, shared utilities, and intended extension points).
2. Expand search indexing to include MDX page records per repository guidelines; ensure `writeSearchIndex` receives unified records.
3. Audit IIIF pipeline error handling and retry logic; capture gaps or performance tweaks in this log.
4. Establish targeted unit/integration tests around MDX rendering and search runtime bundling once baseline docs exist.

Current Focus
-------------
- Build pipeline map: diagram the flow from `build/index.js` through MDX compilation, asset sync, IIIF generation, and search index writes; note which steps run during `dev` versus `build`.
- Search index expansion: confirm where MDX pages are collected, identify reserved filenames to exclude, and outline the data contract passed to `writeSearchIndex`.
- Runtime bundling: review `search/search.js` for esbuild config drift (externals, shims); list required adjustments if UI adds new hydrated components.
- Cache hygiene: document when `.cache/mdx` vs `.cache/iiif` are pruned and add TODOs if cleanup relies on manual intervention.

### Interstitial hero support
- Featured manifests come from `canopy.yml → featured`; `lib/components/featured.js` normalizes IDs, resolves slugs from `.cache/iiif/index.json`, and surfaces thumbnails (`heroThumbnail*` when the IIIF build computed representative images).
- `build/iiif.js` now writes `heroThumbnail`, `heroThumbnailWidth`, and `heroThumbnailHeight` alongside standard thumbnails so the UI hero can display consistent crops.
- `build/mdx.js` → `ensureHeroRuntime()` bundles `packages/app/lib/components/hero-slider-runtime.js` to `site/scripts/canopy-hero-slider.js`; keep Swiper external and mirror any esbuild option changes in the UI workspace docs.

Risks & Watchpoints
-------------------
- Long reruns: if `dev` mode clears `.cache/iiif` too aggressively it slows iteration; capture triggers before modifying cleanup behavior.
- SSR safety: any import path change that reaches into `ui/src` instead of `ui/server` will break builds on platforms without DOM. Flag code locations handling UI imports.
- Partial failures: build stages lack retry/backoff; note hotspots (network IIIF fetches, MDX parsing) so we can stage resilience work.

Session Ritual
--------------
- Start by checking `build/index.js` for any ad-hoc logic that should be modularised.
- When touching bundler configs, record the rationale plus command to verify (e.g., `npm run build`, targeted script).
- Log open TODOs with references back to this document (`// TODO: see packages/app/lib/AGENTS.md#...`).

Logbook Template
----------------
- Date / engineer
- Stage(s) touched (build, mdx, iiif, search, runtime)
- Changes made / findings (link to sections above)
- Follow-ups created (reference numbered goals)

Logbook
-------
- 2026-09-10 / Codex: Updated the root Clover dependency from `^3.7.0` to npm's current stable `^3.16.0` and refreshed `package-lock.json`. All 202 tests across 17 suites now pass against the installed release, including the real Clover and custom TSX bundling fixtures; type checking, dependency-file formatting, and a network-enabled full site build pass. npm reports React peer warnings in Clover's transitive Radix packages and a critical MapLibre audit advisory (`GHSA-jrc7-96c5-q579`); its suggested Clover downgrade was not applied because the requested version is latest.
- 2026-09-10 / Codex: Browser runtime bundlers in `build/mdx.js`, `build/runtimes.js`, and `search/search.js` now target ES2020 because Clover's bundled MapLibre decoder uses native BigInt. `prepareAllRuntimes()` propagates labeled failures with their original cause and checks the cached custom component runtime result so page-level catches cannot hide a broken bundle. Verified the published Clover 3.16.0 in a temporary directory: both built-in and custom bundlers fail at ES2018 and pass at ES2020 without changing repository dependencies. Validation: `npm test` (202 tests across 17 suites), `npm run typecheck`, and targeted ESLint pass. Regression fixtures cover BigInt TSX output and a nonzero build exit for an unresolved custom dependency. The network-enabled `npm run build` also passed. The documented `packages/helpers/verify-build.js` command is stale; that helper is absent.
- 2026-09-09 / Codex: Reproduced the WebMCP build fixture's CI citation failure by removing `ui/dist`: missing SSR components prevented the work page and search record from being generated, leaving the source URL as the citation fallback. Root `pretest:unit` now builds UI assets before Jest, and the Tests workflow reads Node 24 from `.nvmrc`. The fixture reports rendering failures with child-process logs. Validation: all 193 tests across 15 suites pass starting without `ui/dist`; targeted ESLint and workflow YAML checks pass.
- 2026-09-08 / Codex: IIIF and AI tools use WebMCP with static catalog and resource files. Source version, retrieval time, and normalization history are stored separately under `.cache/iiif/provenance/<sha256-resource-id>.json`; IIIF JSON stays unchanged. Older cache entries report unknown provenance. The browser bundle has no React dependency and is injected by the shared HTML shell. Verify with discovery fixture tests and a network-enabled build.
- 2026-09-08 / Codex: The internal `createDiscoveryTools` helper supplies schema 1.0 IIIF responses to the browser. Responses have a 64 KiB data limit, versioned pagination, explicit partial summaries, and strict input validation. Discovery references resolve source aliases without changing snapshots; skipped IIIF builds retain the previous export. The tools require no separately hosted service or server SDK. Repository-wide lint still includes generated bundles and template previews with existing configuration errors.
- 2026-09-08 / Codex: WebMCP validation passed: 176 tests across 14 suites, type checking, targeted lint, formatting, package inspection, and a network-enabled static build with 175 Manifests and three Collections. Browser tests also verify the bundled script and WebMCP annotations. This feature adds no package dependencies or CLI commands.
- 2026-09-09 / Codex: A single root setting, `webmcp`, controls browser registration and static exports. It defaults to `true`; `webmcp: false` disables both. Removed the separate discovery settings. Configuration tests cover missing settings, explicit booleans, invalid values, and YAML errors. The build fixture verifies default enablement, explicit enablement, retained snapshots, and disabled cleanup. Validation: 193 tests across 15 suites, type checking, targeted lint, formatting, and a network-enabled build passed.
- 2026-04-26 / mat: Added local file path support to the manifest fetch worker in `build/iiif.js`. Previously, the worker branched on `https?://` and `file://` and SKIPped everything else; relative paths (e.g., `assets/iiif/example.json`) were silently dropped. Added a third branch that catches any value with no URI scheme (regex: no `[scheme]:` prefix) and routes it through `readJsonFromUri()`, which already resolves relative paths against `process.cwd()`. Collection-root URIs were already handled correctly via `readJsonFromUri()`; only the manifest worker needed the fix.
- 2025-09-26 / chatgpt: Hardened runtime bundlers to throw when esbuild or source compilation fails and required `content/works/_layout.mdx`; build now aborts instead of silently writing placeholder assets.
- 2025-09-26 / chatgpt: Replaced the legacy command runtime stub with an esbuild-bundled runtime (`search/search-form-runtime.js`); `prepareSearchFormRuntime()` now builds `site/scripts/canopy-search-form.js` and fails if esbuild is missing.
- 2025-09-27 / chatgpt: Documented Tailwind token flow in `app/styles/tailwind.config.mts`, compiled UI Sass variables during config load, and exposed `stylesheetHref`/`Stylesheet` helpers via `@canopy-iiif/app/head` so `_app.mdx` can reference the generated CSS directly.
- 2025-09-27 / chatgpt: Expanded search indexing to harvest MDX pages (respecting frontmatter/layout types), injected BASE_PATH hydration data into search.html, and reworked `mdx.extractTitle()` so generated records surface real headings instead of `Untitled`.
- 2025-10-19 / chatgpt: Embedded the Tailwind preset/plugin in a packaged config so dev/build fall back automatically; removed `app/styles/tailwind.config.*` from the default app and switched the public stylesheet to Tailwind’s CSS-first (`@import 'tailwindcss'; @theme { ... }`) workflow.
- 2025-10-20 / chatgpt: Added `lib/config-path.js` to resolve `canopy.yml` from the workspace root (preferring `options.cwd`, then npm `INIT_CWD`, then `process.cwd()`) and updated all loaders (theme, common base URL, search metadata, IIIF builder, featured manifests) to use it so hosted builds and Tailwind runs inside `node_modules/@canopy-iiif/app/ui` pick up user theme settings.

Verification Commands
---------------------
- Full pipeline: `npm run build`
- Dev/watch validation: `npm run dev`
