# Canopy Template – AGENT Field Guide

> Use this document when assisting end users of the Canopy template. Focus on actionable guidance, surface gaps, and keep responses grounded in the files that ship in the template repo.

## 1. Mission & Success Criteria
- Help authors customize their Canopy deployment without touching unpublished monorepo internals.
- Cite the files the template actually ships so users can trace every recommendation.
- Prefer documented patterns; when unsure, gather context and open an upstream issue rather than guessing.
- Build/dev commands that touch IIIF endpoints (`npm run dev`, `npm run build`) must run with network access enabled.

## 2. Quick Start Checks
1. Require Node 18+ (use `nvm use` if `.nvmrc` exists) and install dependencies with `npm install`.
2. `npm run dev` runs the MDX/IIIF builder plus the preview server on port 5001; `npm run build` emits a production-ready static site into `site/`.
3. `npm test` only prints a placeholder; let users know automated tests are not bundled yet.
4. Never edit `site/` manually—it's a build artifact that is overwritten.

## 3. Project Layout Primer
- `app/` — Tailwind v4 entrypoint, runtime scripts, and `app/scripts/canopy-build.mjs` (single entry for `dev` + `build`).
- `assets/` — copied verbatim into `site/` during builds and watched during `dev` for instant reloads.
- `content/` — MDX pages, optional `_app.mdx` wrapper, and per-directory `_layout.mdx` scaffolds.
- `packages/app/ui` — UI runtime that templates import via `@canopy-iiif/app/ui` (browser) or `@canopy-iiif/app/ui/server` (SSR-safe MDX components).
- `packages/app/lib` — builder + hydration runtimes; end users rarely edit this, but AGENTS may need to explain behaviors (e.g., hydration data attributes, IIIF cache management).
- `.cache/iiif/` — fetched manifest cache (delete to refetch).
- `site/` — generated output.

## 4. Configuration Surfaces
### 4.1 `canopy.yml`
- `title` — site-wide fallback title.
- `collection` / `manifest` — IIIF sources. Accept a string or array; URIs must respond with Presentation 2/3 JSON.
- `metadata` — ordered list of manifest fields to promote as facets/labels inside IIIF components.
- `featured` — manifest IDs for `<Interstitials.Hero />` rotations.
- `theme` — Radix palettes and appearance for the generated CSS variables (`appearance`, `accentColor`, `grayColor`).
- `basePath` is inferred from `CANOPY_BASE_PATH` / `CANOPY_BASE_URL` (env vars) when deploying under a subdirectory.

### 4.2 Frontmatter & Layouts
- Any MDX file may start with YAML frontmatter. Common keys: `title`, `description`, `lang`, `dir`, `type`, `theme`, custom props consumed by layouts.
- `_layout.mdx` inside a directory lets authors wrap all child pages, inject props (e.g., `props.manifest`) and set default frontmatter (e.g., `type: docs`).
- `content/_app.mdx` is an optional global wrapper—use it for global providers, scripts, or to set `<html lang>`.

### 4.3 Environment Variables
- `CANOPY_COLLECTION_URI` — fallback IIIF collection when `canopy.yml` omits `collection`.
- `CANOPY_FETCH_CONCURRENCY`, `CANOPY_CHUNK_SIZE` — tune how aggressively manifests are fetched.
- `CANOPY_THUMBNAIL_SIZE`, `CANOPY_THUMBNAILS_UNSAFE` — thumbnail selection strategy.
- `CANOPY_BASE_PATH`, `CANOPY_BASE_URL` — required when deploying under a subpath or alternate hostname.

## 5. Content Authoring Workflow
1. Global wrappers (`content/_app.mdx`) apply site-wide UI (headers, analytics, etc.).
2. Section wrappers (`content/<section>/_layout.mdx`) add local navigation, metadata, or design tokens per section.
3. Pages (`content/<section>/<page>.mdx`) can import any component exported from `@canopy-iiif/app/ui/server`.
4. Work pages require `content/works/_layout.mdx`; it receives `props.manifest` (normalized Presentation 3) for building narratives.
5. Components that hydrate on the client render SSR placeholders. Ensure `app/scripts/canopy-build.mjs` injects the corresponding runtime script (automatic when data attributes like `data-canopy-viewer` are present).

