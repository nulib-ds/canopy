App Package Agent Notes
=======================

Prime directive: WCAG 2.2 AA
----------------------------
- The package conforms to WCAG 2.2 at Level AA, and that outranks every note below. The rules are in `DESIGN.md` §0 beside this file; known failures are in the repository's `ACCESSIBILITY.md`.
- Release quality includes `npm run test:a11y`: a release never ships a new failure.

Mission
-------
- Represents the published workspace `@nulib/canopy` (`@canopy-iiif/app` until 2.0; that name is `packages/app-alias` now) that ships both builder logic and UI assets, and the `canopy` command.
- Coordinates the contract between SSR/build-time code in `lib/` and browser code in `ui/`.
- Owns release quality: tests, build scripts, release log data, and workspace metadata live here.

Structure at a Glance
---------------------
- `lib/`: Node-side builder and runtimes (see `packages/app/lib/AGENTS.md`).
- `ui/`: Browser bundle + SSR-safe entry (see `packages/app/ui/AGENTS.md`).
- `package.json`: Publishes `lib/` as CommonJS and exports UI entrypoints; `prepublishOnly` builds UI.
- Release notes: maintained via `content/docs/releases/releases.data.mjs` and surfaced in the docs + workflows.

Active Cleanup Goals
--------------------
1. Clarify the seam between `lib/` and `ui/` so each bundle only owns its layer (reduce cross-import drift).
2. Capture open work for the search experience (index expansion, result rendering) and align with `lib/search` and UI consumers.
3. Establish a baseline test + lint plan per workspace; document expected commands before we add automation.
4. Audit package exports to ensure only documented entry points are surfaced and tree-shaking remains safe.

Current Focus
-------------
- Search roadmap: confirm how MDX page indexing will feed into `lib/build` and ensure UI renders new record types without regressions; coordinate with `packages/app/lib/AGENTS.md#active-cleanup-goals`.
- Build + release confidence: list missing automated checks (lint, type coverage) and decide where to stage them before wiring into CI.
- Packaging hygiene: review `exports` map against actual consumers; flag any deprecated paths for removal and schedule migration notes.
- Documentation debt: capture knowledge about environment variables (e.g., `CANOPY_BASE_PATH`, `CANOPY_COLLECTION_URI`) so downstream workspaces do not duplicate it.

Risks & Watchpoints
-------------------
- UI build drift: if UI bundles change externals without updating `lib` shims, runtime hydration breaks. Mirror changes immediately in the lib agent.
- Release pipeline: `prepublishOnly` must stay fast enough for Changesets publish; track any long-running build steps and consider caching.
- Duplicate state: avoid introducing overlapping configuration between `lib/cli.js` (the `canopy` command), `lib/orchestrator.js` and `lib/build`; note any duplication for consolidation.

Session Checklist
-----------------
- Skim `packages/AGENTS.md` for repo-wide themes before diving into subdirectories.
- Update `lib/` and `ui/` agent logs with current findings; record TODOs using `// TODO: see ...` in code when helpful.
- Note verification steps run this session (tests/builds) and any gaps.

Logbook Template
----------------
- Date / Session owner
- Areas touched (lib/ui/helpers) and relevant PR/branch links
- Decisions captured (reference ADR or section)
- Follow-ups assigned (copy into Active Cleanup Goals or per-directory lists)

Clover 4 spike (2.x Phase 1)
----------------------------
2026-11-13 / claude. A throwaway copy of this repository with `@nulib/clover` 4.10.0 in `@canopy-iiif/app` (Clover 3 removed from every import), built through the accessibility fixture (`npm run test:a11y`, four template builds). Nothing of it is in this tree; these are its findings for Phase 2.

