# Canopy Template (i18n)

This variant of the Canopy template mirrors the primary starter while giving you a ready-to-use bilingual setup (English default, Spanish secondary). It follows the guidance in `content/docs/i18n` so you can study the structure and adapt it to your own locales.

## Highlights

- `canopy.yml` declares locales for English (`default: true`) and Spanish, which enables Canopy's locale-aware routing and UI copy.
- `content/` contains paired English + Spanish pages (`content/index.mdx`, `content/about/index.mdx`, `content/es/index.mdx`, `content/es/sobre.mdx`).
- `content/locale.yml` + `content/es/locale.yml` provide UI strings and translated route slugs (`routes.search`, `routes.works`).
- `content/navigation.yml` + `content/es/navigation.yml` keep the main menu localized.
- The shared `_app.mdx` renders the built-in header and adds a custom `<LanguageToggle />` in the footer so you can see how to reposition the control.

## Getting Started

1. Install dependencies: `npm install`.
2. Run `npm run dev` to start the builder + preview server.
3. Update `canopy.yml` with your IIIF collections/manifests and adjust `locales` if you need more languages.
4. Add or translate files under `content/<lang>/`—keep filenames and folder structure aligned between locales so the toggle can resolve matching routes.
5. Customize `content/<lang>/locale.yml` for UI copy, `content/<lang>/navigation.yml` for menu items, and drop translated MDX pages anywhere under that locale folder.

## Preview from the monorepo

From `nulib-ds/canopy`, run `npm run preview:template-i18n` to stage this variant into `.template-i18n-preview/`, install dependencies, and launch `npm run dev` so you can iterate locally.

Refer to https://nulib-ds.github.io/canopy/docs/i18n/ for the full internationalization guide, including optional layouts, language toggle variants, and notes on inheriting navigation or locale entries per directory.