## 6. Component Reference
Hydrated components follow a shared pattern:
- SSR output writes a placeholder plus a `<script type="application/json">` payload.
- The builder detects `data-canopy-*` attributes and injects the needed runtime under `site/scripts/` (React is injected globally via `site/scripts/react-globals.js`).
- Avoid bundling React yourself; rely on the shims configured in the UI build.

### 6.1 IIIF Media Wrappers (`packages/app/ui/src/iiif/`)
- `HelloWorld` — diagnostic stub for verifying MDX imports. Use case: confirm build wiring or demo the component pipeline without pulling IIIF data.
- `Viewer` (`Viewer.jsx`) — SSR-safe wrapper for `@samvera/clover-iiif/viewer`. Supports `iiifContent`, `options`, and merges defaults (no download badge). Hydrates via `site/canopy-viewer.js` and `data-canopy-viewer`. Use case: embed a full Clover viewer on work pages or editorial features.
- `Slider` (`Slider.jsx`) — wraps `@samvera/clover-iiif/slider`, normalizes options with `sliderOptions.js`, and hydrates via `data-canopy-slider` + `site/canopy-slider.js`. Use case: create horizontal IIIF carousels (e.g., featured works) outside of the automated RelatedItems component.
- `Scroll` (`Scroll.jsx`) — lazy-loads `@samvera/clover-iiif/scroll`, yielding a scrollable narrative of canvases. Hydrates via `data-canopy-scroll` in the viewer runtime entry. Use case: present tall storytelling experiences where visitors scroll through canvases sequentially.
- `Image` (`Image.jsx`) — renders a static hero image pulled from a manifest via `@samvera/clover-iiif/image`. Accepts `height`, `backgroundColor`, and optional `caption`. Use case: drop a single IIIF canvas into MDX as a decorative figure or callout.
- `ImageStory` (`ImageStory.jsx`) — mounts Cogapp’s Storiiies viewer. Props: `iiifContent`, `disablePanAndZoom`, `pointOfInterestSvgUrl`, `viewerOptions`, `height`. Hydrated by `site/canopy-image-story.js`. Use case: create linear, annotation-driven narratives that highlight regions of an image (e.g., guided tours).
- `RelatedItems` (`MdxRelatedItems.jsx`) — placeholder feeding `site/canopy-related-items.js`, which looks up metadata facets and renders clover sliders per facet. Props mirror the MDX component API (`top`, `iiifContent`, `random`). Use case: surface automated “more like this” sliders on home/works pages using indexed metadata.
- `Slider`, `Scroll`, `Image`, and `Viewer` share the runtime defined in `packages/app/lib/components/viewer-runtime-entry.js`.
- `ImageStory` uses external CSS/JS (loaded on demand). Mention this when users deploy with strict CSP.
- IIIF primitives (`ManifestPrimitives.jsx`): `Label`, `Metadata`, `RequiredStatement`, `Summary` sanitize internationalized strings, emit facet links, and respect `CANOPY_BASE_PATH`. `Id.jsx` renders a manifest ID block with a customizable heading. Use case: expose structured manifest fields inline without hydrating heavy components.

### 6.2 Interstitials (`packages/app/ui/src/interstitials/`)
- `Interstitials.Hero` — hero carousel fed by `featured` entries in `canopy.yml`. Props: `height`, `item`, `index`, `random`, `transition`, `headline`, `description`, `links`, `background` (`theme`|`transparent`), `variant` (`featured` or `breadcrumb`). Uses `computeHeroHeightStyle` from `hero-utils.js`. Hydration script: `site/canopy-hero-slider.js`. Use case: rotate highlighted manifests or contextual breadcrumbs on landing pages.

