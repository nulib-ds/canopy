# Repository Guidelines

This repository is a minimal Node.js project. Use this guide to add code and grow the project consistently and safely.

## Project Structure & Module Organization
- `app/`: app entry and styles
  - `app/scripts/canopy-build.mjs`: single stable entry for dev/build (orchestrates UI + lib)
  - `app/styles/`: Tailwind v4 entrypoint. The UI preset injects Sass-exported design tokens (colors, fonts, etc.) so utilities like `bg-brand` resolve to the CSS variables defined in the preset.
- `content/`: MDX pages and section layouts
- `assets/`: static files copied into `site/`
- `packages/`: workspaces
  - `packages/app` (`@canopy-iiif/app`): combined public package exposing the builder (CommonJS `lib/` with `build()` and `dev()`) and the UI runtime assets (`ui/` bundled by esbuild)
  - `packages/helpers`: private maintenance scripts (release guards, build checks)
- Root: `package.json`, `.gitignore`, `.github/workflows/*`, docs

## Build, Test, and Development Commands
- `npm install`: install dependencies.
- `npm run dev`: starts UI watcher and dev server (port 5001).
- `npm run build`: builds UI assets, then the static site to `site/`.
- `npm test`: placeholder; configure a real test runner before use.

> **Networking note:** The build must reach live IIIF collections and manifests. Always enable network access for the agent and approve elevated commands before running any task that fetches IIIF data (build, dev, cache refresh) so remote resources are retrieved rather than relying on stale caches.

Recommended scripts in `package.json`:
```json
{
  "scripts": {
    "dev": "node app/scripts/canopy-build.mjs",
    "build": "node app/scripts/canopy-build.mjs",
    "test": "echo \"No tests yet\" && exit 0",
    "lint": "eslint .",
    "format": "prettier -w ."
  }
}
```

## Coding Style & Naming Conventions
- Indentation: 2 spaces; use semicolons; single quotes for strings.
- Naming: camelCase for variables/functions, PascalCase for classes, kebab-case file names.
- Modules: prefer small, pure functions; keep files under ~200 lines when practical.
- Tooling: ESLint + Prettier (recommended). If configured, run `npm run lint` and `npm run format` before pushing.

## Testing Guidelines
- Framework: Jest (recommended).
- Test names: mirror source path; use `*.test.js` (e.g., `src/utils/math.test.js`).
- Coverage: target ≥80% lines/branches for new or changed code.
- Run tests: `npm test` once Jest is configured.

## Commit & Pull Request Guidelines
- Commits: follow Conventional Commits (e.g., `feat: add parser`, `fix: handle null id`).
- Scope: small, focused commits; present tense, imperative mood.
- PRs: include a clear description, linked issues, test plan/commands, and screenshots for UI changes.
- Checks: ensure local tests/lint pass; request review when green.

## Security & Configuration Tips
- Secrets: never commit credentials; use `.env` and document required variables.
- Node version: Node 24+ required (`>=24.0.0`). A `.nvmrc` is included; run `nvm use`.
- Dependencies: review with `npm audit` and update regularly.

## Interactive Components (SSR + Hydration)

- Components that depend on the browser must be SSR-safe. In `@canopy-iiif/app/ui`, render a placeholder in MDX on the server and dynamically import the real implementation in the browser. Example: `Viewer` uses a `data-canopy-viewer` placeholder.
- In `@canopy-iiif/app` (lib), bundle small hydration runtimes that find placeholders and mount React components using React globals (`site/scripts/react-globals.js`). Avoid bundling React into these runtimes.
- Shims: When bundling with esbuild, map `react`, `react-dom`, and `react-dom/client` to shims that read from `window.React` and `window.ReactDOMClient`. Mark heavy libs as `external` where they’re not needed (e.g., exclude `@samvera/clover-iiif/*` from the search runtime).

Available components:
- `<Viewer iiifContent="…" />` — wraps Clover viewer; hydrates via `site/canopy-viewer.js`.
- `<Interstitials.Hero … />` — hero interstitial that rotates featured manifests listed in `canopy.yml → featured`, pulls thumbnails from the IIIF cache, and hydrates via `site/canopy-hero-slider.js`. Supports props such as `headline`, `description`, `links`, `height`, `index`, `random`, and `background="theme" | "transparent"`.
- `<RelatedItems top={3} iiifContent?="…" />` — facet-driven related sliders.
  - Without `iiifContent` (homepage): pick one top value per indexed facet label and render one slider per label.
  - With `iiifContent` (work pages): read the Manifest’s metadata, intersect with indexed facets, then pick one of the Manifest’s values at random for each label and render exactly one slider per label. Facets not present on the Manifest are skipped.
  - Hydration: `site/canopy-related-items.js` (builds per-label placeholders) + `site/canopy-slider.js` (mounts Clover sliders).
