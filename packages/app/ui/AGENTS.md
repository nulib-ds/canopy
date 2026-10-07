UI Agent Notes
==============

Mission
-------
- Ships browser-facing assets that hydrate MDX placeholders and expose public UI primitives.
- Maintains SSR-safe exports so the build system can render without pulling browser-only code.

Build Outputs
-------------
- `dist/index.mjs`: browser ESM (`platform: neutral`); externals must include `react`, `react-dom`, `react-dom/client`, `react-masonry-css`, `flexsearch`, and `@samvera/clover-iiif/*`.
- `dist/server.mjs`: SSR-safe entry consumed via `@canopy-iiif/app/ui/server`; limit imports to React placeholders and shared utilities.
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

Flat Styling Guardrails
-----------------------
- `styles/settings/_effects.scss` defines zeroed custom properties for every radius/shadow token and globally forces `border-radius` + `box-shadow` to `0/none`. Do not reintroduce rounded corners or elevation without updating this module and documenting the exception.
- When component styles still need emphasis, lean on borders, spacing, and color instead of shadows. Shared helpers (`@mixin canopy-button-base`) keep interactive controls consistent.
- Before adding new CSS, check that it inherits typography/backgrounds from the base layers; avoid declaring `background: transparent` or duplicate font settings.
- Clover theming: `theme.js → buildVariablesMap()` emits `--clover-color-*` as `var()` references to Canopy tokens (accent → `--color-accent-default`/`900`; primary → `--color-gray-default`/`900`/`--color-gray-muted`; secondary → `--color-gray-50`/`400`/`300`), so author overrides of the Canopy scales reach Clover. `_effects.scss` aliases `--clover-radius`/`--clover-radius-pill` to the zeroed Canopy radius tokens. Legacy `--colors-*` names are still emitted for Stitches-based Clover (e.g. 3.3.8); drop them once sites no longer pin those releases.

### Interstitials
- `src/interstitials/Hero.jsx` renders the homepage hero. It rotates featured manifests declared in `canopy.yml → featured`, accepts overrides (`item`, `index`, `random`) when authors want deterministic slides, and exposes presentation props (`headline`, `description`, `links`, `height`, `background`).
- Runtime: `packages/app/lib/components/hero-slider-runtime.js` bundles to `site/scripts/canopy-hero-slider.js`; ensure Swiper deps stay external to avoid duplicating React.
- Utilities: sizing logic lives in `src/interstitials/hero-utils.js` / `.cjs` with tests under `tests/hero-*.test.js`. Keep both module formats in sync when updating defaults.

Risks & Watchpoints
-------------------
- Externals mismatch: adding a dependency without updating esbuild externals or lib shims causes runtime bundle failures.
- SSR leakage: components should guard against `window`/`document` usage during module evaluation; flag offenders for refactor.
- CSS collisions: token or layer-order changes in `theme.js` / `lib/build/theme-tokens.js` can break downstream consumers; document breaking changes and coordinate releases.

Verification Commands
---------------------
- UI bundle only: `npm -w @canopy-iiif/app run ui:build`
- Watch mode while iterating: `npm -w @canopy-iiif/app run ui:watch`
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

