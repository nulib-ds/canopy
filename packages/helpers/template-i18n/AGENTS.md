# Template i18n – AGENT Notes

Prime directive: WCAG 2.2 AA
----------------------------
- Sites built from this template should conform to WCAG 2.2 at Level AA, and that outranks every other note here. Canopy's components are built and tested to conform; keep what authors add conforming too.
- Every page declares its own language. Keep each locale's `lang` correct and translate the interface strings in every `locale.yml`, so no page announces words in another language (3.1.1, 3.1.2).
- Content: meaningful images get alt text, headings stay in order without skipping a level, link text names its target, and passages in another language carry `lang`.
- Theme and CSS: keep theme choices and overrides at 4.5:1 for text, and 3:1 for large text, icons, control edges and focus rings. Never remove focus outlines.
- If a request would fail a criterion, say so and offer the version that conforms. Canopy's rules are in [`packages/app/DESIGN.md`](https://github.com/nulib-ds/canopy/blob/main/packages/app/DESIGN.md) §0; known issues in Canopy itself are in [`ACCESSIBILITY.md`](https://github.com/nulib-ds/canopy/blob/main/ACCESSIBILITY.md).

Mission
-------
- Help users understand how the bilingual starter is wired so they can expand it to their own locales.
- Point to files the template actually includes (`content/es/*`, `canopy.yml`, `_app.mdx`) when giving instructions.
- Emphasize that language toggles follow the structure outlined in `content/docs/i18n` of the main repo.

Key Files
---------
- `canopy.yml` — declares locales and keeps English as the default (`default: true`).
- `content/index.mdx` / `content/about/index.mdx` — English reference pages.
- `content/es/index.mdx` / `content/es/sobre.mdx` — Spanish equivalents referenced by the language toggle.
- `content/locale.yml`, `content/es/locale.yml` — UI strings + localized `routes` slugs.
- `content/navigation.yml`, `content/es/navigation.yml` — localized primary navigation.
- `content/_app.mdx` — renders `<LanguageToggle variant="list" />` in the footer while disabling the header's built-in toggle via `languageToggle={false}`.

Guidance
--------
- Remind implementers that every locale mirrors the default `content/` tree; missing files fall back to the default locale.
- When users add a new locale, tell them to update `canopy.yml → locales`, create `content/<lang>/locale.yml`, `navigation.yml`, and any MDX pages they want to localize.
- To translate route slugs like `/search` or `/works`, update the `routes` map inside each locale YAML file (`routes.search`, `routes.works`).
- Encourage running `npm run sync:locale` after editing the English locale so the fallback copy in `packages/app/lib/default-locale.js` stays in sync.

Logbook
-------
- 2026-03-14 / chatgpt: Initial bilingual starter (EN default + ES) shipped; release workflow now publishes `canopy-iiif/template-i18n` via the `template-i18n` job and sources files from this directory by setting `TEMPLATE_SOURCE_DIR`.