- Search (composable): `<SearchForm />`, `<SearchSummary />`, `<SearchResults />`, `<SearchTabs />`, `<SearchTotal />` — hydrate via `site/search.js` and share a single client store.

Pages that include these placeholders automatically receive the required scripts.

### UI Build & SSR Split

- UI has two entry points (exported from the app package):
  - `@canopy-iiif/app/ui` (browser): built as ESM with `platform: neutral`. Externals: `react`, `react-dom`, `react-dom/client`, `react-masonry-css`, `flexsearch`, `@samvera/clover-iiif/*`.
  - `@canopy-iiif/app/ui/server` (SSR): built for Node and only exports SSR‑safe components (MDX placeholders, `Viewer`, etc.).
- The builder (`packages/app/lib/mdx.js`) imports `@canopy-iiif/app/ui/server` during MDX SSR to avoid pulling browser‑only code on the server.
- The search runtime bundles the client UI and injects React/FlexSearch globals shims so externals resolve from `window.*` in the browser.

### Search Results Grid

- `SearchResults` accepts `layout` prop: `'grid'` (default) or `'list'`.
- `'grid'` uses a new `Grid` component (Masonry) from `@canopy-iiif/app/ui`, implemented with `react-masonry-css` and scoped CSS.
- Keep `react-masonry-css` external in the UI build so the search runtime can bundle/transform it alongside the React shims, preventing dynamic `require('react')` at runtime.

**Troubleshooting**
- Dynamic require error: if the browser console shows “Dynamic require of 'react' is not supported”, ensure the UI browser build marks `react`, `react-dom`, `react-dom/client`, `react-masonry-css`, and `flexsearch` as externals. The search runtime bundles client code and shims these to browser globals.
- SSR import safety: the server must import `@canopy-iiif/app/ui/server` (not the browser entry) when rendering MDX to avoid loading browser‑only components during SSR.
- Masonry not creating columns: confirm the rendered HTML contains Masonry’s column wrappers (e.g., `.canopy-grid_column`). If missing, the Masonry module didn’t load; check externals and that React globals are injected on pages that need hydration.

## Search Framework (MDX-driven)

Goal: Allow authors to fully compose the search page via MDX, while the builder wires data and behavior.

- Entry layout: `content/search/_layout.mdx` (optional). If present, the builder renders it and injects a `search` prop with primitives:
  - `props.search.form`: search input element (`<input id="search-input" />`).
  - `props.search.results`: results container (`<ul id="search-results"></ul>`).
  - `props.search.count`: live-updating count of shown results (`<span id="search-count"></span>`).
  - `props.search.summary`: live-updating summary (`<div id="search-summary"></div>`), e.g., “Found X of N for “query””.

- Composition: Authors place these placeholders anywhere in their MDX; the builder does not impose layout. If no layout exists, a minimal fallback page is generated.

- Build steps:
  - `writeSearchIndex(records)`: writes two artifacts under `site/api/` — `search-index.json` (compact payload for FlexSearch) and `search-records.json` (richer display data for UI components). Every entry gets a stable `id` shared across both files so runtimes can join them deterministically. Records are currently fed by the IIIF build (`packages/app/lib/iiif.js`) and augmented with MDX pages. Metadata and summary values are flattened during IIIF ingestion based on `canopy.yml` search index settings.
  - When `search.index.annotations.enabled` is true, an additional `search-index-annotations.json` file is generated containing long-form annotation text filtered by the configured motivations. The runtime fetches this dataset on demand and merges it by `id` before indexing.
- `ensureSearchRuntime()`: bundles `site/search.js` (React app) with FlexSearch; it loads the JSON, indexes titles, and renders the UI. It mounts into `[data-canopy-search]` (from `<Search />`) or `#search-root` if present.
  - `buildSearchPage()`: renders `content/search/_layout.mdx` (if present) with the `search` prop and wraps it with the App (`content/_app.mdx`) and MDXProvider.

