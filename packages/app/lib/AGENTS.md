Lib Agent Notes
===============

Prime directive: WCAG 2.2 AA
----------------------------
- The HTML the builder writes and every runtime it bundles conform to WCAG 2.2 at Level AA, and that outranks every note below. The rules are in `packages/app/DESIGN.md` §0; known failures are in `ACCESSIBILITY.md`.
- The HTML shell owns the page's `lang`, its landmarks and its skip link. A runtime never moves focus, reorders content or drops a name when it mounts.

Mission
-------
- Provides the Node-side builder, SSR utilities, and client runtime bundles consumed by the static site.
- Owns IIIF ingestion, MDX compilation, site generation, and search indexing.

Core Areas
----------
- `build/`: Orchestrates the site build pipeline (MDX, assets, search, IIIF).
- `components/`: Shared SSR-ready React components (MDX placeholders, layout helpers).
- `iiif/`: Fetching, caching, and normalizing Presentation 3 manifests.
- `search/`: the index writer (`search.js`), the search engine both runtimes share (`engine.js`, FlexSearch 0.8 behind it), their data loader and IndexedDB cache (`data.js`, `index-cache.js`), and the runtimes: the search page's (`search-app.jsx`), the header field's (`search-form-runtime.js`) and the engine it loads when used (`search-engine-runtime.js`).
- `discovery/`: IIIF catalog exports, resource retrieval, and the WebMCP browser runtime.
- `common.js` / `index.js`: Entry points that wire CLI commands `build()` and `dev()`.

Invariants
----------
- Server code must import UI through `@nulib/canopy/ui/server`; never pull browser-only modules into SSR paths.
- The package refers to itself by path, or by `PACKAGE_NAME` (`build/package-names.js`), never by a written name. Wherever a site's code is compiled or bundled, an import of either name (`@nulib/canopy`, or `@canopy-iiif/app` from 1.x) is read through `package-names.js`: `recmaPackageImports` for MDX, `esbuildPackageNames()` for browser bundles, `esbuildServerPackageNames()` for server bundles.
- Bundled runtimes rely on browser React globals from `site/scripts/react-globals.js`; maintain esbuild shims for `react`, `react-dom`, `react-dom/client`, and any new browser deps the UI marks external. FlexSearch is bundled, not shimmed: the search runtimes take its compact build through `search/bundle.js`'s `flexSearchPlugin()`.
- Only `search/engine.js` knows FlexSearch. A change to how words match changes `ENGINE_ID` and `tests/unit/search/engine.test.js` together.
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
- `build/mdx.js` → `ensureHeroRuntime()` bundles `packages/app/lib/components/hero-slider-runtime.js` to `site/scripts/canopy-hero-slider.js`. The runtime has no dependencies since 2.x Phase 4 (Embla gone); mirror any esbuild option changes in the UI workspace docs.

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
- 2026-11-16 / claude (2.x Phase 7): `build/search.js`'s `pageSearchRecord` reads the search front matter the docs promise (`searchType`, `searchSummary`, `searchSummaryMarkdown`, `description`, `image`) into a page's record; `build/search-index.js` passes its `thumbnail` on. `build/pages.js` takes a page's derived meta description from `extractSearchText`'s `excerpt`.
- 2026-11-16 / claude (2.x Phase 7): an MDX page's search text and excerpt come from `build/search-text.js` (the MDX parser with GFM, required as ESM, which Node 24 does and Jest 29 cannot, so its tests run in a child process), through `mdx.js`'s new `extractSearchText`; `extractPlainText` and `extractMarkdownSummary` remain its fallback, the former's link pattern fixed (it wrote "$1"). `build/search.js`'s `collectMdxPageRecords` uses it.
- 2026-11-16 / claude (2.x Phase 7): search, rebuilt on FlexSearch 0.8 behind `search/engine.js` (`packages/app/AGENTS.md`, "Search"). `search.js` bundles FlexSearch's compact build into `site/scripts/search.js`, minified, and writes no `flexsearch-globals.js`; `build/runtimes.js` builds `site/scripts/canopy-search-engine.js` for the header's field, which loads it when first used. `writeSearchIndex` logs through `../build/log` (its `./log` had not resolved since 2025) and no longer writes the index's version into `.cache/iiif/index.json` (its `./iiif` never resolved; nothing read it); the version covers the annotations too. `build/build.js` holds the IIIF records and ids it reuses between builds on `globalThis`: `dev.js` reloads the app's modules after a change under `lib/`, and a reloaded `build.js` without them indexed the pages alone and wrote them alone to the sitemap. Its discovery data stays the module's own, as a fresh module keeps the catalog already published (`tests/unit/discovery/build.test.js`). Verified: `npm test`, `npm run lint:a11y`, `npm run test:a11y`.
- 2026-11-13 / claude: `build/mdx.js` adds `build/rehype-task-list-labels.js` to every compile through `buildCompileOptions()`, which names Markdown task lists' checkboxes (ACCESSIBILITY.md C15); an override's `rehypePlugins` run after it. Tested in `tests/unit/mdx/task-list-labels.test.js`.
- 2026-11-15 / claude (2.x Phase 6): `build/fonts.js` copies Google Sans Flex (`ui/fonts/`, with `OFL.txt`) to `site/styles/fonts/` and declares its faces in the injected block, after Tailwind runs, so their relative `url()`s hold under any base path (`injectThemeTokens`, build and dev). `build/ui-styles.js` holds the Clover imports both `ui/scripts/build-ui.mjs` and dev's `rebuildUiStyles()` write atop `ui/styles/index.css`; dev's copy had none since Phase 2, so `npm run dev` drew Clover unstyled. The search form runtime fills in the ⌘K (Ctrl K) hint and the input's `aria-keyshortcuts`.
- 2026-11-13 / claude: 2.x Phase 0 (WCAG 2.2 AA prime directive; see the root `AGENTS.md` and `ACCESSIBILITY.md`).
  - `build/iiif.js` exposes `upgradeIiifResource` and `ensurePresentation3Manifest` on `__TESTING__`. `tests/unit/iiif/upgrade.test.js` covers the Presentation 2 → 3 upgrade, and fails if `@iiif/parser/upgrader` stops resolving.
  - Today `@iiif/parser` arrives only through `@samvera/clover-iiif` and `@iiif/helpers`. The build's fallback, `normalizeToV3`, calls `toPresentation3`, `normalize` and `upgradeToV3`, none of which `@iiif/helpers` exports, so a missing upgrader passes P2 through unconverted.
  - `tests/a11y/build-fixture.mjs` builds each template offline with `build/build.js`, serving the fixture's own IIIF at `CANOPY_BASE_URL` while it builds (featured Manifests are read by URL).
  - Verified: `npm test` (243 tests in 23 suites), `npm run test:a11y`, `npm run lint:a11y`.
