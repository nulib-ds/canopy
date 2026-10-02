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
2. Audit Tailwind plugin/preset usage; document required classes and ensure generated CSS is scoped.
3. Establish guidelines for adding new hydrated components (naming, placeholder data attributes, external dependencies).
4. Confirm build scripts in `scripts/` capture all externals/shims and note verification steps below.

Current Focus
-------------
- Component inventory: map every export in `src/` to its hydration runtime and SSR counterpart; identify unused or legacy modules.
- Styling strategy: decide which styles belong in `styles/index.css` versus Tailwind preset utilities; document any global CSS risks.
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
- CSS collisions: Tailwind preset changes can break downstream consumers; document breaking changes and coordinate releases.

Verification Commands
---------------------
- UI bundle only: `npm -w @canopy-iiif/app run ui:build`
- Watch mode while iterating: `npm -w @canopy-iiif/app run ui:watch`
- End-to-end validation: `npm run build` (runs the shared builder and exercises UI outputs).

Session Ritual
--------------
- Before modifying bundles, re-read externals list and update this file if new deps appear.
- When adding CSS, annotate whether it belongs in Tailwind preset or scoped stylesheet.
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
