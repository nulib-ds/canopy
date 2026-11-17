UI Agent Notes
==============

Prime directive: WCAG 2.2 AA
----------------------------
- Every component conforms to WCAG 2.2 at Level AA, and that outranks every note below. The rules are in `packages/app/DESIGN.md` §0; known failures are in `ACCESSIBILITY.md`.
- A component renders named markup on the server, takes `headingLevel` when it renders a heading, reads its words with `getString`, and leaves theme tokens at their ratios (`tests/unit/a11y/contrast.test.js`).

Mission
-------
- Ships browser-facing assets that hydrate MDX placeholders and expose public UI primitives.
- Maintains SSR-safe exports so the build system can render without pulling browser-only code.

Build Outputs
-------------
- `dist/index.mjs`: browser ESM (`platform: neutral`); externals must include `react`, `react-dom`, `react-dom/client`, `react-masonry-css`, `flexsearch`, `leaflet`, `leaflet.markercluster`, `@allmaps/leaflet`, `@nulib/clover` and `@nulib/clover/*`. The bundle imports Clover only dynamically, a part from its own entry, so no runtime that imports it carries Clover up front. It inlines no package (`tests/unit/ui/bundle-weight.test.js`): one a component loads only when it needs it stays external, for the runtime that uses it to bundle. `@allmaps/leaflet`, inlined until 2.x Phase 7, put 2.2 MB of the map's into every runtime.
- `dist/server.mjs`: SSR-safe entry consumed via `@nulib/canopy/ui/server`; limit imports to React placeholders and shared utilities.
- `index.js` / `server.js`: Re-export compiled bundles for consumers.

Hydration Patterns
------------------
- MDX renders placeholders (e.g., `<Viewer />`, search primitives) on the server; browser runtimes locate `[data-canopy-*]` markers and mount React using globals from `site/scripts/react-globals.js`.
- Each hydrated component must remain optional during SSR import to avoid `window` access or side effects.

Active Cleanup Goals
--------------------
1. Catalogue existing components in `src/` (Viewer, Search, RelatedItems, Grid) and confirm ownership + dependencies.
2. ~~Audit Tailwind plugin/preset usage~~ — done 2026-10-02: under Tailwind v4 they add no styles and are deprecated (removal in the next major).
3. Establish guidelines for adding new hydrated components (naming, placeholder data attributes, external dependencies).
4. Confirm build scripts in `scripts/` capture all externals/shims and note verification steps below.

Current Focus
-------------
- Component inventory: map every export in `src/` to its hydration runtime and SSR counterpart; identify unused or legacy modules.
- Styling strategy: component styles belong in `styles/` (Sass); Tailwind utilities come from each site's CSS-first config. Document any global CSS risks.
- Build tooling: review `ui/scripts/build-ui.mjs` for esbuild config drift (externals, target, watch mode ergonomics) and note desired improvements.
- Accessibility + performance: capture any known UI gaps (focus management, bundle size) and link to issues once triaged.