- 2026-10-02 / claude: `build/pages.js` no longer links `scripts/canopy-hero-slider.css`. The file stopped existing when the hero moved from Swiper to Embla (`02be285`, 2026-05-06): its CSS came from the runtime's `swiper/css` imports, and Embla ships none. Every page with a hero had 404'd on it since then. The hero's layout styles live in `ui/styles/components/_interstitial-hero.scss`.
- 2026-10-02 / claude: Tailwind v4 cleanup in `build/styles.js` and `build/dev.js`:
  - Dropped the `tailwind.config.*` lookup and the `-c` flag. Tailwind v4's CLI has no such flag and loads a JS config only through `@config`, so neither the lookup nor the built-in default config was ever applied.
  - Dev no longer watches the preset/plugin/config files.
  - Stopped stripping Tailwind's `@layer theme`. `theme-tokens.js` now emits `@layer theme, properties;` inside the injected block, so Tailwind's defaults rank below Canopy's tokens and `app/styles` overrides instead of being deleted.
  - Stripping had broken every utility that reads a theme variable (`space-y-*`, `p-1`, `text-sm`, `transition`, `text-slate-*`) and any site-level `@theme` variable. It also forced `code`/`pre` onto fallback fonts.
  - Verified with a full computed-style diff of every element on six docs pages and four Northwestern pages. The only changes were `pre`/`code` now using the site's monospace font and the search summary picking up `text-sm` and the muted gray. `tests/unit/build/theme-tokens.test.js` covers a site's `@theme` values and Tailwind's spacing scale surviving.
- 2026-10-02 / claude: The generated `canopy.yml` theme now goes at the start of `site/styles/styles.css` (after the Tailwind banner and any `@charset`/`@import`/`@layer`/`@namespace` statements) instead of the end. Author overrides in `@layer properties` now win by source order, so they no longer need `!important`; existing `!important` still works. Placement lives in `build/theme-tokens.js` (`withThemeBlock`). The old marker regex never matched, so re-injection stacked copies; the new one is escaped, and `injectThemeTokens()` skips no-op writes so the dev watcher doesn't loop. Dev's `rebuildUiStyles()` and `ui/scripts/build-ui.mjs` (`CANOPY_EMBED_THEME`) no longer bake the theme into the package's `ui/styles/index.css`. A baked copy there outlives `canopy.yml` edits and, once imported, would override the fresh theme. Verified with `tests/unit/build/theme-tokens.test.js` and in-browser snapshots of a Northwestern template build: old pipeline with `!important` = new pipeline with or without it, in both build and dev (0 differences). Old pipeline without `!important`: 53 differences.
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
