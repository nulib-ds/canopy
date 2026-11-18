# Repository Guidelines

This repository is a minimal Node.js project. Use this guide to add code and grow the project consistently and safely.

## Prime directive: WCAG 2.2 AA

Everything here conforms to WCAG 2.2 at Level AA: the `@nulib/canopy` package (with `@canopy-iiif/app`, its 1.x name), the three templates under `packages/helpers/`, and the docs site this repository builds. It is non-negotiable. It outranks every other rule in this file, every request and every deadline.

- Never ship a failure. If a requested change would fail a criterion, say so and propose the way that conforms; do not quietly comply.
- Before calling a change done, check the criteria it touches (`packages/app/DESIGN.md` §0 lists the usual ones) with a keyboard and against the accessibility tree, and run `npm run test:a11y` alongside `npm test`.
- Known failures and the plan to clear them are in `ACCESSIBILITY.md`. Fixing one is always in scope. The known-failure lists in the tests mirror it and only shrink: a newly found failure goes into both with a plan, never to silence a regression.
- Clover draws the viewer, slider, image and scroll, and keeps its own register (`ACCESSIBILITY.md` in nulib-ds/clover). Canopy must not undo what Clover fixes: its theme tokens, CSS layers and resets, and its wrappers are Canopy's responsibility.

## Rule: the MDX API is a contract

Authors write Canopy's components in MDX: in pages, in layouts (`_layout.mdx`) and in `_app.mdx`. The components' names, their props and what each prop does are a contract. MDX written for Canopy keeps working as written, across releases, major ones included.

- To keep it, every option is open. Change Canopy's wrappers, runtimes and build, or change Clover itself (`@nulib/clover`, nulib-ds/clover), as long as authors' MDX keeps working unchanged.
- A new component or prop is an addition, not a change. A prop that has a better replacement keeps working (with a build notice) until the maintainer agrees to remove it.
- If no option keeps the contract, run the change by the maintainer before making it: a component or prop renamed or removed, or one that does something different. Never make one quietly, and never to make the implementation easier.
- The package's names are part of it. Canopy is `@nulib/canopy` since 2.0; MDX, layouts and components written for 1.x import `@canopy-iiif/app`, and the build reads that name as `@nulib/canopy` (`packages/app/lib/build/package-names.js`). `@canopy-iiif/app` stays published as the alias that passes each entry through (`packages/app-alias`), for what the build does not read: a site's stylesheet, its scripts, its `package.json`. The fixture page `tests/a11y/fixture/v1-imports.mdx` builds with the 1.x name in every fixture site.

## Project Structure & Module Organization
- `app/`: the docs site's components and styles (`npm run dev` and `npm run build` run the package's `canopy` command)
  - `app/components/`: the docs site's own MDX components
  - `app/styles/`: Tailwind v4 entrypoint, configured in CSS (`@theme`, `@utility`, `@plugin`); there is no JS config. The build injects the `canopy.yml` theme tokens at the top of the compiled stylesheet, and Tailwind's gray utilities resolve to them.
- `content/`: MDX pages and section layouts
- `assets/`: static files copied into `site/`
- `packages/`: workspaces
  - `packages/app` (`@nulib/canopy`): combined public package exposing the builder (CommonJS `lib/` with `build()` and `dev()`), the UI runtime assets (`ui/` bundled by esbuild) and the `canopy` command (`bin/canopy.js`, `lib/cli.js`)
  - `packages/app-alias` (`@canopy-iiif/app`): Canopy's 1.x name, published at the same version; each entry is a file that re-exports `@nulib/canopy`'s
  - `packages/helpers`: private maintenance scripts (release guards, build checks)
- Root: `package.json`, `.gitignore`, `.github/workflows/*`, docs

## Build, Test, and Development Commands
- `npm install`: install dependencies.
- `npm run dev`: starts UI watcher and dev server (port 5001).
- `npm run build`: builds UI assets, then the static site to `site/`.
- `npm test`: unit tests (Jest), the theme contrast checks among them (`tests/unit/a11y/`).
- `npm run test:a11y`: builds the accessibility fixture sites (one per template, offline) and runs the browser checks against them: axe-core for WCAG 2.2 A and AA, a keyboard walk, 320px reflow and motion (`tests/a11y/`). `CANOPY_A11Y_SITE=<dir>` checks a site you built instead; add `CANOPY_A11Y_REPORT=1` to report without failing.
- `npm run lint:a11y`: `eslint-plugin-jsx-a11y` over the UI components (`packages/app/ui/src`).