- **Bundling (`lib/build/mdx.js`).**
  - All three React shims (the Clover runtimes', the timeline's, the map's) hard-code React's names. Clover 4 also imports `lazy` and `Suspense`, so every runtime that reaches Clover fails to bundle. That includes the timeline and map runtimes: esbuild parses the targets of `ui/dist`'s dynamic `import()`s even where tree shaking later drops them.
  - Fix: build one shim from `Object.keys(require('react'))`, used by all three.
  - `three` is never reached. MapLibre lands in lazy chunks that no fixture page loads. Clover's dist has no `.css` imports, so `createSliderCssInlinePlugin` sees none.
- **Styles.**
  - Load `@nulib/clover/styles.css` from the top of `ui/styles/index.css` (written by `build-ui.mjs`). Every template already imports that file, so sites need no edit.
  - `lib/build/theme-tokens.js` must declare `@layer theme, properties, base, clover, components, utilities;`: Clover above Tailwind's preflight, below Canopy's components and utilities.
  - Load `templates.css` only where the Document or Gallery template is used. Without it, Document's sidebar toggle is 16px (2.5.8).
  - Remove the global reset in `ui/styles/settings/_effects.scss` (ACCESSIBILITY.md R1). With it, no Clover 4 viewport shows focus; without it, the failure goes.
- **Props.**
  - A translation module (`toViewerProps`, `toItemsProps`, `toCanvasProps`) used by both runtimes and the UI wrappers renders every fixture page with no console errors and no failed requests.
  - `Image`'s `alt` reaches the Canvas as its name.
  - Primitives render on the server from `@nulib/clover` in about 10ms: no `div[role=group]`, a `lang` on each value, `clover-*` classes, and a `clover-read-more` wrapper around Summary. Update `tests/unit/ui/clover-wrappers.test.js` to that markup on purpose.
- **Accessibility.**
  - Clover 3's register entries (C6–C9, C18) all clear.
  - With R1 removed and the stylesheets loaded, the fixture's only failure is C1 (the hero carousel).
- **Weight** (JavaScript a page loads, gzip, default template):
  - work page 1118 → 577 KB;
  - components page 1517 → 886 KB;
  - search unchanged;
  - homepage 427 → 559 KB.
  - The homepage grows because `Items` imported from Clover's main entry drags in its re-exports under esbuild's code splitting: 186 KB loaded, where `Items` alone is about 51 KB. A per-part entry (`@nulib/clover/items`) caps it at 88 KB. Fix this in Clover's exports rather than with a second bundler.
- **Content state.**
  - Clover 4 opens an encoded Annotation (`motivation: contentState`).
  - It does not open the shorter forms IIIF Content State 1.0 allows: a bare Manifest reference draws nothing, and a Canvas with `partOf` draws an empty Canvas, neither making a request.
  - `content/docs/user-guides/share-content.mdx` teaches the Canvas form, so Clover should accept both.

Clover changes for 2.x
----------------------
2026-11-13 / claude. Made in nulib-ds/clover with tests, docs and changelog entries: nulib-ds/clover#427, merged 2026-11-13 and released in `@nulib/clover` 4.10.2 (2026-11-14). Checked against the spike built on that Clover.

- **Content state's shorter forms.** A target given on its own (a Manifest or Collection by `id` and `type`, a Canvas with `partOf`, a Range) opens what it names, as JSON, encoded or answered by a URL. The spike's content-state page now draws all three forms, the docs' Canvas form at its Canvas.
- **An entry a part at a time.** `@nulib/clover/viewer`, `/canvas`, `/timeline`, `/scene`, `/items` and `/primitives` export `@nulib/clover`'s own modules, so esbuild no longer loads the Default template's whole set up front. Phase 2 imports each runtime's part from its entry: `Items` for Slider and RelatedItems, `Canvas` for Image, the Viewer from `/viewer` with `Default` or `Document` from `/templates`, and the primitives (SSR wrappers) from `/primitives`.
- **`@nulib/clover/helpers`.** Clover's IIIF helpers, with no React and no `"use client"`, for `lib/` at build time.
- **`perView` on Items.** Keeps `breakpoints.slidesPerView`: the runtime picks the breakpoint for the window's width (min-width keys, 1 below the smallest) and passes `perView`, and that breakpoint's `spaceBetween` as `--clover-items-gap`. Each item takes its share of the row in a square cell, contained.
- **`panelToggle={false}` on Default.** Keeps `informationPanel.renderToggle: false` with `open: true`: no toggle while the panel is open beside the Body. Where the panel is shut, or floats over the Body (narrow layouts), the toggle still shows, so the panel is never out of reach (1.4.10).
- **`header="collection"` on Default.** Keeps Clover 3's collection browser under `showTitle: false`: the Collection's line alone, and no header for a Manifest alone (below, "A Collection with Canopy's defaults").
- **A Clover focus fix found on the way.** Widening the layout with focus on a pane's toggle dropped focus to the page (2.4.3); focus now follows the toggle.
- **Weight**, gzip, the default template's fixture (4.10.0 through its main entry → the new entries):
  - homepage 559 → 434 KB (130 → 53 files; Canopy 1.x shipped 427 KB);
  - work page 577 → 522 KB;
  - components page 886 → 834 KB.
  - Under esbuild alone, up front: `Items` 126.8 → 24.9 kB, `Canvas` 127.3 → 51.0 kB, the Viewer shell 127.0 → 0.2 kB, the primitives 126.8 → 6.9 kB, three helpers 126.8 → 1.0 kB.

Clover 4 swap (2.x Phase 2)
---------------------------
2026-11-13 / claude. `@nulib/clover` in place of `@samvera/clover-iiif`, in this tree, uncommitted.

- **The dependency.** `@nulib/clover` `~4.10.2` is a dependency of @canopy-iiif/app; sites no longer install it. 4.10.2's files are the build Phase 2 was tested on, byte for byte, but for `version`. The range takes Clover's patches only: a minor release can change class names and markup, which `version-parity.css` and the accessibility checks depend on, so Canopy moves to a new minor on purpose, after `npm test` and `npm run test:a11y` pass on it (2026-11-14).
- **Checked on 4.10.2** (2026-11-14): `npm test` (261 tests), `npm run test:a11y` (C1 alone) and `npm run lint:a11y` pass. On the docs site, built with live IIIF, the Viewer, Image, Image Story, Slider and Scroll pages have no findings, and the Viewer's Collection line draws with its thumbnails (ACCESSIBILITY.md C16, fixed).
- **Runtimes and wrappers.** Each draws its part from its own entry (`@nulib/clover/viewer` with `/templates`, `/items`, `/canvas`, `/primitives`) through the factories in `ui/src/iiif/clover-compat.js`, which the runtimes import from `ui/dist/index.mjs`. The UI bundle imports Clover only dynamically: it does not split, so a static import would load Clover into every runtime.
- **1.x props kept.** `clover-compat.js` translates Clover 3's Viewer, Slider, Image and Scroll options (`tests/unit/ui/clover-compat.test.js`). An option Clover 4 cannot carry out is still accepted, and the build names it once (`noticeUnsupported`); the list is `VIEWER_UNSUPPORTED`, for Mat to agree to.
- **A Collection with Canopy's defaults.** Clover 3 drew its collection browser whatever `showTitle` said; `showTitle: false` maps to Default's `header="collection"` (Clover 4.10.2): the Collection's line alone, its label and the members' pager, and no header for a Manifest alone. Checked on the docs' Viewer page (the lithographs Collection: "lithographs", 1 / 21).
- **Open.** Scroll is Clover's Document template for now; its options have no effect. A text-focused reader composed from Clover's parts, after Document, is to replace it (Mat, 2026-11-13: "we can come back to that").
- **Styles.** Clover's stylesheets load first in `ui/styles/index.css`, in `@layer clover`. Canopy 1.x's rules for Clover 3's classes carry over to Clover 4's in `ui/styles/version-parity.css` (Mat, 2026-11-13), and the Viewer's container keeps `clover-viewer` for sites' 1.x styles. The global reset is gone (ACCESSIBILITY.md R1); Stitches' `--colors-*` with it.
- **IIIF.** `@iiif/parser` 4 is a dependency, its upgrader the build's Presentation 2 path; `@iiif/helpers` is gone, unsafe thumbnails taking Clover's helpers (`@nulib/clover/helpers`).

Theme foundation (2.x Phase 3)
------------------------------
2026-11-14 / claude. In this tree, uncommitted. The rules are in `DESIGN.md` §1.

- **Decisions (Mat, 2026-11-14).** A site that names no `accentColor` keeps indigo (until 2.0.2: Mat, 2026-11-18, "make default colors no longer indigo. make it gold and sand." The defaults are `DEFAULT_ACCENT` and `DEFAULT_GRAY` in `ui/theme.js`, and the docs and default template name them too); Clover's `#0f62fe` can go into the v2 templates with the new look (Phase 5). `appearance: auto` is added, and `light` stays the default.
- **Text steps held by their ratio (ACCESSIBILITY.md C4).** `ui/theme-color.js` holds the math: WCAG contrast, mixing in OKLab, `ensureContrast`. `toTailwindScale(name, { appearance, role })` in `ui/theme-palette.js` moves level 800 of a role toward black (white, in dark mode) only as far as 4.5:1 needs. An accent's is checked against every palette's level 50 and its own; a gray's against its own. Without `role` a scale is Radix's own, as before. `theme.js` and the docs' `ThemeShowcase` pass the role.
- **The primary hover (C5).** `--color-accent-hover` is `color-mix(in oklab, var(--color-accent-default) 80%, #000)` (`#fff` in dark mode), so a site's own `--color-accent-default` reaches it. Only a fill already at black or white gets a hex that moves toward its label (`accentHover`). The Northwestern template sets Purple 90, its hover before.
- **Hex accents.** `accentColor: "#0f62fe"` (`normalizeAccentName`): step 9 is the hex, 1 to 8 are mixed toward the page, 10 to 12 toward black (white, in dark mode).
- **`appearance: auto`.**
  - `appearanceVariablesToCss` emits the light tokens, then the dark ones under `@media (prefers-color-scheme: dark) { :root:not(.light) }` and on `:root.dark`.
  - `lib/build/appearance.js` is the inline head script. `htmlShell` puts it ahead of the stylesheet and marks `<html data-appearance="auto">`.
  - `readSiteMetadata()` carries `appearance` into the page context, where `CanopyFooter` draws `AppearanceToggle` (new, exported from both UI entries). Its words are `common.appearance` in `locale.yml` (English and the i18n template's Spanish), and `default-locale.js` is regenerated.
- **Components on checked tokens.** The map popups' links (C24), the search filters' buttons and focus (C25), the search form's focused edge, icon and checkboxes (C26), and the search submit's focus (C27): all were found reading the code for accent steps drawn as text or state.
- **The header's compact dialogs (C28).** Opening the search dialog left focus behind it, neither dialog gave focus back, and Tab left them. Found by hand at 1024px; `CanopyHeader.jsx`'s script is fixed, and `tests/a11y/specs/dialogs.spec.mjs` checks both dialogs at 800px.
- **Found on the docs site's recheck.** The Theme page's "Complex selectors" example taught a crimson button at 4.21:1 (C17, filed as C5's but its own); it is `#cb1d63` now. Maps showed no focus (C29); `_map.scss` gives every template the frame ring the Northwestern template had (C19).
- **Tests.**
  - `tests/unit/a11y/contrast.test.js` measures what the build emits, for every palette and eight hex accents, and has no known failures.
  - `tests/unit/ui/theme.test.js` covers hex accents, `auto` and the hover token.
  - The fixture builds a `template-auto` site, checked under a dark system, with `specs/appearance.spec.mjs`.
- **Checked** (2026-11-14): `npm test` (266 tests in 25 suites), `npm run test:a11y` (213 checks on five sites, `template-auto` among them; C1 alone), `npm run lint:a11y`, and the docs site built with live IIIF: its home, Theme, Search, Canopy, Map, Viewer, Image, Image Story, Slider and Scroll pages (C1 alone, on the home page).
- **Left for the 2.x look (Phase 5), on purpose.** Google Sans Flex, and the token values that change how sites look: radii, shadows, type, surfaces, a focus ring token and the brush stroke. They come with the components and templates that use them. Until then nothing reads them, and their `url()` paths and base-path handling can only be tested with a template that loads them.

The carousel (2.x Phase 4)
--------------------------
2026-11-14 / claude. In this tree, uncommitted. `<Interstitials.Hero />` keeps every prop.

- **Hand-rolled, after WAI-ARIA APG's auto-rotating carousel** (`lib/components/hero-slider-runtime.js`), in place of Embla; `embla-carousel` is gone from the root `package.json`.
  - One slide shows at a time; the rest are `hidden`.
  - Rotation runs every 6 seconds. It holds while the pointer is over the carousel, and stops for good on keyboard focus (`:focus-visible`, so a click's focus does not), on previous, next, a dot or a swipe (touch and pen).
  - It never starts under `prefers-reduced-motion: reduce`.
  - The slides are `aria-live="off"` while rotating and polite once stopped.
- **The server renders all of it** (`Hero.jsx`).
  - The `[data-canopy-hero-carousel]` region holds, in reading order: the rotation control (it carries both labels as `data-label-stop` and `data-label-start`), the slides, previous and next, and the dots.
  - The controls are `hidden` until the runtime shows them, so without a script the first slide shows alone.
  - The region is named "Featured content" now, not the hero's headline, which is the page's `h1`.
- **Words** (ACCESSIBILITY.md C3): `common.carousel` and `common.actions.view_work` in `locale.yml`, role descriptions included, in English and the i18n template's Spanish.
- **Styles.** The media group is a grid: the rotation control sits over the stage's corner, and the dots go below it. Controls draw their focus inside, as the hero clips. The dots are `--color-gray-muted`, with the current one in the accent and larger (C30).
- **Checks.**
  - `tests/a11y/specs/motion.spec.mjs` now tests behavior on a page clock: does the carousel advance, does its own first control stop it, and is rotation announced. It no longer looks for a button's English name.
  - `specs/carousel.spec.mjs` covers hover, keyboard focus, the buttons, reduced motion, hidden slides and both languages.
  - Playwright 1.56 takes `reducedMotion` only as a context option (`page.emulateMedia`), not through `test.use`.
- **No known failures are left** in `tests/a11y/known-failures.mjs` (C1 was the last).
- **No rotation since 2.0.2** (2026-11-18, Mat, of the pause control: "remove this functionality"). The hero moves only when a visitor moves it (previous, next, a slide's button, a swipe), so 2.2.2 leaves it nothing to pause. The rotation control, its words (`common.carousel.stop` and `start`) and its styles are gone; the slides are polite from the start. `specs/carousel.spec.mjs` checks that nothing moves on its own, and `specs/motion.spec.mjs` still fails any carousel that advances with no pause first.

The new look (2.x Phase 6)
--------------------------
2026-11-15 / claude. In this tree, uncommitted. After Clover's docs (nulib-ds/clover, `docs/styles/tokens.css`), as proposed when 2.x was planned. The rules are in `DESIGN.md` §1.

- **Tokens** (`ui/styles/settings/_tokens.scss`, in `@layer properties`): Google Sans Flex and two weights, the type sizes, radii 4 to 16px, surfaces, shadows, the focus ring (`settings/_focus.scss`'s `focus-ring()`), the black materials, the brush stroke (`--canopy-swoosh`) and `--canopy-sticky-top`, with the values that differ in the dark under `:root.dark` and `auto`'s media query. Canopy's prefix, as Tailwind owns the bare `--text-*`, `--radius-*` and `--shadow-*`.
- **Text held on surfaces.** `theme-palette.js` holds the gray's text step at 4.5:1 on its page, `--canopy-surface` and `--canopy-surface-raised`, and the accent's on every gray's page and raised surface. Ten bright grays' muted text darkens a shade in light mode (amber `#ab6400` → `#a56000`); a `#000000` accent lightens in dark. The contrast test adds `body-`/`muted-on-surface`, `-on-raised`, `accent-on-raised`, `control-edge`, and the band's and code's colors on black.
- **The font** (`ui/fonts/`, OFL, `OFL.txt` beside it; from Clover's docs, latin and latin-ext, 53 KB). `lib/build/fonts.js` copies it to `site/styles/fonts/` and declares its faces in the block the build writes atop the stylesheet, where a relative `url()` holds under any base path; Tailwind would rewrite one in the UI stylesheet. `ui/fonts/**` is in the package's `files`.
- **Type.** Headings bold, `--canopy-font-display`, −0.02em, as element rules in `@layer base` after Tailwind's preflight (which sets their weight to `inherit`). A site's own `app/styles` base rules come later and win, so 1.x sites keep their fonts; components set no family.
- **A serif for reading** (Mat, 2026-11-15: "mix in a serif in addition to the sans. serif for body content. think magazine."; then "we should have one winner"). Source Serif 4 (Adobe, OFL, Reserved Font Name "Source"; Google Fonts' latin and latin-ext files, upright and italic, 400 to 700, unmodified, 189 KB) is `--font-serif` and `--canopy-font-body`: the classless paragraphs, lists and quotes Markdown writes inside `main` (not inside a Clover part), at `--canopy-text-body` and `--canopy-measure`; ledes, the hero's standfirst and `<Feature>`'s words. Newsreader was tried first and read too light beside the headlines on a marketing page; a sheet of the four candidates is `.cache/visual/compare/body-faces.png`. Buttons keep `--default-font-family` wherever they sit. Northwestern sets `--canopy-font-body: var(--font-sans)` and `--canopy-text-body: 1rem`.
- **Chrome.**
  - `CanopyHeader`: 64px, solid, a hairline under it; sticky where the window is at least 36rem tall, its height measured by its script into `--canopy-header-height` for the scroll padding and the content navigation. The search field is a pill with a 3:1 edge and a ⌘K (Ctrl K) hint the search runtime fills in, the input's `aria-keyshortcuts` saying it. The brand draws the brush stroke under its name on hover and focus.
  - `CanopyFooter`: Clover's layout. New props, all optional: `logo`, `title`, `description`, `links`, `brandHref`. Its children show as in 1.x; the links and the appearance switch sit in a row under a hairline.
- **Components.** `Interstitials.Hero` takes `variant="centered"` (the featured hero's markup plus `canopy-interstitial--hero-centered`; the carousel's runtime and checks unchanged) and nodes in `headline`. New: `Swoosh`, `Band` (black; `<Button>`s in it take its colors, no new variant) and `Feature` (eyebrow, `headingLevel`, lede, in an `hgroup`). Restyled: buttons, cards, article cards, search field, suggestions, filters and tabs, the dialogs, the docs navigation (bold groups, the current page bold in the accent), code blocks (on black, near-white; classes in place of inline styles), the work page (the Viewer in a raised card), the slider's cards (`version-parity.css` now draws them with the card tokens: the 1.x hairline, square, where a site sets them flat).
- **Templates.** The root `app/styles/index.css` drops Fraunces and the 1.x base type; the docs' and templates' `_app.mdx` drop Google Fonts and use the footer's new props. The default template's `canopy.yml` (the repository's, which the docs share) takes Clover's `#0f62fe`; the fixture now reads it for the default template. The default and i18n homepages use the centered hero with a `<Swoosh>`; the docs homepage the centered hero and a `<Band>`. Northwestern sets the radius and shadow tokens to nothing and keeps its header unsticky (three rows would cover too much); its `DESIGN.md` says so.
- **Found and fixed on the way** (ACCESSIBILITY.md): C31 (search placeholders, 1.4.3, Northwestern's Purple 30 among them), C32 (the suggestions' focus), C33 (a link inside a search result's link, in English), C34 (code blocks' copy words in English), C35 (the filters' value field edge), C36 (the dialogs' close button focus); R3 resolved.
- **A Phase 2 regression, fixed.** The dev server compiles the UI's Sass itself (`dev.js`) and wrote `ui/styles/index.css` without the Clover imports `build-ui.mjs` adds, so in `npm run dev` every Clover part lost its styles. Both write the same header now (`lib/build/ui-styles.js`). Built sites and the checks never used that path.
- **One type system** (Mat, 2026-11-15: "normalize font size/weights. add style guide page under Theme. use this to define the rest of the app/look/feel."; "we currently have too much inconsistency and text treatments that do not feel cohesive."). The UI's stylesheets used 36 sizes and four weights (300, 400, 500, 700). Now eleven text styles (`ui/styles/settings/_type.scss`: display, title, h2, h3, h4, lede, body, ui, ui-sm, label, code) on one size scale and two weights; every component takes one (`@include type.<style>`), Clover's parity rules take the tokens, and `tests/unit/ui/type-scale.test.js` fails on anything written by hand. The docs' Style guide (`content/docs/theme/style-guide.mdx`, its specimens in `packages/helpers/docs/components/StyleGuide.jsx`) draws each style, color, shape and step of space, its numbers read from the page; it is the definition. Each style is also a class for authors (`.canopy-type-<style>`), and the golden steps are tokens (`--canopy-space-*`). Weights at 300 and 500 went to 400 or 700 by role; uppercase is the label style's alone.
- **Tests.** `tests/unit/ui/new-look.test.js` (the new components, the footer's props beside its 1.x children, the centered hero), `tests/unit/build/fonts.test.js` (the faces, their license, relative URLs, the copy, the shared stylesheet header), and `tests/a11y/specs/forced-colors.spec.mjs`, a keyboard walk under forced colors on the default and Northwestern templates.
- **Checked** (2026-11-15): `npm test` (277 tests in 27 suites); `npm run test:a11y` (267 checks on five sites, no findings); `npm run lint:a11y`; the docs site built with live IIIF, its home, Docs, Theme, Markdown, Search and About pages and the Viewer, Slider, Search, Card and components index pages (58 checks, no findings).
- **Not done here.** The centered hero has no search field of its own: the header's is on every page and ⌘K reaches it, and a second search landmark would need its own name. Visual snapshots are not a test yet; before and after screenshots of every template are in `.cache/visual/` (ignored).

Search (2.x Phase 7)
--------------------
2026-11-16 / claude. In this tree, uncommitted. Mat, 2026-11-16: "start search".

- **Search was broken in this tree, and is back.** FlexSearch 0.7.43 reached Canopy only through Clover 3; the move to Clover 4 (Phase 2) dropped it, `flexsearch-globals.js` stopped being written (its build sat in a silent `try`), and every query found nothing ("Found 0 of 0"). No check typed a query, so none saw it.
- **FlexSearch 0.8 behind an adapter.** `flexsearch` `~0.8.212` is a dependency of @canopy-iiif/app (0.8.212, 2025-09, the 0.8 line's last). `lib/search/engine.js` is the one place that knows it: `createEngine(FlexSearch)` builds, searches, exports and imports an index, and `searchText(record)` is what a record is found by (title, metadata, summary, annotation, in that order). `ENGINE_ID` keys the browser's cache; change it with any option.
  - Options: `tokenize: 'forward'` (a word by its beginning) and an `Encoder` with `normalize` (case and accents fold) but neither `dedupe` nor `numeric`: FlexSearch's default collapses repeated letters ("iiif" found every "if") and splits numbers in threes ("1800" found "1805").
  - Against 1.x (FlexSearch 0.7.43, the docs site's 223 records, 51 queries): the same hits for every query but where accents now match ("haridwar" finds "Haridwār"; 0.7 found none), and the same first hit for 40 of 50, the rest about as good or better ("navplace" now puts the Map page first). `tests/unit/search/engine.test.js` pins the rules, and runs them through the compact build the browser gets.
- **No prebuilt index.** For the docs site a fresh build takes 35 ms in Node; a shipped one would add 92 KB gzipped to the 69 KB of `search-index.json` the page still needs for its summaries. At twenty times that (4,460 records) a build takes 454 ms and an import 22 ms, so the browser keeps its built index in IndexedDB as 1.x did (`lib/search/index-cache.js`), now keyed by engine and version; 1.x's 0.7 entries are dropped, never read. The version (`index.json`) covers the annotations as well as the index.
- **One loader, two runtimes.** `lib/search/data.js` fetches and joins `index.json`, `search-index.json`, `search-records.json` and the annotations, which `search-app.jsx` and the header's runtime each did their own way. Both runtimes bundle FlexSearch's compact build (10.7 KB gzipped; `lib/search/bundle.js`, as its `exports` map names only the full bundle).
- **The header's suggestions** (`search-form-runtime.js`).
  - Load nothing until the field is used: on focus it loads `scripts/canopy-search-engine.js` (`search-engine-runtime.js`, 13 KB gzipped, built by `build/runtimes.js`) and the index. 1.x fetched `search-index.json` and `search-records.json` on every page, about 160 KB gzipped on the docs site.
  - Match with the search page's engine, best first, grouped by type (substring matching before).
  - Each group is a `role="group"` named by its label, from `common.types` (ACCESSIBILITY.md C40). The count is a status message once typing pauses (C39), in `locale.yml`'s new `common.nouns.suggestion`, `suggestions` and `common.phrases.count_content`, English and the i18n template's Spanish.
  - The arrows reopen suggestions Escape closed. The search page marks itself (`window.CanopySearchPage`), so on `/es/buscar` the field drives the results as on `/search`: it used to open its own suggestions over them.
- **The search page.**
  - The summary is a status message, its visually hidden twin said once typing pauses (C39). A failure to load says "Search unavailable." on the page and in the console.
  - R5: `SearchTabs` follows APG's tabs pattern (one stop; arrows, Home, End; selection follows focus; `aria-controls`), and `SearchResults` takes `tabbed` to be the selected tab's panel, there even with no matches. Both props are additions; `searchTabId()` keeps the id in one place.
  - The filters (C41): focus moves in, Tab stays inside, Escape closes, focus returns to the Filters button; "Clear all" is `aria-disabled`; the dialog is named "Filters" (`CanopyModal`'s new `ariaLabel`), and the header's dialogs "Search" and "Primary navigation", where the site's title named all three (DESIGN.md §0, "A modal dialog holds focus").
- **Weight.** The UI bundle inlined `@allmaps/leaflet`, which the Map imports only when it draws a georeference, and with it zod, proj4 and Allmaps' renderer: 2.2 MB in `ui/dist/index.mjs`, carried by every runtime built from it. It is external now (`ui/scripts/build-ui.mjs`), and the map's runtime bundles it itself. `search.js` 2.92 MB → 108 KB (470 → 35 KB gzipped; it is minified now too), the timeline's 1.23 MB → 59 KB, and the 1.22 MB chunk Clover's runtimes shared is gone (the largest left is 89 KB). `tests/unit/ui/bundle-weight.test.js` holds it.
- **Fixed on the way.** `writeSearchIndex`'s logs required `./log` from `lib/search/`, a path gone since 2025's reorganization, so they never printed; its write of the index's version into `.cache/iiif/index.json` required `./iiif` and never ran, and nothing read it, so it is gone. In `npm run dev`, a change under `lib/` reloaded the build module, emptying the IIIF records it reuses, and the rebuild indexed the pages alone; `build/build.js` holds them on `globalThis` now, so a reload keeps them. (Reading IIIF again on a reload, tried first, empties `site/` under Tailwind's watcher, and the build failed with `ENOTEMPTY`.)
- **Docs.** `content/docs/content/search.mdx` says how a search matches, what the header's field does, and the tabs by keyboard.
- **Checks.** `tests/a11y/specs/search.spec.mjs` (new): search as a visitor uses it, on every fixture site and in Spanish. The search page's tabs by keyboard and the status message; the suggestions (loaded only once used, named groups, the count, the arrows and Escape, nothing found); the filters by keyboard; axe in each state. `dialogs.spec.mjs` checks the header dialogs' names. `tests/a11y/lib/axe.mjs` is axe for any spec.
- **Checked** (2026-11-16, again after the page text, the front matter and the headings): `npm test` (315 tests in 33 suites); `npm run lint:a11y`; `npm run test:a11y` (296 checks on five sites, no findings); the docs site built with live IIIF (`npm run build`), its home, Search, About, Docs, Theme and Style guide pages, the search docs and the Search, Map, Timeline, Gallery, Image Story, Viewer, Slider and Card pages (87 checks, no findings). Screenshots of the suggestions, the tabs and the filters are in `.cache/visual/after/search-*.png` (ignored).
- **For the migration notes (Phase 8).** No component or prop changed. What a 1.x site could notice: `window.FlexSearch` is gone, and `scripts/flexsearch-globals.js` is no longer written; a page loads search only when its field is used; accents match; the header's suggestions are ranked by relevance (they had come in the index's order); the header's dialogs and the filters are named "Search", "Primary navigation" and "Filters" rather than by the site's title; the search page has an `h1`, its page results' titles are `h2` (`.canopy-article-card__title`), and a search page in another language is titled in it.
- **A page's words** (Mat, 2026-11-16: "Yes, clean them"). An MDX page's text for the index and its result's excerpt came from patterns (`mdx.js`'s `extractPlainText` and `extractMarkdownSummary`), and showed: table pipes and list markers; a component named in inline code (`` `<Map>` ``) taken for a component, so the paragraph after it, up to the next closing tag, was dropped and a stray backtick turned the excerpt's words into code; and every link indexed as a literal "$1" (30 of the docs' 48 pages). `lib/build/search-text.js` reads the page with the MDX parser and GFM, as it is compiled: the text is its prose (headings, paragraphs, lists, quotes, table cells but the header row, what a component holds), without code, components' attributes, expressions, imports or images; the excerpt's Markdown keeps inline code and emphasis and escapes `*`, `_`, `` ` `` and `\`. All 61 pages of the docs, the templates and the fixture parse; one that does not falls back to the patterns, whose link pattern now keeps the words. `ArticleCard` cuts its excerpt by runs of text, so never inside a span, between words, and marks each word of the query; an escaped or in-word underscore is a character, not emphasis; a mark has no side padding, which split "MapPoint" into "Map Point". `tests/unit/search/page-text.test.js` and `tests/unit/ui/article-card.test.js`.
- **The search front matter the docs promised** (Mat, 2026-11-16: "Make it work"). Documented in `content/docs/user-guides/customize-the-search-index.mdx` and `content/docs/content/frontmatter.mdx`, and read by nothing until now. `pageSearchRecord(source, { href, layoutType })` in `lib/build/search.js` makes an MDX page's record:
  - `searchType` sets its type and tab, ahead of `type` (which keeps working: given empty, it leaves the page out), its folder's layout's and `page`.
  - Its result shows `searchSummaryMarkdown`, else `searchSummary`, else `description`, else the passage around the query; the first two's or the description's words are searched ahead of the page's own.
  - `image` (or `og:image`) is its `thumbnail`: a URL as it is, any other path from the site's root, the base path put before it in the browser (`search/data.js`). `ArticleCard` takes a new optional `thumbnail`, drawn beside its words with `alt=""` (the title names the result); the default figure template and the docs' (`content/search/_result-*.mdx`) show any record's image, not only a work's, and so do the header's suggestions. A work's result in an article layout shows its thumbnail too now.
  - A page with no `description` gets its `<meta name="description">` from its prose (`extractSearchText`'s `excerpt`), no longer from the patterns.
  - The check that left out pages under `content/search/` never matched (its hrefs begin with a slash); it does now, and nothing but reserved files had ever been there.
  - `tests/unit/search/page-record.test.js`; the fixture's Prose page gives an image and its Content state page a `searchSummary`, which `search.spec.mjs` checks in the results.
- **The search page's headings** (Mat, 2026-11-16: "Fix R7"; ACCESSIBILITY.md R7, C42).
  - The default layout (`content/search/_layout.mdx`, the docs' and the templates') opens with the page's title as its `h1`, in the title style above the tabs.
  - `ArticleCard` takes `headingLevel` (2 to 6; 3 by default, as in 1.x), its title a `.canopy-article-card__title` at that level, styled as before. `SearchResults` and its templates pass it on (`content/search/_result-article.mdx` too), and `<SearchResults headingLevel>` sets it; without it the runtime takes one below the last visible heading before the results (`search-app.jsx`), `h2` under the layout's `h1`.
  - A search page in another language is titled with its locale's `common.nouns.search` ("Buscar"), not `canopy.yml`'s `search.page.title`, which is in the default language: its `<title>` had said "Search" on `/es/buscar` (C42).
  - A site's own layout keeps its headings; the docs say to open it with an `h1`. A site's CSS on `.canopy-article-card h3` no longer reaches a result titled `h2`: for the migration notes.
  - Corrected on the way, in the search docs: `SearchForm` and `SearchTotal`, removed in 2025 (`1cd1c55`), were still documented, and the layout was said to receive a `search` prop and to be optional; it receives `props.page` and is required.
  - `search.spec.mjs` checks the outline in both languages: one `h1` in the page's language, no level skipped, the results at `h2`.

Upgrade and release (2.x Phase 8)
---------------------------------
2026-11-16 / claude. In this tree, uncommitted. Mat, 2026-11-16: "Start Phase 8", then, asked whether to publish as `@nulib/canopy` with `@canopy-iiif/app` kept as an alias, "Yes, rename".

- **Two packages, one version.** `packages/app` is `@nulib/canopy`. `packages/app-alias` is `@canopy-iiif/app`: a file for each entry of `@nulib/canopy`'s exports map that re-exports it, and `@nulib/canopy` as its one dependency, at exactly its own version. A 1.x site upgrades as it updates (`npm i @canopy-iiif/app@2`, or its Update Canopy App workflow), with no edits. `tests/unit/packaging/alias.test.js` holds the two together: the same entries, the very same modules in Node, the same UI exports. Only `@canopy-iiif/app` was on npm (2026-11-16); `@canopy-iiif/lib` and `@canopy-iiif/ui` were workspaces until `f6a23e7` and never published. Two entries of the exports map have no file behind them, as in 1.x (`./ui/styles/runtime.css`, never written, and `./docs-legacy-compat`, which `files` leaves out); the alias leaves them out.
- **The build reads both names** (`lib/build/package-names.js`): in an MDX page's or layout's imports (a recma plugin, so a code example keeps the name it shows; the source rewrite before it changed code blocks too), in a site's components bundled for the server or for the browser, and in the search result templates. The package names itself by path or by `PACKAGE_NAME`. `tests/a11y/fixture/v1-imports.mdx` imports Canopy by its 1.x name in every fixture site, so `npm run test:a11y` fails if that stops building.
- **`canopy build` and `canopy dev`** (`bin/canopy.js`, `lib/cli.js`) in place of `tsx app/scripts/canopy-build.mts`, in the templates and the root; `app/scripts/` is gone. A 1.x site's own script keeps working. The command runs the build under tsx's loaders, as that script did, so MDX that imports a `.jsx`, `.tsx` or `.ts` file of its own keeps building (the docs' home page and Style guide do; found when the first `canopy dev` failed them). tsx is a dependency of the package for it, and brings its own esbuild (0.28, beside the package's 0.21), as every 1.x site had. Its ES module API is imported, not required: tsx 4.23's CommonJS build of it names a loader file the package lacks.
- **The package brings its tools.** `esbuild`, `tsx`, `@tailwindcss/cli` and `tailwindcss` are dependencies, the optional Tailwind peer is gone, and the build runs a site's own Tailwind CLI where it has one, else the package's. So are the four parsers the search text reads (`micromark-extension-mdxjs`, `mdast-util-mdx`, `micromark-extension-gfm`, `mdast-util-gfm`), found until now only because npm hoisted them. `tests/unit/packaging/dependencies.test.js` fails on any package the published code imports and does not declare. Both packages export `./package.json`. `rem`, which the Slider docs taught importing from `ui/iiif/sliderOptions`, never exported (`ERR_PACKAGE_PATH_NOT_EXPORTED`, 1.x too), is exported from both UI entries.
- **What a 1.x site hears** (`lib/build/upgrade-notices.js`), once a build: the new name; `@samvera/clover-iiif` or `embla-carousel` left in `package.json` (or the components of its own that import them); scripts that run Canopy through tsx; and, read from the page the search layout renders (`lib/search/search.js`), a search page with no `h1`, as a 1.x template's layout gives (the one finding the browser checks keep on an upgraded 1.x site; the site's file is the site's to change).
- **Release.**
  - Changesets versions both packages as one `fixed` group. No prereleases (Mat, 2026-11-17: "Straight to 2.0"; pre mode, entered first, was left before anything was versioned in it).
  - 2.0.0 was published on 2026-11-17 from a commit whose message I had drafted with a `Co-Authored-By: Claude` trailer, and retired the same evening. Mat unpublished `@canopy-iiif/app@2.0.0`; npm refused `@nulib/canopy@2.0.0` for over an hour ("has dependent packages in the registry": its record of dependents still counted the alias's unpublished 2.0.0), so it is deprecated instead, the one trace left, its provenance naming that commit. The 2.0.0 tags and the `v2.0.0` release were deleted, and the commit was rewritten into one of Mat's, "Release Canopy 2.0.1 as @nulib/canopy." 2.0.1 is the first 2.x release; npm never reuses a version. Commits are a person's work since (root `AGENTS.md`, "Commit & Pull Request Guidelines"): `packages/helpers/check-commit-authors.js` refuses AI attribution in the commit-msg hook and in the Tests workflow's "Commits authored by people" job, which a release waits on. Three July commits on `main` (1.12.x) still carry such trailers; rewriting them would rewrite fourteen published commits and their tags.
  - `guard-publish.js` fails unless the alias depends on exactly the main package's version; `version-bump.js` writes its changeset for `@nulib/canopy`.
  - npm trusted publishing in place of `NPM_TOKEN` (Mat, 2026-11-17: "Yes, switch it"): the release job alone has `id-token: write`, and `changeset publish` (in CI it asks npm nothing about 2FA) runs `npm publish`, which takes the job's OIDC identity (npm 11.5.1 or later; Node 24 ships 11.6) and adds provenance; `always-auth`, a token-era setting npm 11 warns about, is gone. npm adds a trusted publisher only to an existing package, so `@nulib/canopy` is created first by a placeholder, `0.0.0`, published by hand (CONTRIBUTING.md, "Publishing to npm"; Mat published it 2026-11-17). npm's form allows a trusted publisher only `npm stage publish` unless **Allow npm publish** is ticked, which this workflow, publishing directly, needs. An open npm issue (npm/cli#8976) reports 404s publishing scoped packages through changesets with trusted publishing; others publish so, and a token remains the fallback.
  - The release workflow takes Node from `.nvmrc` (it pinned 20), marks a prerelease as one on GitHub, pushes no template for a prerelease, and prepares the templates at the version the run published (it read `npm view`, which can lag behind a publish). A version with no notes in the release log no longer fails the job after its publish, which had skipped the GitHub release and every template push, with no way to run them again; it takes the default text, with a warning. The docs' deploy reads `.nvmrc` too.
- **Templates.** `templatePackageJson()` in `prepare-template.js` (`tests/unit/packaging/template.test.js`): one Canopy dependency, `@nulib/canopy`, beside React and React DOM, and `canopy build`/`canopy dev`; no tsx, esbuild or Tailwind. Their workflows read Node from `.nvmrc`, and the update workflow installs `@nulib/canopy`. The default template's `AGENTS.md`, which the template repositories receive, said Node 18, `app/scripts/canopy-build.mjs` and `packages/app`; it says what a site has now.
- **Docs.** New: `content/docs/developers/upgrading.mdx` ("Upgrading to 2.0"), from the notes each phase kept for it: upgrading, the new name, what a site can drop, Node, and what changes (Clover 4's options and classes, the `--colors-*` properties and the reset gone, the look, the hero, search, accessibility). Every page, layout and example uses the new name; Updating says how a 1.x site updates. The Theme page's link to the Style guide (`/docs/theme/style-guide/`) pointed at a folder that is not there; it is extensionless now, as the other links are.
- **Node.** 1.x already needed a Node that `require()`s an ES module (`lib/components/bibliography.js` loads ESM parsers at load): 20.19 and later, 22.12 and later, or 24. 2.x uses nothing newer (scanned, 2026-11-16). On Node 20.15 both fail the same way (`ERR_REQUIRE_ESM`); the fixture harness itself needs 22.2 (`zlib.crc32`).
- **Found on the way.** A footnote's link back (↩) was told from its text by color alone (ACCESSIBILITY.md C43, fixed; the fixture's Prose page has a footnote now), found checking the 1.x site below.
- **Checked** (2026-11-16):
  - `npm test` (345 tests in 39 suites), `npm run lint:a11y`, and `npm run test:a11y` (318 checks on five sites, no findings), with `v1-imports.mdx` in each.
  - The three templates, staged by `prepare-template.js` from this checkout and built by `preview-template.js --build` from the packed `@nulib/canopy` alone, with live IIIF: the default (182 pages), i18n (16) and Northwestern (431). No notices; no tsx, `.nvmrc` 24, workflows on it.
  - A 1.x site, as the 1.x default template makes one (HEAD's repository through HEAD's `prepare-template.js`, its 1.x dependencies from npm; built with 1.14.1 first, 182 pages), upgraded unedited to the packed `@canopy-iiif/app` and `@nulib/canopy`: its `tsx` script builds the same 182 pages on Node 24, with its 1.x cache and from none, and on Node 22.0 with `--experimental-require-module` (Node 20.19's default), from none; the four notices once. Its browser checks: no findings but the `h1` its own 1.x search layout lacks (the guide says to add one; it had none in 1.x, and its results are `h2` now, not `h3`).
  - The docs site built with `canopy build` and served by `canopy dev` (227 pages; its home page and Style guide import `.jsx`), and its home, About, Search, Docs, Developers (Upgrading among them), Theme, Style guide, Slider, Viewer, components, search and Markdown docs, the search index guide and Releases (102 checks, no findings).

2.x roadmap
-----------
What is left, in order (2026-11-16). Phases 0 to 4, 6 and 7 are above.

- **Phase 5, the map** (Mat, 2026-11-14: "rework the Map component for canopy around the map component for Clover. with that, move from leaflet to maplibre").
  - `<Map>` and `<MapPoint>` are drawn with Clover 4's map part (`@nulib/clover/map`: `Map`, `setMapWorkerUrl`, and the navPlace and georeference helpers, on MapLibre) in place of Leaflet.
  - Their MDX API stays as authors write it:
    - `<MapPoint>`'s coordinates and words in every spelling they take;
    - the site's navPlace dataset (`/api/navplace.json`);
    - `height`;
    - the tile-layer and basemap props.
  - Drops `leaflet`, `leaflet.markercluster` and `@allmaps/leaflet`, if Clover's georeferencing covers what the Allmaps layer did.
  - Recheck C14 (marker names) and C29 (focus) on MapLibre.
  - Placed before the new look, so the look styles the MapLibre map once.
  - **On hold** (Mat, 2026-11-14: "I'm not ready to make this decision. come back to it."). Nothing is changed for it yet.
  - **What Clover 4.10's Map carries already:**
    - a Manifest's navPlace (`iiifContent`);
    - any GeoJSON (`navPlace`), each feature keeping its `id`, its `label` as its title, and simplestyle keys, so `mapKey` colors go through `marker-color`;
    - Georeference annotations (`georeferences`; Canopy fetches the URL strings first);
    - `scrollZoom` for `scrollWheelZoom`, `zoom` for `defaultZoom`, and `--clover-map-height`;
    - `onSelect(feature)`, and a list of places under the map, its keyboard route.
    - A Collection's places can be handed in as `navPlace`, from the site's `/api/navplace.json`.
  - **What it does not:**
    - popups beyond a title, a date and a picture (no summary, link, referenced works or MDX children);
    - clustering;
    - inline text labels (`type: 'small'`);
    - a fallback center;
    - raster `tileLayers` and the transparent basemap: it takes only `styleUrl`. A `data:` URL of a raster or empty MapLibre style may stand in for both, to be tried.
  - **Found in Phase 7** (2026-11-16): the docs' georeference example (`content/docs/components/map.mdx`, an Allmaps annotation over `disableTileLayers`) draws no Allmaps layer and fetches no annotation, on the released 1.x docs (nulib-ds.github.io/canopy) as in this tree, checked headless. `Map.jsx` swallows the layer's errors (`catch (_) {}`), so nothing says why. Not a regression of the bundling change; for the map's rework to settle.
  - **The three questions put to Mat, open:**
    1. The rest of a popup: a panel under the map, shown on `onSelect`, with no Clover change; or a content slot in Clover's popup, a Clover change.
    2. Clustering, inline labels and the fallback center: added to Clover by a Clover session, as in Phase 2; or accepted with a build notice.
    3. The default basemap: Clover's relief (OpenFreeMap), or OpenStreetMap as in 1.x.
- **Phase 6, the new look.** Done in this tree (above, "The new look").
- **Phase 7, search.** Done in this tree (above, "Search").
- **Phase 8, upgrade and release.** Done in this tree (above, "Upgrade and release"), but for the release itself, which is Mat's: an npm token that can publish to `@nulib`, then the bump, the commit and the push.
- **Open, in any phase.**
  - Scroll as a text-focused reader, after Clover's Document (Mat, 2026-11-13).
  - Mat's OK on the 1.x options that now do nothing (`VIEWER_UNSUPPORTED`).

The 2.0.2 patch
---------------
2026-11-18 / claude, with Mat in the docs preview. Released as 2.0.2 (`npm run version:packages`, a patch). Each change is Mat's call, quoted where it changes what Canopy does. Every prop keeps working (the MDX API is a contract).

- **The hero does not rotate** ("remove this functionality", of the pause control): `hero-slider-runtime.js` moves a slide only when a visitor does, the pause control and its words (`common.carousel.stop`, `start`) are gone, and the slides are polite from the start (ACCESSIBILITY.md C1). The docs' home page takes the default `featured` layout, words and carousel side by side ("make this left/right"); the templates keep `centered`. Its dots are the muted gray at the share the theme's build works out (`--canopy-dot-share`, `ui/theme-palette.js` `dotShare`): 80%, "more translucent", or nearer solid where 3:1 on the hero's ground needs it, as a black accent does (C30).
- **Prose across its column** ("address why paragraphs are not extending to their edges"): the 70ch measure (`--canopy-measure`) is gone from `base/_common.scss` and the tokens.
- **A list's markers are the list's**: `ul` disc and `ol` decimal, its items taking them, where every `li` was set `disc`. Clover's slider track asks for none and gets none ("why this marker bullet is here"), and numbered lists show numbers again.
- **Sliders** (`version-parity.css`, `iiif/_slider.scss`): the track takes a rem more room above and below and a pixel at the sides, given back as margin, so the cards' rings and shadows show and nothing of a card out of view does ("we don't see the edge/dropshadow of the items off screen"); Clover's scroll shades are off; previous and next sit `--canopy-space-s` in ("use gr steps"). A facet's slider (`<RelatedItems>`) is headed by its value, the link to its works, "View all" with it unseen (`mdx.js` `makeHeader`, `common.actions.view_all`); Clover draws no header there (`header: false`) and names the list by the value.
- **No brush stroke** ("the marker under things is a Clover thing"): `_swoosh.scss`, the brand's stroke and `--canopy-swoosh` are gone; `<Swoosh>` stays and renders its words, and the docs' and templates' headlines no longer use it.
- **Gold on sand** ("make default colors no longer indigo"): `DEFAULT_ACCENT` and `DEFAULT_GRAY` in `ui/theme.js`, `canopy.yml` (the docs and the default template), the Theme page's reset, the fixture's fallbacks. A 1.x site whose `canopy.yml` names no colors hears it once a build (`upgrade-notices.js`).
- **The header**: the primary navigation at its end ("align this right"); at desktop widths the search is a button that opens into its field ("make this search be a button that can extend out the input/form"; `CanopyHeader.jsx` `setupDesktopSearch`), except on the search page (`page.type === 'search'`), whose field it is.
- **Columns and spacing** ("improve the spacing/gaps on pages. extend container"): `--canopy-container-content` 75rem and `--canopy-container-wide` 90rem (were 1080 and 1300px), the featured hero in the wide column with `<Container>`'s inset, sections a golden step apart, sliders `--canopy-space-xl`. The docs' home sections' headings break in two balanced lines.
- **The work page** ("add a toggle that extends the viewer across"): `viewer-runtime-entry.js` adds a toggle (`aria-pressed`, `common.actions.widen_viewer`) beside the viewer in `canopy-work--layout` from 961px; wide, the words stack under the viewer, and the metadata (`dl.clover-metadata` alone: "don't do columns here", of the attribution) runs in three columns at most ("try three columns max") wherever it has the whole width, top-aligned (`_work.scss`). The choice is kept in the browser (`canopy:work-viewer`).
- **The docs site's own**: "Canopy is a project of Northwestern University Libraries." under the header on its home page, as Clover's docs have it (`packages/helpers/docs/ProjectCredit.js`); a template has its own home page, so never carries it.
- **Dev server**: `dev.js` rebuilds the UI styles when `version-parity.css` changes, as it did for Sass alone. A UI component's JSX shows only after a restart (the server bundle is imported once); the UI watcher was found gone mid-session three times, cause not found.
- **Checks**: `specs/carousel.spec.mjs` (rewritten), `header-search.spec.mjs`, `related-items.spec.mjs` (slider headers, list markers), `work.spec.mjs`; unit tests for the dots' share, the default theme and the colors notice; the fixture's prose page has a bulleted and a numbered list.
- **Left**: Fraunces for most headings, Google Sans for reading, Source Serif gone, waiting on Mat's OK to download Fraunces (four files, 275 KB, Google Fonts) and his choice of its weight; the Canopy diagram's redraw, after the release.

References
----------
- `packages/app/lib/AGENTS.md`
- `packages/app/ui/AGENTS.md`
- Root packages overview: `packages/AGENTS.md`
