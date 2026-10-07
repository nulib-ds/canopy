# Template Northwestern – AGENT Notes

Mission
-------
- Provide a Northwestern University Libraries-branded starting point for Canopy IIIF projects.
- Keep guidance grounded in the files this template actually ships with; point to `content/index.mdx`, `content/about/index.mdx`, `_app.mdx`, `canopy.yml`, `app/styles/`, and `DESIGN.md` when explaining changes.
- Treat `DESIGN.md` as the source of truth for branding decisions (color, typography, logo, layout) — it is a living document, not finished at scaffolding time.

Key Files
---------
- `canopy.yml` — points to a Northwestern Digital Collections collection so the demo renders immediately. `theme.accentColor`/`grayColor` are fallbacks only; `app/styles/northwestern.css` overrides them.
- `app/styles/northwestern.css` — brand layer: Northwestern CDN `@font-face` (Akkurat Pro, Poppins, Noto Serif), exact Purple/Rich Black ramps mapped onto Canopy tokens, header/footer/button treatment.
- `app/styles/custom.css` — empty slot for project-specific overrides; keep brand changes out of it.
- `_app.mdx` — font preloads, v4-style Purple 120 top bar with the official white wordmark (from the Northwestern CDN), Purple 120 footer.
- `content/index.mdx` — homepage adapted from the default template with Northwestern-flavored copy.
- `content/about/index.mdx` — colophon-style "about this starter" page crediting Northwestern University Libraries.
- `DESIGN.md` — brand/design brief: color palette, typography, logo, layout decisions, and an open-decisions checklist.

Guidance
--------
- Published by the `template-northwestern` job in `.github/workflows/release-and-template.yml` to `nulib-ds/canopy-template-northwestern`, alongside `canopy-template` and `canopy-template-i18n`, whenever a release publishes. The job reuses the `TEMPLATE_PUSH_TOKEN` secret (the Canopy CI PAT); that PAT's repository access must include `nulib-ds/canopy-template-northwestern`.
- Preview locally via `npm run preview:template-northwestern` from the monorepo.
- Brand values come from the `northwestern-brand-skills` color, typography, and "unstated rules" skills; `DESIGN.md` records how each maps onto Canopy tokens.
- Never self-host Akkurat Pro or copy the font files into `assets/` — the license allows central hosting only.
- The `prepare-template.js` overlay copies this directory's `app/` after the monorepo's `app/styles/`, so variant styles win.
- In MDX, a top-level `//` line is markdown text, not a JS comment — it swallows the next `export`. Put comments inside the export.

Logbook
-------
- 2026-07-20 / claude: Initial scaffolding — canopy.yml, _app.mdx, homepage, about/colophon page, README, and DESIGN.md brief. Theme, typography, and logo decisions intentionally left open pending a follow-up design pass.
- 2026-10-02 / claude: Design pass — exact brand tokens and CDN fonts in `app/styles/northwestern.css`, purple header with the official wordmark, Purple 120 footer, underlined in-copy links. Restored the `preview:template-northwestern` script, `.gitignore` entry, and `DESIGN.md` copy; added the variant `app/` overlay to `prepare-template.js`.
- 2026-10-02 / claude: Dropped `!important` from the `northwestern.css` tokens and cut its Clover block to the three values that differ from Canopy's mapping (`accent-alt`, `secondary-alt`, `secondary-muted`). Needs an `@canopy-iiif/app` release newer than 1.13.1, which places the theme before custom CSS and emits `--clover-color-*`. Verified against a local-package build: computed tokens and Viewer, slider and header styles are unchanged on the homepage, About and a work page.
- 2026-10-02 / claude: Dropped the "| Libraries" header label; the wordmark stands alone.
  - `_app.mdx` no longer passes `title`, so Canopy's label is the `canopy.yml` title.
  - `northwestern.css` visually hides that label. It still names the home link and the nav/search modals (`aria-labelledby`) for screen readers, and the wordmark has empty `alt` so the name isn't read twice.
  - Removed the Purple 60 hairline and the label-stacking rules.
  - The modal brand bar gets `min-height: 4.5rem` so the wordmark stays centered on the close button now that the label no longer adds height.
- 2026-10-07 / claude: Rebuilt the header on Northwestern's v4 department templates. `_app.mdx` renders a `.nu-top-bar` (Purple 120, wordmark linked to northwestern.edu) above `CanopyHeader`, which no longer gets a `logo`. `northwestern.css` lays the header out as a grid on a 1120px column: uppercase purple site name with an underlined search, then a full-bleed nav row between Purple 30 rules. The search overrides are unlayered because Canopy's search-form styles are. Removed the hidden-label, purple modal bar, and white-on-purple nav rules.