- Runtime behavior (site/search.js):
  - Loads `./search-index.json` (compact dataset) to build a FlexSearch index (title + metadata values + flattened summary text, forward tokenization). When `search-index-annotations.json` is present it is fetched, merged by `id`, and the annotation text is appended to the FlexSearch source. Display data continues to hydrate from `./search-records.json` for thumbnails, hrefs, and other UI extras.
  - Renders a form, summary text, and a results list (with optional type filter) as a React app.
  - Initializes from `?q=` and `?type=` URL params.
  - Resolves links with base path awareness via `CANOPY_BASE_PATH`.

- Extensibility notes:
  - Additional sources can be added to the index (e.g., MDX pages) by contributing records to `searchRecords` and calling `writeSearchIndex`.
  - If authors need custom result item markup, we can evolve the runtime to support a templating hook or expose a hydrated component, but that is out of scope for the current minimal approach.

## Search Index Extensibility

## Helpers Package and Root Cleanliness

- Keep the repository root clean. Do not add ad-hoc top-level `scripts/`.
- All helper scripts live under `packages/helpers/`.
- Examples:
  - Release guard: `node packages/helpers/guard-publish.js`

## Package Management

- Standardize on npm workspaces. Use `npm -w <workspace> run <script>` in root scripts.
- pnpm is not used here; `pnpm-lock.yaml` and `pnpm-workspace.yaml` have been removed and `.pnpm-store/` is ignored.

## Assets and Live Reload

- Static files under `assets/` are copied to the site root (preserving subpaths) during build.
  - Example: `assets/images/example.jpg` → `site/images/example.jpg`.
- During `npm run dev`, changes in `assets/` are watched and synced directly to `site/` without triggering a full rebuild of MDX or IIIF content; the browser live‑reloads automatically.

## IIIF Build

- Enable IIIF work page generation by adding `content/works/_layout.mdx`. The layout receives `props.manifest` (normalized to IIIF Presentation 3 when possible).
- Collection URIs are configured via `canopy.yml` (`collection`, either a string or an array). When omitted, `CANOPY_COLLECTION_URI` can supply a single fallback URI.
- When a project needs to stitch together standalone Manifests, list them under `canopy.yml → manifest` (or `manifests`). These URIs are fetched after traversing configured collections, and the build can rely solely on this list when no collections are provided.
- Local file paths are supported for both `collection` and `manifest` entries. Paths are resolved relative to the working directory at build time. Use a bare relative path (e.g., `assets/iiif/example-collection.json`) or a `file://` URI. Example:
  ```yaml
  collection:
    - assets/iiif/example-collection.json
  manifest:
    - assets/iiif/example-manifest.json
  ```
- Output pages are written to `site/works/<slug>.html`.
- Performance tuning: set `CANOPY_CHUNK_SIZE` (default `10`) and `CANOPY_FETCH_CONCURRENCY` (default `1`, use `0` for auto/unbounded fetch workers).
- Thumbnails:
  - `CANOPY_THUMBNAIL_SIZE` (default `400`) picks the desired width/height when selecting a representative image.
  - `CANOPY_THUMBNAILS_UNSAFE` (`true`/`1`) opts into a more aggressive lookup that may perform more requests.
  - A resolved thumbnail URL is stored on each Manifest in `.cache/iiif/index.json` as `thumbnail`.

## IIIF Cache

- Location: `.cache/iiif/`
  - `index.json`: primary index with `byId` (Collection/Manifest ids → slugs/parents) and `collection` metadata (uri, hash, updatedAt). Manifest entries may include a `thumbnail` URL when configured.
  - `manifests/{slug}.json`: cached normalized Manifest JSON per work.
- Changing the configured collection URIs resets the manifest cache. To force a clean fetch, delete `.cache/iiif/`.

## Development Notes

- `npm run dev` starts a local server with live reload.
- MDX changes under `content/` trigger a full site rebuild + reload.
- Asset changes under `assets/` sync only the changed files to `site/` and reload without a full rebuild.

## Quick Commands

- Release guard: `node packages/helpers/guard-publish.js`
- Build verification: `node packages/helpers/verify-build.js`

--## Release and Template Workflow