### 6.3 Layout, Navigation, and Utility Components (`packages/app/ui/src/layout/`)
- `Layout` — page shell that wires headings into a collapsible/floating table of contents, renders section navigation, and injects sticky scripts (content navigation toggle, observers). Accepts `sidebar`, `contentNavigation`, `headings`, etc. Use case: build documentation-style layouts with automatic sidebars/Tables of Contents.
- `SubNavigation` — renders section trees using `navigationHelpers.buildNavigationForFile`. Accepts `navigation`, `page`, `current`, `heading`, `ariaLabel`. Use case: insert contextual navigation for any directory tree (docs hub, microsite, etc.).
- `CanopyHeader` — responsive header with brand, nav modal toggles, and optional controls. Uses `NavigationTree`, `CanopyModal`, `LanguageToggle`, and handles body scroll locking via embedded scripts. Use case: ship an accessible site chrome without crafting JS yourself.
- `CanopyFooter` — wraps footer content with consistent padding. Use case: keep footer content consistent across MDX pages.
- `LanguageToggle` — reads `site.languageToggle` from page context and builds select/list controls for locale switching (`languageToggleShared.jsx`). Props: `languageToggle`, `page`, `variant`, `control`, `showLabel`. Use case: expose per-page locale switches tied to the navigation metadata.
- `CanopyBrand` — renders the logotype link. Props: `label`, `href`, `Logo` component, `labelId` for accessibility. Use case: drop brand marks in headers/footers without duplicating markup.
- `CanopyModal` — generic modal used by the header and custom overlays. Props: `variant`, `label`, `logo`, `closeLabel`, `onClose`, `open`, `padded`. Use case: craft bespoke menu/search/CTA overlays reusing the existing animation + accessibility wiring.
- `Container` — max-width wrapper (`variant: 'content' | 'wide'`) with built-in horizontal padding. Use case: constrain MDX sections to readable widths.
- `Button` / `ButtonWrapper` — anchor buttons with `primary`/`secondary` styling and grouped layouts (text blurb + action stack). Use case: align CTA clusters across pages without reinventing spacing.
- `Card` — responsive card with lazy-loaded images, aspect-ratio helpers, and caption support. Useful for linking to works or pages. Use case: build grid teasers, exhibition indices, or reference lists.
- `TeaserCard` — simplified card for listing items with optional thumbnails/metadata. Works with any `type` though it defaults to `work`. Use case: list search or related content inline when you don’t need the richer `Card` layout.
- `GoogleAnalytics` — inline helper that injects gtag loader + config script when `id` is provided. Use case: enable GA tracking via MDX without editing raw HTML.

### 6.4 Narrative & Content Components (`packages/app/ui/src/content/`)
- `ReferencedItems` — grid of manifest references taken from the page context or via props. Each entry becomes a `Card`. Show `emptyLabel` when no items exist. Use case: highlight curator-selected works related to the current page.
- `References` — displays “Referenced by” lists using `lib/components/referenced.js`. Provide `id` (manifest ID) or rely on the context `manifestId`. Use case: show backlinks (e.g., which exhibitions cite this work) for provenance context.
- `Index` — builds topical indices from `metadata-index.js`. Props include `label`, `limit`, `expandLabel`, `collapseLabel`. Emits facet links and toggles extra items when footnotes exceed `limit`. Use case: build alphabetical indices or taxonomy summaries that link into search filters.
- `Bibliography` — renders page-level footnotes (pulled from `lib/components/bibliography.js`) grouped by source page. Use case: publish scholarly notes for long-form narratives without hand-coding footnote markup.
- `Timeline` / `TimelinePoint` — build scrollytelling timelines. Use `<Timeline>` as a wrapper and nest `<TimelinePoint>` children with `title`, `date`/`timestamp`, `summary`, `highlight`, `side`, `iiifResources`, or `referencedManifests`. Hydration script reads `data-canopy-timeline` payload. Use case: plot historical milestones, exhibition chronology, or artist biographies.
- `Map` / `MapPoint` — create maps of referenced manifests or custom coordinates. `<Map>` accepts `referencedManifests`, `defaultZoom`, `tileUrl`, etc. `<MapPoint>` children specify `lat`, `lng`, `title`, `summary`, optional manifests (for auto thumbnails) and `children` rendered into the popup via SSR-to-string. Use case: visualize geographic provenance, itineraries, or field notes tied to manifests.
- `Gallery`, `GalleryItem`, `GalleryContent` — build modal galleries referencing manifests or static assets. `<Gallery>` wraps the modal and nav rails, `<GalleryItem>` defines clickable cards and corresponding modal panels, and `<GalleryContent>` renders additional descriptive blocks. Use case: create curated slideshows with deep-dive metadata and keyboard-accessible navigation.