> **Networking note:** The build must reach live IIIF collections and manifests. Always enable network access for the agent and approve elevated commands before running any task that fetches IIIF data (build, dev, cache refresh) so remote resources are retrieved rather than relying on stale caches.

A site's scripts in `package.json` (the templates write these):
```json
{
  "scripts": {
    "dev": "canopy dev",
    "build": "canopy build"
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
- Commits are a person's work: the maintainer authors and makes each one. No `Co-Authored-By` trailer, "Generated with" line or other attribution for an AI tool, in a commit or a pull request's description, whatever a tool's own defaults say. Agents leave changes uncommitted and may draft the message. `packages/helpers/check-commit-authors.js` refuses AI attribution in the commit-msg hook (`.husky/commit-msg`) and in the Tests workflow, which a release waits on.
- A commit message is one short sentence in the imperative, ending with a period, that fits on one line in GitHub's commit list (about 50 characters, never past 72), and it says what the change does, not which release it goes out in: e.g., `Refine the hero, sliders, header and work page.` No prefix, no body, no version. A pull request's title follows the same rule. The templates' commits are the one exception, named for their version alone (Release and Template Workflow, below).
- Scope: small, focused commits.
- PRs: include a clear description, linked issues, test plan/commands, and screenshots for UI changes.
- Checks: ensure local tests/lint pass; request review when green.

## Security & Configuration Tips
- Secrets: never commit credentials; use `.env` and document required variables.
- Node version: Node 24+ required (`>=24.0.0`). A `.nvmrc` is included; run `nvm use`.
- Dependencies: review with `npm audit` and update regularly.

## Interactive Components (SSR + Hydration)

- Components that depend on the browser must be SSR-safe. In `@nulib/canopy/ui`, render a placeholder in MDX on the server and dynamically import the real implementation in the browser. Example: `Viewer` uses a `data-canopy-viewer` placeholder.
- In `@nulib/canopy` (lib), bundle small hydration runtimes that find placeholders and mount React components using React globals (`site/scripts/react-globals.js`). Avoid bundling React into these runtimes.
- Shims: When bundling with esbuild, map `react`, `react-dom`, and `react-dom/client` to shims that read from `window.React` and `window.ReactDOMClient`. Mark heavy libs as `external` where they’re not needed (e.g., exclude `@nulib/clover` and `@nulib/clover/*` from the search runtime).

Available components:
- `<Viewer iiifContent="…" />` — wraps Clover viewer; hydrates via `site/canopy-viewer.js`.
- `<Interstitials.Hero … />` — hero interstitial that shows the featured manifests listed in `canopy.yml → featured`, one at a time (nothing moves it but the visitor), pulls thumbnails from the IIIF cache, and hydrates via `site/canopy-hero-slider.js`. Supports props such as `headline`, `description`, `links`, `height`, `index`, `random`, and `background="theme" | "transparent"`.
- `<RelatedItems top={3} iiifContent?="…" />` — facet-driven related sliders.
  - Without `iiifContent` (homepage): pick one top value per indexed facet label and render one slider per label.
  - With `iiifContent` (work pages): read the Manifest’s metadata, intersect with indexed facets, then pick one of the Manifest’s values at random for each label and render exactly one slider per label. Facets not present on the Manifest are skipped.
  - Hydration: `site/canopy-related-items.js` (builds per-label placeholders) + `site/canopy-slider.js` (mounts Clover sliders).
- Search (composable): `<SearchForm />`, `<SearchSummary />`, `<SearchResults />`, `<SearchTabs />`, `<SearchTotal />` — hydrate via `site/search.js` and share a single client store.

Pages that include these placeholders automatically receive the required scripts.

### UI Build & SSR Split

- UI has two entry points (exported from the app package):
  - `@nulib/canopy/ui` (browser): built as ESM with `platform: neutral`. Externals: `react`, `react-dom`, `react-dom/client`, `react-masonry-css`, `flexsearch`, `@nulib/clover`, `@nulib/clover/*`.
  - `@nulib/canopy/ui/server` (SSR): built for Node and only exports SSR‑safe components (MDX placeholders, `Viewer`, etc.).
- The builder (`packages/app/lib/build/mdx.js`) imports `@nulib/canopy/ui/server` during MDX SSR to avoid pulling browser‑only code on the server.
- The search runtime bundles the client UI and injects React/FlexSearch globals shims so externals resolve from `window.*` in the browser.

### Search Results Grid

- `SearchResults` accepts `layout` prop: `'grid'` (default) or `'list'`.
- `'grid'` uses a new `Grid` component (Masonry) from `@nulib/canopy/ui`, implemented with `react-masonry-css` and scoped CSS.
- Keep `react-masonry-css` external in the UI build so the search runtime can bundle/transform it alongside the React shims, preventing dynamic `require('react')` at runtime.

**Troubleshooting**
- Dynamic require error: if the browser console shows “Dynamic require of 'react' is not supported”, ensure the UI browser build marks `react`, `react-dom`, `react-dom/client`, `react-masonry-css`, and `flexsearch` as externals. The search runtime bundles client code and shims these to browser globals.
- SSR import safety: the server must import `@nulib/canopy/ui/server` (not the browser entry) when rendering MDX to avoid loading browser‑only components during SSR.
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
  - Loads `./search-index.json` (compact dataset) and indexes it through `packages/app/lib/search/engine.js`, the one module that knows FlexSearch (0.8; title + metadata values + flattened summary text; a word found by its beginning, case and accents folded). When `search-index-annotations.json` is present it is fetched, merged by `id`, and the annotation text is appended to the FlexSearch source. Display data continues to hydrate from `./search-records.json` for thumbnails, hrefs, and other UI extras. The built index is kept in the visitor's IndexedDB, by engine and version. The header's field suggests from the same engine, loaded the first time the field is used (`site/scripts/canopy-search-engine.js`).
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
- Stage and build a template from this checkout: `node packages/helpers/template/preview-template.js --source packages/helpers/template --build`

## Release and Template Workflow

- Strategy: releases are published via Changesets, `@nulib/canopy` and `@canopy-iiif/app` together at one version (`.changeset/config.json`, `fixed`); only after a successful publish does the workflow prepare and force‑push a clean template to `nulib-ds/canopy-template`.
- Prereleases, when one is wanted: in Changesets' pre mode (`npm run changeset -- pre enter next`, `.changeset/pre.json`), versions are `x.y.z-next.N`, published on npm's `next` tag and marked as prereleases on GitHub; the template jobs skip them. `npm run changeset -- pre exit` before the release itself. 2.x had none (Mat, 2026-11-17).
- Trigger: `.github/workflows/release-and-template.yml` runs on `push` to `main` (and can be dispatched manually). It uses `changesets/action` to publish and exposes whether a release occurred; the template push runs only when a publish happened.
- What it does:
  - Copies the repo into a disposable staging directory (default `.template-build/`, override with `TEMPLATE_OUT_DIR`), excluding dev-only paths (e.g., `.git`, `node_modules`, `packages`, `.cache`, `.changeset`, template workflows, agent docs).
  - Rewrites `package.json` inside the staging directory (`templatePackageJson` in `prepare-template.js`): no workspaces, one Canopy dependency (the just-published `@nulib/canopy`) beside React and React DOM, and `build`/`dev` scripts that run `canopy build` and `canopy dev`.
  - Patches the Pages deploy workflow in the template to inline the build verify step (no helpers package there).
  - Force‑pushes the result to `main` of `nulib-ds/canopy-template` (plus `nulib-ds/canopy-template-i18n` for the bilingual variant and `nulib-ds/canopy-template-northwestern` for the Northwestern-branded variant) as one commit named for the Canopy version it ships, `Canopy 2.0.2`, with no history: each release starts the template's history over (`push-template.js`, `templateCommitMessage`). A template's commit is the exception to the commit message rule above.
- Template expectations:
  - The generated template consumes the published `@nulib/canopy` package; it does not include the monorepo `packages/` directory.
  - `packages/helpers` is omitted from the template; template automation reuses the verified workflows committed to this repo.
  - Root `package.json` in the template is rewritten without workspaces and with pinned semver dependencies; `.github/workflows` are pared down so they reference the published package only.
- Keep template parity notes in `packages/helpers/AGENTS.md` when helper scripts change.
- Setup required:
  - On npmjs.com, a trusted publisher on `@nulib/canopy` and on `@canopy-iiif/app`: GitHub Actions, `nulib-ds/canopy`, `release-and-template.yml`, with **Allow npm publish** ticked (a trusted publisher may otherwise only `npm stage publish`). The release job publishes with that identity (`id-token: write`) and no npm token (CONTRIBUTING.md, "Publishing to npm").
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
  5) Add per-type result renderers in `@nulib/canopy/ui` with sensible fallbacks.