- Strategy: releases are published via Changesets; only after a successful publish does the workflow prepare and force‑push a clean template to `nulib-ds/canopy-template`.
- Trigger: `.github/workflows/release-and-template.yml` runs on `push` to `main` (and can be dispatched manually). It uses `changesets/action` to publish and exposes whether a release occurred; the template push runs only when a publish happened.
-- What it does:
  - Copies the repo into a disposable staging directory (default `.template-build/`, override with `TEMPLATE_OUT_DIR`), excluding dev-only paths (e.g., `.git`, `node_modules`, `packages`, `.cache`, `.changeset`, template workflows, agent docs).
  - Rewrites `package.json` inside the staging directory to remove workspaces, swap `workspace:*` deps for published versions of `@canopy-iiif/lib` and `@canopy-iiif/ui`, and set `build`/`dev` scripts to run `node app/scripts/canopy-build.mjs`.
  - Patches the Pages deploy workflow in the template to inline the build verify step (no helpers package there).
  - Force‑pushes the result to `main` of `nulib-ds/canopy-template` (and `nulib-ds/canopy-template-i18n` for the bilingual variant).
- Template expectations:
  - The generated template consumes the published `@canopy-iiif/app` package; it does not include the monorepo `packages/` directory.
  - `packages/helpers` is omitted from the template; template automation reuses the verified workflows committed to this repo.
  - Root `package.json` in the template is rewritten without workspaces and with pinned semver dependencies; `.github/workflows` are pared down so they reference the published package only.
- Keep template parity notes in `packages/helpers/AGENTS.md` when helper scripts change.
- Setup required:
  - Create the `canopy-template` repository under the `nulib-ds` org.
  - Add a secret in this repo named `TEMPLATE_PUSH_TOKEN` (PAT with `repo` write access to `nulib-ds/canopy-template`).
  - Optional: mark `canopy-template` as a Template repository in GitHub settings.

We index two sources: IIIF Manifests ("works") and static MDX pages ("pages"). Keep this simple and predictable.

- Record shape: `{ id?, title, href, type }`
  - `type`: `'work'` for IIIF manifest pages under `site/works/*.html`, `'page'` for MDX pages.
  - Optional future fields: `tags` (string array), custom fields for richer rendering.

- Current sources:
  - IIIF: already pushes `{ id, title, href, type: 'work' }` via `packages/lib/iiif.js` into `searchRecords`.
  - MDX: extend the build to add `{ title, href, type: 'page' }` for each non-reserved MDX file.

- Exclusions:
  - Reserved files starting with `_` (e.g., `_app.mdx`, `_layout.mdx`).
  - The search page itself (anything under `content/search/`).
  - Optionally, other utility pages such as `sitemap.mdx` can be excluded if desired.

- Where to hook:
  - In `packages/lib/build.js`, we already collect `pages` for the sitemap. Reuse that pass to create search records for MDX:
    - For each collected page, push `{ title, href, type: 'page' }` into the `searchRecords` array returned from the IIIF build, then call `writeSearchIndex` once with the combined list.

- Frontmatter (implemented):
  - Add optional YAML frontmatter at the top of MDX files:
    ```
    ---
    type: page   # or other string; when omitted (and frontmatter is present) page is excluded
    search: true # set to false to exclude
    ---
    ```
  - Policy:
    - If a frontmatter block exists and `search: false`, exclude.
    - If a frontmatter block exists and no `type` is provided, exclude.
    - If no frontmatter block exists, default to `type: 'page'` and include.
  - Frontmatter is stripped from MDX before compilation (no plugins needed).

- Directory layouts (`_layout.mdx`):
  - You can set a default type for all pages under a directory by adding frontmatter to the directory’s `_layout.mdx` (e.g., `content/docs/_layout.mdx` → `type: docs`).
  - Resolution order for a page’s type: page frontmatter `type` → nearest directory `_layout.mdx` frontmatter `type` → default `'page'` if the page has no frontmatter block.
  - If a page has a frontmatter block but omits `type`, it is excluded (does not inherit from layout in that case).

- Treating types separately (runtime):
  - Keep FlexSearch in simple mode indexing only `title` for now; store `type` in each record.
  - After search returns id hits, filter/group results in JS by `type` for toggles (e.g., show/hide "pages" vs "works").
  - Later, add a small hydrated UI component to render result items differently per type (textual for `'page'`, visual card/figure for `'work'`).

- Step-by-step rollout plan:
  1) Add MDX page records (`type: 'page'`), exclude `content/search/**`.
  2) Add `type` to all records and keep the runtime unchanged (count/summary include all).
  3) Add optional type toggle UI (no indexing changes needed) and client-side filtering.
  4) Introduce frontmatter parsing to set `type` and `search: false` (backward compatible; default `'page'` when absent; skip when neither `type` nor explicit opt-in is provided, per policy).
  5) Add per-type result renderers in `@canopy-iiif/ui` with sensible fallbacks.