Styling Guardrails
------------------
- `styles/settings/_tokens.scss` holds the 2.x look's tokens in `@layer properties` (`DESIGN.md` §1): Google Sans Flex and two weights, the type sizes, radii (4 to 16px), surfaces, shadows, the focus ring, the black materials, the brush stroke and `--canopy-sticky-top`, with the values that differ in the dark. A site sets any of them without `!important`; square and flat are one line each. Nothing forces them on every element (the global reset went in 2.x Phase 2, `ACCESSIBILITY.md` R1, as it erased Clover 4's focus ring and hotspot outlines). Read the tokens rather than writing a radius, shadow, size or weight, and draw focus with `focus-ring()` (`settings/_focus.scss`).
- Color: draw text only in `--color-accent-default`, `--color-gray-default`, `--color-gray-muted` (and gray 900); accent 100–700 are fills, tints and edges, never text. A filled accent control is accent 50 on `--color-accent-default`, `--color-accent-hover` under the pointer. State indicators (focus, checked) take `--color-accent-default`. `packages/app/DESIGN.md` §1 has the table.
- Emphasis comes from the tokens: a solid fill (`--canopy-surface`) for a panel, `--canopy-card-shadow` for a card, `--canopy-control-edge` for a control's edge, never a hand-picked border. Shared helpers (`@mixin canopy-button-base`, `focus-ring()`) keep interactive controls consistent.
- Type: every piece of text takes one of the eleven styles in `styles/settings/_type.scss` (`@include type.<style>`), never a size, weight or tracking of its own; `tests/unit/ui/type-scale.test.js` enforces it, and the docs' Style guide shows them. Components set no family of their own. Headings' family and weight live in `base/_heading.scss`, element rules in `@layer base`, so a 1.x site's own base rules still win. Reading text (Markdown's classless paragraphs, lists and quotes, ledes, the hero's standfirst, `Feature`'s words) takes `--canopy-font-body`, Source Serif 4 (`base/_common.scss`); everything else stays the interface's sans.
- Before adding new CSS, check that it inherits typography/backgrounds from the base layers; avoid declaring `background: transparent` or duplicate font settings.
- Clover theming: `theme.js → buildVariablesMap()` emits `--clover-color-*` as `var()` references to Canopy tokens (accent and accent-text → `--color-accent-default`, accent-alt → `900`; primary → `--color-gray-default`/`900`/`--color-gray-muted`; secondary → `--color-gray-50`/`400`/`300`), so author overrides of the Canopy scales reach Clover. `_tokens.scss` aliases `--clover-radius`/`--clover-radius-pill` to Canopy's radius tokens. Clover 4 (`@nulib/clover`) reads only these tokens and draws in `@layer clover`; nothing of Clover 3's styling (its `--colors-*` names, its class names) remains.

### Interstitials
- `src/interstitials/Hero.jsx` renders the homepage hero. It rotates featured manifests declared in `canopy.yml → featured`, accepts overrides (`item`, `index`, `random`) when authors want deterministic slides, and exposes presentation props (`headline`, `description`, `links`, `height`, `background`, `variant`). `variant="centered"` (2.x) is the featured hero laid out down the page: its markup is the featured one's with `canopy-interstitial--hero-centered` added, so the carousel's runtime and checks are the same. `headline` takes a string or nodes (`<Swoosh>` in it).
- Homepage parts (2.x, `src/layout/`): `Swoosh` (the brush stroke under its words), `Band` (a call to action on black; `<Button>`s in it take its colors) and `Feature` (an eyebrow, a title at `headingLevel` and a lede, in an `hgroup`).
- Runtime: `packages/app/lib/components/hero-slider-runtime.js` bundles to `site/scripts/canopy-hero-slider.js`. Hand-rolled since 2.x Phase 4 (no dependencies, no React), after APG's auto-rotating carousel; `Hero.jsx` renders every slide and control on the server, words from `common.carousel`. See `packages/app/AGENTS.md`, "The carousel".
- Utilities: sizing logic lives in `src/interstitials/hero-utils.js` / `.cjs` with tests under `tests/hero-*.test.js`. Keep both module formats in sync when updating defaults.

Risks & Watchpoints
-------------------
- Externals mismatch: adding a dependency without updating esbuild externals or lib shims causes runtime bundle failures.
- SSR leakage: components should guard against `window`/`document` usage during module evaluation; flag offenders for refactor.
- CSS collisions: token or layer-order changes in `theme.js` / `lib/build/theme-tokens.js` can break downstream consumers; document breaking changes and coordinate releases.

Verification Commands
---------------------
- UI bundle only: `npm -w @nulib/canopy run ui:build`
- Watch mode while iterating: `npm -w @nulib/canopy run ui:watch`
- End-to-end validation: `npm run build` (runs the shared builder and exercises UI outputs).

Session Ritual
--------------
- Before modifying bundles, re-read externals list and update this file if new deps appear.
- When adding CSS, keep it in the scoped stylesheets under `styles/` and reference theme tokens rather than literal colors.
- Record open questions for the builder team in `packages/app/AGENTS.md` to keep coordination tight.

Logbook Template
----------------
- Date / engineer
- Components or build scripts touched
- Decisions (hydration pattern, styling, dependency changes)
- Follow-up tasks (link to numbered goals or cross-workspace notes)