### 6.5 Documentation & Theming Helpers (`packages/app/ui/src/docs/`)
- `DocsCodeBlock` — pretty code listings with optional filename header, copy button (`data-copy`), and highlight ranges (`data-highlight="1-3,5"`). Use case: document customization snippets in developer-facing pages.
- `DocsMarkdownTable` — wraps Markdown tables in a horizontally scrollable frame to avoid layout shifts. Use case: present wide comparison tables without breaking the layout.
- `CanopyDiagram` — static diagram describing the IIIF ingestion pipeline (handy for overview pages). Use case: illustrate how the builder fetches collections/manifests in marketing docs.
- `ThemeShowcase` — interactive palette explorer for the Tailwind design tokens. Props let you force `appearance`, `accentColor`, and `grayColor` to demonstrate theming changes. Use case: show stakeholders the available palettes when iterating on branding.

### 6.6 Project-Specific MDX Components (`app/components/*`)
- **IMPORTANT**: This folder is the canonical place for reusable JSX in templates. AGENTS should encourage users to add or modify components under `app/components/` instead of sprinkling bespoke React snippets directly inside `content/**/*.mdx` unless the user explicitly asks for an inline MDX-only tweak.
- Why build custom components?
  - Institutions routinely need bespoke UI (e.g., branded callouts, data visualizations, interactive maps) that the shared `@canopy-iiif/app/ui` set does not cover.
  - Creating SSR-safe components keeps builds fast and lets authors reuse them across MDX without copying markup.
  - Client-only components unlock integrations with third-party widgets (Knight Lab, charts, analytics) while preserving predictable hydration boundaries.
  - These source files live next to `app/styles/` and `app/scripts/`; they are bundled during the build, so authors can import local helpers, configs, or data from any relative path under `app/` without publishing a separate package.
- Entrypoint: `app/components/mdx.tsx` defines two exports:
  - `components` — map MDX component names to SSR-safe modules (rendered at build time). Example: `Example` → `./Example.tsx`.
  - `clientComponents` — map browser-only names to `.client.tsx` modules. The builder emits placeholders + hydration scripts automatically.
- SSR-safe example: `app/components/Example.tsx` shows a synchronous React component (`Example`) that accepts props directly from MDX (`<Example title="…">` … `</Example>`). Use this pattern when your UI only needs data passed via MDX/frontmatter and does not touch `window`/`document`.
- Browser-only example: `app/components/Example.client.tsx` demonstrates how to read `window.innerWidth` safely by running inside `useEffect`. Register it under `clientComponents` (e.g., `ExampleClient`) and call it from MDX like `<ExampleClient text="…" />`. The builder renders a placeholder server-side, then hydrates it once React is available in the browser.
- Advanced client component: `app/components/StoryMapJS.client.tsx` loads Knight Lab StoryMap via external CSS/JS, memoizes asset fetches, and cleans up on unmount. Reference it in MDX (`<StoryMapJS data="/assets/storymap.json" />`) to embed narrative maps sourced from site content.
- Author workflow:
  1. Create `MyComponent.tsx` (SSR-safe) or `MyComponent.client.tsx` (browser-only) in `app/components/`.
  2. Add an entry inside `components` or `clientComponents` within `app/components/mdx.tsx` (e.g., `MyCallout: './MyCallout.tsx'`).
  3. Import and use `<MyCallout variant="warning">` directly inside MDX files.
  4. For interactive widgets, keep DOM access inside effects and clean up listeners to avoid build-time crashes.
- Remind users that this folder is part of the template repo, so any newly created component automatically ships with the site and template consumers can extend it further.

## 7. IIIF Build & Cache
- Cache root: `.cache/iiif/`. `index.json` stores collection metadata, slug mappings, thumbnails; `manifests/<slug>.json` stores normalized manifests.
- Delete `.cache/iiif/` to force refetching before answering “why isn’t my manifest updating?” Always warn that the next build must run with network access.
- Thumbnail sizing depends on `CANOPY_THUMBNAIL_SIZE` / `CANOPY_THUMBNAILS_UNSAFE`; mention these when heroes or cards show low-res images.
- Manifests without thumbnails still generate work pages; components such as `ReferencedItems` gracefully skip missing thumbs but the hero slider may omit slides.

