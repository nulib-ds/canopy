# Design Brief: Canopy Template (Northwestern)

**Status: Draft — scaffolding only.** This file is the living record of layout, theme, and styling decisions for the Northwestern-branded Canopy template. Most sections below are placeholders to be filled in during a follow-up design pass, not final decisions.

## Brand & Identity

- Institution: Northwestern University Libraries
- Reference: https://www.northwestern.edu/brand/visual-identity/color-palettes/
- **TODO:** confirm which visual identity guidelines apply — the main University brand, or a Libraries-specific brand if one exists.

## Color Palette

Northwestern's brand purple and "Rich Black" grayscale are already documented as a worked example elsewhere in this monorepo, at `content/docs/theme/index.mdx` ("Styling" → "CSS Variables"). That's the starting point here, not something to re-derive:

- Accent (`--color-accent-700`): `#4e2a84` ("Northwestern Purple")
- Full accent ramp (50–900) and "Rich Black" gray ramp (50–900): see `content/docs/theme/index.mdx` for the complete scale with named comments.

**TODO:** decide how this actually gets applied to the template:
- Option A — keep using `canopy.yml`'s `theme.accentColor`/`grayColor` fields with the closest stock Radix token (`purple`/`slate`, the current placeholder in this template's `canopy.yml`). Simple, but not pixel-accurate to Northwestern's brand.
- Option B — ship a real (uncommented) `app/styles/custom.css` with the exact hex ramp already documented in `content/docs/theme/index.mdx`. Matches brand precisely, requires overriding `!important` on the generated theme tokens per that doc's "Production Build Considerations" section.

## Typography

**TODO:** confirm whether to keep Canopy's default typefaces (Fraunces for display, IBM Plex Mono for code) or adopt Northwestern's official brand typefaces.

## Logo & Imagery

**TODO:** source an approved Northwestern/NUL logo mark for the header. The current placeholder in `_app.mdx` is the generic Canopy circle-swoosh SVG, unchanged from the default template.

## Layout & Components

**TODO:** any Northwestern-specific layout conventions — header treatment, footer requirements, homepage hero structure, work-page layout — to be defined in the next working session.

## Content Voice

**TODO:** tone/voice guidance for placeholder and example copy, if it should differ from the generic Canopy starter copy.

## Technical Notes

- `canopy.yml`'s `featured:` list **must** be present and non-empty — the homepage's `<RelatedItems top={3} />` (and, transitively, the `<Interstitials.Hero />` on the same page) fails to render if it's missing, with no build error surfaced. Confirmed empirically while scaffolding this template. Keep `featured:` populated with real manifest URLs any time `canopy.yml` here is edited.

## Open Decisions

- [ ] Color tokens — `canopy.yml` theme fields vs. custom CSS override (see Color Palette above)
- [ ] Typography
- [ ] Logo / wordmark asset
- [ ] Layout variations from the default template
- [ ] Final demo collection (currently: Northwestern's [University Archives Postcards](https://api.dc.library.northwestern.edu/api/v2/collections/bd90de9e-8e1e-43c4-8009-dd13a916a2ac?as=iiif) collection)
