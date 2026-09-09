# Template Northwestern – AGENT Notes

Mission
-------
- Provide a Northwestern University Libraries-branded starting point for Canopy IIIF projects.
- Keep guidance grounded in the files this template actually ships with; point to `content/index.mdx`, `content/about/index.mdx`, `_app.mdx`, `canopy.yml`, and `DESIGN.md` when explaining changes.
- Treat `DESIGN.md` as the source of truth for branding decisions (color, typography, logo, layout) — it is a living document, not finished at scaffolding time.

Key Files
---------
- `canopy.yml` — points to a Northwestern Digital Collections collection so the demo renders immediately. `theme.accentColor`/`grayColor` are placeholders pending the design pass (see `DESIGN.md`).
- `_app.mdx` — footer credits Northwestern University Libraries; logo is still the generic Canopy mark (flagged as an open decision).
- `content/index.mdx` — homepage adapted from the default template with Northwestern-flavored copy.
- `content/about/index.mdx` — colophon-style "about this starter" page crediting Northwestern University Libraries.
- `DESIGN.md` — brand/design brief: color palette, typography, logo, layout decisions, and an open-decisions checklist.

Guidance
--------
- This variant is currently **scaffolding only** — no CI push job exists yet (mirrors how `template-essay` also has no live target repo). Preview locally via `npm run preview:template-northwestern` from the monorepo.
- Before wiring a real `nulib-ds/canopy-template-northwestern` repo, CI job, and push token, resolve the open items in `DESIGN.md` first.
- Northwestern's brand color ramp (purple accent + "Rich Black" grays) is already documented as a worked example in the monorepo's own `content/docs/theme/index.mdx` — treat that as the source of truth for exact hex values, not something to re-derive.

Logbook
-------
- 2026-07-20 / claude: Initial scaffolding — canopy.yml, _app.mdx, homepage, about/colophon page, README, and DESIGN.md brief. Theme, typography, and logo decisions intentionally left open pending a follow-up design pass.