## 8. Assets & Deployment Pipeline
- `assets/` mirrors into `site/` (e.g., `assets/images/logo.svg` → `site/images/logo.svg`). Encourage users to keep large media there rather than in MDX directories.
- `npm run build` outputs everything under `site/`, ready for GitHub Pages, Netlify, S3, etc.
- Template automation (documented in `.github/workflows/*`) strips monorepo-only directories when publishing to the template repo, so remind users that packages under `packages/` are already compiled.

## 9. Theming & Design Tokens
- The build generates `--color-accent-*`, `--color-gray-*` and `--clover-*` variables from `canopy.yml` `theme` and places them first in the stylesheet. Overrides in `app/styles/custom.css` (inside `@layer properties`) win without `!important`.
- Tailwind v4 is configured in CSS, not a JS config: use `@theme`, `@theme inline`, `@utility`, `@plugin` and `@source` in `app/styles/index.css`. Tailwind's `*-gray-*` utilities follow the Canopy gray scale. A JS config only loads through `@config`.
- To customize colors/typography, override the tokens in `app/styles/custom.css` and rebuild. `ThemeShowcase` is a good sanity check component.
- Component-specific styles (e.g., slider, image story) live in `packages/app/ui/styles/components/`. Avoid editing the compiled CSS under `site/`.
- Encourage consistent spacing/typography by reusing `Container`, `Button`, `Card`, and other layout primitives.

## 10. Internationalization (i18n)
- Set `lang` and `dir` in frontmatter to override `<html lang>` per page or section.
- `LanguageToggle` pulls available translations from site context. Users must define translations in their page metadata (`site.languageToggle` inside navigation data) for the control to appear.
- Clover-based components display manifest-provided labels; instruct users to preprocess manifests if they need localized metadata beyond what IIIF already exposes.
- For MDX copy, create parallel directories (e.g., `content/es/…`) and use `_layout.mdx` to switch typography, direction, or call `LanguageToggle`.

## 11. Configuration for Advanced Users
- IIIF fetch tuning: high-latency collections may require smaller `CANOPY_CHUNK_SIZE` or higher `CANOPY_FETCH_CONCURRENCY` (set to `0` for “auto”).
- Featured hero tuning: `featured` IDs can be direct manifests or cached manifest slugs (`.cache/iiif/index.json`). Hero component accepts `variant="breadcrumb"` for simple, navigation-aware banners.
- Inject custom scripts/styles via `content/_app.mdx` or by placing files under `app/scripts/` and referencing them in MDX; keep the root tidy (no ad-hoc top-level `scripts/`).
- Analytics: drop `<GoogleAnalytics id="G-XXXX" />` in `_app.mdx` or a layout to keep tracking centralized.

## 12. Support Playbook for AGENTS
1. Identify the task category (content authoring, theming, IIIF ingestion, hydration/runtime, deployment) before editing.
2. Gather file references, cite relative paths + line numbers in responses, and gently remind users to rebuild after config changes.
3. Hydration bugs: confirm React globals are present (`site/scripts/react-globals.js`), externals (`react`, `react-dom`, `react-dom/client`, `react-masonry-css`) are excluded from browser bundles, and the relevant runtime script is being emitted.
4. IIIF issues: inspect `.cache/iiif/index.json` for missing manifests, confirm environment variables, and rerun builds with network access.
5. Documentation gaps: encourage users to open issues in `canopy-iiif/app` so maintainers can formalize workflows.

## 13. Appendix: Command Reference
- `npm install` — install dependencies.
- `npm run dev` — watch MDX + IIIF sources, rebuild on change, and sync `assets/`.
- `npm run build` — production build into `site/`.
- `npm test` — placeholder (returns success after printing a message).
- `npm run lint`, `npm run format` — optional scripts when ESLint/Prettier configs are present.

Use this skeleton as the canonical source when crafting answers for end users of the template repository. Keep responses concise, reference exact files, and escalate undocumented needs back to maintainers.