Logbook
-------
- 2025-09-29 / chatgpt: Flattened the entire UI surface (removed border radius/shadows, centralized button mixins, documented `settings/_effects.scss`) and rebuilt the UI bundle to propagate the simplified styles.
- 2025-09-26 / chatgpt: Deprecated the legacy hero wrappers in favour of the interstitial hero and restored an accessible `data-canopy-search-form-trigger` button inside `SearchPanel` to keep homepage verification passing.
- 2025-09-26 / chatgpt: Upgraded Tailwind to v4, mapped the search form trigger button to `bg-brand`, and ensured template output pins the same dependency.
- 2025-09-27 / chatgpt: Restyled the search form with scoped `.canopy-search-form-*` classes, added base-path aware form resolution, and defaulted SearchPanel grouping to `['work','docs','page']` so new MDX record types appear in the teaser tabs.
- 2026-10-02 / claude: Pointed Clover at Canopy's theme by emitting `--clover-color-*` (Clover 3.16 no longer reads `--colors-*`, so sliders/viewers fell back to Clover blue and pill corners), aliased `--clover-radius*` to the zeroed radius tokens, kept the legacy `--colors-*` output for older Clover, added `tests/unit/ui/theme.test.js`, and refreshed the Clover overrides section of `content/docs/theme/index.mdx`.
- 2026-10-02 / claude: Theme-token pass on component styles:
  - Removed the last six `var()` fallbacks. The gallery gap is defined on `.canopy-gallery`; the theme always emits `--color-accent-default`; and `auto` is already the initial value the content-nav `left`/`width` fall back to when unset.
  - Swapped hard-coded colors that ignored `grayColor`/dark mode for tokens:
    - search placeholders: Tailwind slate-400 → gray 600 at the same 75% alpha
    - search clear button: slate-500 → gray 700
    - map status, map marker labels, gallery placeholder stripes, gallery scrollbar thumb and timeline group points → gray 50/900, with `color-mix()` where alpha matters
  - Deleted radius and shadow rules the flat rule in `_effects.scss` already cancels: gallery modal radius and shadow, `--canopy-gallery-radius`, and the timeline key-dot pill.
  - Kept the neutral black backdrops (`#0006`, `rgba(0,0,0,.3)`) and the map marker hover drop-shadow.
  - Tailwind compiles each `color-mix()` into a static fallback from its own palette, plus the themed rule inside `@supports`.
  - Verified with before/after computed-style snapshots on the docs gallery, map, timeline and content pages: only the listed colors changed; gaps, outlines, radii and nav sizing are unchanged.
- 2026-10-02 / claude: Deprecated `ui/tailwind-config.js` (the `@canopy-iiif/app/ui/tailwind-config` export), `tailwind-default.config.mjs`, and the Canopy Tailwind preset and plugin; removal comes in the next major release. Under Tailwind v4 they add no styles even when loaded through `@config`. `defineCanopyTailwindConfig()` now emits a one-time `DeprecationWarning` (`CANOPY_TAILWIND_CONFIG`). With Tailwind's theme layer now kept, the search UI's `text-slate-600` classes became `text-gray-800`, the Canopy muted gray, so they follow `grayColor`.
- 2026-10-02 / claude: Moved the pure palette logic out of `theme.js` into `ui/theme-palette.js` (added to `files`); `theme.js` re-exports it, so its API is unchanged. The moved logic is the Radix step map, `toTailwindScale`, `buildVariablesMap`, `variablesToCss` and `swatchColor`.
  - `src/docs/ThemeShowcase.jsx` now builds its preview data from that module: the exact variables a build emits per palette and appearance.
  - It had drifted: its own step map previewed accent/gray 100–300 from Radix steps 3/4/6 instead of 2/3/4.
  - Also removed five unused color helpers, radius/shadow CSS cancelled by the flat rule, and a transition declaration that was invalid because of a missing comma.
  - `tests/unit/ui/theme-showcase.test.js` renders the SSR component and checks every palette in both appearances against `buildVariablesMap()`.
- 2026-10-02 / claude: Dark appearance: Canopy already inverts the `--clover-color-*` tokens and also puts `class="dark"` on `<html>`. Clover's own `.dark .clover-select-*` rules (its only `.dark` rules) then swapped primary/secondary back, so the Viewer's manifest dropdown showed a light panel on a dark page. `components/iiif/_viewer.scss` restores Clover's light-mode mapping under `html.dark`. The rules are unlayered, because Clover injects its CSS unlayered. Verified on a dark build with a Collection Viewer: the panel went from `#eeeeec` to the page's `#111110`, with light text.
- 2026-10-02 / claude: Removed the `sassConfig` plumbing. `buildSassConfig()` always returned `""`, yet `build-ui.mjs`, dev's `rebuildUiStyles()` and the deprecated Tailwind plugin each loaded the theme just to prepend that empty string to `@use 'index';`. `build-ui.mjs` no longer reads `canopy.yml`, and `loadCanopyTheme()` no longer returns `sassConfig` (or the no-op `mergedVars` alias). `buildSassConfig` stays exported as a deprecated no-op until the next major. Verified: `ui/styles/index.css` is byte-identical before and after, dev's rebuilt copy matches it, and the deprecated plugin's output matches a direct compile.

