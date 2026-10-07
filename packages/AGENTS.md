Workspace Agent Notes
=====================

Purpose
-------
- Coordinate long-running cleanup and architecture work inside `packages/`.
- Provide a launchpad that links to per-directory playbooks and records cross-cutting decisions.

Directory Playbooks
-------------------
- `packages/app/AGENTS.md`: Published package overview and coordination notes.
- `packages/app/lib/AGENTS.md`: Builder, IIIF pipeline, search runtime.
- `packages/app/ui/AGENTS.md`: Browser bundle, hydration patterns, Tailwind assets.
- `packages/helpers/AGENTS.md`: Maintenance scripts and release automation.

Active Themes
-------------
1. Keep helper scripts confined to `packages/helpers/`; add npm scripts instead of creating a root `scripts/` directory.
2. Maintain the release contract: only `@canopy-iiif/app` is publishable, and UI assets must be built via `prepublishOnly`.
3. Tailwind 4 is the baseline: CLI resolution goes through `@tailwindcss/cli`, configuration is CSS-first in `app/styles/index.css`, and `lib/build/theme-tokens.js` injects the `canopy.yml` tokens (with `@layer theme, properties;` so Tailwind's defaults rank below them). The JS preset/plugin/`ui/tailwind-config` are deprecated no-ops.
4. Guard SSR safety by importing UI code through `@canopy-iiif/app/ui/server` on the Node side and keeping browser bundles free of inlined React deps.
5. Track search/IIIF roadmap items centrally so both lib and UI teams stay aligned.

Session Ritual
--------------
- Begin by scanning the per-directory `AGENTS.md` files to refresh outstanding TODOs.
- Log new findings or decisions back into the relevant file before ending the session.
- Note verification commands executed (tests, builds) so future sessions know the latest baseline.

Reference Commands
------------------
- Full build/dev loop: `npm run build` / `npm run dev`
- UI bundle only: `npm -w @canopy-iiif/app run ui:build`

Related Docs
------------
- Root overview: `AGENTS.md`
- Release workflow: `.github/workflows/release-and-template.yml`
- IIIF configuration: `canopy.yml`
