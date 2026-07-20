# Canopy IIIF

A project of [Northwestern University Libraries](https://www.library.northwestern.edu/).

Create fast, light digital projects from IIIF collections. Canopy IIIF helps libraries, archives, museums, and researchers add narrative context to IIIF material without worrying about derivatives or storage. Author in Markdown, publish static sites, and keep maintenance low while showcasing interoperable collections.

[![Deploy to GitHub Pages](https://github.com/nulib-ds/canopy/actions/workflows/deploy-pages.yml/badge.svg)](https://github.com/nulib-ds/canopy/actions/workflows/deploy-pages.yml) [![Release and Template](https://github.com/nulib-ds/canopy/actions/workflows/release-and-template.yml/badge.svg)](https://github.com/nulib-ds/canopy/actions/workflows/release-and-template.yml)

**Starting fresh?** Follow the Get Started guide and build from https://github.com/nulib-ds/canopy-template. This `canopy` repo is reserved for core Canopy development and documentation and should not be cloned for digital projects.

- **[Documentation](https://nulib-ds.github.io/canopy/)**
- **[Get Started](https://nulib-ds.github.io/canopy/about/get-started)**
- **[Template](https://github.com/nulib-ds/canopy-template)**

## GitHub Pages

Follow the [Get Started](https://nulib-ds.github.io/canopy/about/get-started) to deploy a lightweight digital project to GitHub Pages in minutes.

## Requirements

- **Node.js** `>=24.0.0`
- **npm** `>=10.0.0`
- nvm users: a `.nvmrc` is included — run `nvm use`

## Local development

- `npm install`
- `npm run dev` (serves http://localhost:5001 via `app/scripts/canopy-build.mts`)
- `npm run build` (renders UI assets + site)

Refer to https://nulib-ds.github.io/canopy/docs/developers for full environment, caching, and repo structure notes.

## Documentation Map

- Getting started basics: https://nulib-ds.github.io/canopy/docs/
- Content authoring, routes, and MDX layouts: https://nulib-ds.github.io/canopy/docs/content/
- Components, hydration, and interactive search: https://nulib-ds.github.io/canopy/docs/components/
- Theme controls, Tailwind presets, and CSS tokens: https://nulib-ds.github.io/canopy/docs/theme/
- IIIF ingestion, search indexing, and data flows: https://nulib-ds.github.io/canopy/docs/canopy/
- Developer workflow, publishing, and troubleshooting: https://nulib-ds.github.io/canopy/docs/developers/

Each page links to deeper guides (assets, works layouts, Search composition, etc.), so the README stays light.

## Template Workflow

- `.github/workflows/release-and-template.yml` publishes packages and, on release, stages a clean build into `.template-build/` before force-pushing to `nulib-ds/canopy-template`.
- The staging step strips dev-only paths, rewrites `package.json` to consume published `@canopy-iiif/app` bundles, and keeps the template’s workflow lean.
- Provide a personal access token as the `TEMPLATE_PUSH_TOKEN` secret and mark `nulib-ds/canopy-template` as a template repo if you want the GitHub “Use this template” button.
- Details live at https://nulib-ds.github.io/canopy/docs/developers/#template-workflow.

## Publishing `@canopy-iiif/app`

- The distributable package lives in `packages/app` and exports the builder plus UI assets.
- Use Changesets (`npm run changeset`) to record versions, run `npm run release`, and let the release workflow publish to npm before the template sync runs.
- Keep `repository`, `files`, and `publishConfig.access: public` in `packages/app/package.json` so npm users and GitHub Insights can trace dependents.
- Publishing guidance, update workflows, and automation hooks are documented at https://nulib-ds.github.io/canopy/docs/releases/.

## License

Canopy IIIF (Canopy) is an open-source project of [Northwestern University Libraries](https://www.library.northwestern.edu/), created by Mat Jordan and Mark Baggett, released under the MIT License. Anyone may adapt its features and deploy digital projects without restriction. By working directly with IIIF resources, Canopy keeps materials with the libraries, museums, and archives that serve them, along with their metadata, rights statements, and terms of use. Implementers should be aware of the rights and terms governing the materials they reference, publish, and deploy to the web using Canopy.