- 2026-11-16 / claude (2.x Phase 7, search; `packages/app/AGENTS.md`, "Search"):
  - `SearchTabs` follows APG's tabs pattern (ACCESSIBILITY.md R5): a roving tab stop, the arrows, Home and End, selection following focus, `aria-controls` to `panelId`; its bar follows focus as well as the pointer. `SearchResults` takes `tabbed` and is then the selected tab's `tabpanel`, there with no matches too, taking focus when empty. `searchTabId(type)` is the one place the tab's id is made.
  - `SearchFiltersDialog` holds focus as a modal dialog (C41): in on opening, Tab kept inside, Escape to close, back to the Filters button; "Clear all" is `aria-disabled`.
  - `CanopyModal` takes `ariaLabel`, which names the dialog for what it is in place of the brand: the filters ("Filters") and the header's two ("Search", "Primary navigation").
  - The suggestions' groups are styled as `.canopy-search-teaser__group` (`search/_results.scss`).
  - `ArticleCard` reads its excerpt into runs of styled text and cuts a window of runs around the query, between words, never inside a span; backslash escapes are characters, an underscore inside a word is not emphasis, and each word of the query is marked (`tests/unit/ui/article-card.test.js`). Its `mark` has no side padding. It takes an optional `thumbnail`, drawn beside its words (`.canopy-article-card--media`, `alt=""`); `SearchResults`' default templates pass any record's image. It takes `headingLevel` (2 to 6, 3 by default) for its title, `.canopy-article-card__title`, which `SearchResults` passes on (ACCESSIBILITY.md R7).
- 2026-11-13 / claude: 2.x Phase 0, the WCAG 2.2 AA prime directive (`packages/app/DESIGN.md` §0, the root `ACCESSIBILITY.md`).
  - `npm run lint:a11y` runs `eslint-plugin-jsx-a11y`'s recommended rules over `src/`. `role="list"` stays allowed on lists, which Safari's VoiceOver otherwise reads as plain text when they lose their bullets.
  - The hero's decorative `<img>`s say `alt=""` in the JSX now, so the lint sees it (the output is unchanged: `buildImageProps` spreads the same `alt=""` and `aria-hidden`).
  - `SearchTabs`' two lint findings were silenced with `ACCESSIBILITY.md R5`: tab roles without the tabs pattern (resolved in 2.x Phase 7; the silencing is gone).
  - Deleted the unreferenced `src/search-form/SearchFormApp.jsx`; its `cmdk` import was never installed.
  - `tests/unit/ui/clover-wrappers.test.js` pins the 1.x Clover placeholders (Viewer, Slider, Image, Scroll) and the primitives' markup ahead of Clover 4.
  - `tests/unit/a11y/contrast.test.js` checks every theme pair for all 31 palettes; its known failures are C4 and C5.
- 2026-11-13 / claude: Quick wins from `ACCESSIBILITY.md`, each now checked by `npm run test:a11y`:
  - C11: links in running text are underlined (`base/_common.scss`). The rule covers only class-less links inside `p`, `li`, `td`, `th`, `blockquote` and `figcaption`, outside `nav`, so components keep their own link treatment.
  - C13: prose, metadata values and inline code wrap text that has nowhere to break (`overflow-wrap: anywhere`).
  - C2: the hero's dots are 24px buttons, and their `::before` draws the dot at its old size.
  - C14: map markers carry their point's title as `title` and `aria-label`, or its coordinates where it has none (`content/map/Map.jsx`).
  - C12: code blocks (`docs/CodeBlock.jsx`, which draws every fenced block on every site) take focus so they can be scrolled by keyboard, named by their file or language. Their frame clips, so the ring is drawn inside (`base/_markdown.scss`).
  - C15: the checkboxes in Markdown task lists are named by their item (`lib/build/rehype-task-list-labels.js`).
