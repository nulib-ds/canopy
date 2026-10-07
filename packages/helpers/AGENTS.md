Helpers Agent Notes
===================

Mission
-------
- Centralize repository maintenance scripts (release guards, verification hooks, automation glue).
- Keep the repository root tidy by routing all helper utilities through this workspace.

Key Scripts
-----------
- `guard-publish.js`: Protects publishes by ensuring only `@canopy-iiif/app` is public and preflight checks pass.
- `run-changeset.js`, `version-bump.js`: Wrap Changesets commands with local conventions.
- `template/`: Logic for preparing the GitHub Pages template repo during releases.
- `template-i18n/`: Assets + overrides for the bilingual template (`en` default, `es` secondary) published by the `template-i18n` job.
- `template-northwestern/`: Northwestern-branded starter (brand layer in `app/styles/northwestern.css`, decisions in `DESIGN.md`), published by the `template-northwestern` release job to `nulib-ds/canopy-template-northwestern` (reuses `TEMPLATE_PUSH_TOKEN`, the Canopy CI PAT, which has access to that repo); preview locally via `npm run preview:template-northwestern`.

Invariants
----------
- Never add ad-hoc scripts at the repository root; route them here and expose via npm scripts.
- Helper scripts should remain Node-compatible without bundling; avoid ESM unless necessary and document runtime requirements.
- Any script that mutates the filesystem must log its intent and respect workspace boundaries.
- Template builds omit this workspace entirely; whenever helpers change behaviour that affects release automation, document the expected template output (e.g., updated `package.json` rewrites, workflow patches).
- Template staging writes to `.template-build/` by default (override with `TEMPLATE_OUT_DIR`); keep this path gitignored and disposable.
- CSS/Sass authored under `packages/app/ui/styles` must never include fallbacks inside `var()` declarations—always rely on the CSS custom property being defined upstream.
- When authoring CSS/Sass in `packages/app/ui/styles`, never add fallback values to CSS variable references (`var(--token)` only—no `, value`).

Active Cleanup Goals
--------------------
1. Document entry points and required environment variables for each script (e.g., `TEMPLATE_PUSH_TOKEN`).
2. Identify shared utilities that can be extracted to reduce duplication (argument parsing, logging, config loading).
3. Capture missing smoke tests or dry-run modes for critical scripts before enabling automation.
4. Review `template/` exclusions to ensure the generated repo stays aligned with current workspace layout.

Session Ritual
--------------
- When editing a helper, record assumptions and follow-up actions here.
- If a script is risky/destructive, note a manual verification step or backup plan.
- Cross-reference open tasks with `packages/AGENTS.md` so root themes stay visible.

Logbook
-------
- 2026-10-02 / claude: The docs theme previewer (`docs/ThemeShowcaseScript.js`) no longer re-implements the token map. It merges the per-palette variables that `ThemeShowcase` precomputes with the build's `buildVariablesMap()`, and no longer emits the legacy `--colors-*` names. The preview script and `ThemeStorageHydrator.js` share `STORAGE_KEY`/`STORAGE_VERSION` through `docs/theme-preview-storage.js`, bumped to 3 so stored v2 previews (built from the drifted scales) are discarded. Verified in the browser: crimson/sand in light and dark match a real build on 7 tokens each, the preview carries across docs pages, Reset clears it, and a planted v2 preview is dropped.
- 2026-10-02 / claude: `prepare-template.js` no longer writes `app/styles/tailwind.config.cjs`. Contrary to the 2025-10-19 entry, it was still being generated. Tailwind v4 never loaded it, and with `@config` it failed to build: it required `@canopy-iiif/app/ui/tailwind-config.js`, which the package's `exports` map doesn't expose.
- 2025-09-26 / chatgpt: Removed fallback behaviour from helper CLIs—`run-changeset` now requires a local @changesets/cli install and `build-tailwind` throws when the Tailwind CLI is missing or fails; template rewrite now pins Tailwind `^4.1.13`.
- 2025-10-19 / chatgpt: Template prep no longer copies or generates `tailwind.config.*`; the template relies on the built-in Canopy Tailwind config and falls back to the CSS-first `@import 'tailwindcss';` entry when no custom stylesheet exists.
- 2025-10-19 / chatgpt: Template builder now copies every `.css` under `app/styles/` so additional imports like `custom.css` survive into the published template.
- 2025-10-20 / chatgpt: Template workflow now deletes any stale `package-lock.json`, runs `npm install --package-lock-only --ignore-scripts`, and keeps the regenerated lockfile so template repos always track the rewritten dependencies.
- 2026-02-02 / chatgpt: Added `org/prepare-org-site.js` + `org/push-org-site.js`; helper now rewrites `sitemap*.xml(.gz)` `<loc>` entries to `CANOPY_BASE_URL`, renders `root/index.mdx` (+ `_app.mdx`) to HTML, copies only README/robots/CSS, and publishes a minimal `.org-build/` (no `/app` directory) before pushing to `canopy-iiif.github.io`.
- 2026-03-14 / chatgpt: Introduced the template-i18n source directory plus `TEMPLATE_SOURCE_DIR` override so the release workflow can publish `canopy-iiif/template-i18n` alongside the default starter.
- 2026-03-30 / chatgpt: Added the essay template variant plus a reusable preview helper so any template can be staged locally (`npm run preview:template*`).
- 2026-10-02 / claude: `preview-template.js` now previews against this checkout's `@canopy-iiif/app`. After `npm install` it builds the UI, runs `npm pack -w @canopy-iiif/app`, and installs the tarball with `--no-save`. Previews therefore show unreleased lib/ui changes, packed with the same `files` list as a publish. A tarball rather than a symlink keeps the package resolving React from the preview's `node_modules`; a symlink caused duplicate-React SSR failures. Pass `--published` to preview against the released package.
- 2026-10-02 / claude: Removed the essay template (`template-essay/` and `npm run preview:template-essay`). It was never published, and its `_app.mdx` relied on tokens Canopy never defined (`--color-surface`, `--color-canvas`, `--color-brand-*`). The `.gitignore` entries for `.template-essay-*` stay so existing local preview folders aren't picked up by git.
- 2026-10-02 / claude: `prepare-template.js` now copies a variant's `DESIGN.md` and overlays a variant's `app/` directory after `writeTailwindFiles()`, so variants can ship their own `app/styles/*.css`. Variants without `app/` are unaffected.
