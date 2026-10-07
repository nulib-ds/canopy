# Design Brief: Canopy Template (Northwestern)

The living record of layout, theme, and styling decisions for the Northwestern-branded Canopy template. Decisions follow Northwestern's [brand guidelines](https://www.northwestern.edu/brand/) as encoded in the `northwestern-brand-skills` color, typography, and "unstated rules" skills.

## Where things live

| File | Role |
| --- | --- |
| `app/styles/northwestern.css` | Brand layer: `@font-face`, Purple/Rich Black tokens mapped onto Canopy tokens, header/footer/button treatment. Treat as upstream — avoid editing per project. |
| `app/styles/custom.css` | Project-specific overrides. Empty by default. |
| `app/styles/index.css` | Tailwind entry; imports Canopy UI, then `northwestern.css`, then `custom.css`. |
| `content/_app.mdx` | Font preloads, header wordmark, footer. |
| `canopy.yml` | `theme` fields are fallbacks only (`purple` / `sand`); `northwestern.css` wins. |

## Brand & Identity

- Institution: Northwestern University Libraries.
- Header shows the official white "Northwestern" wordmark from Northwestern's CDN (`common.northwestern.edu/v8/css/images/northwestern.svg`) on its own, with no unit/project label beside it.
- Canopy still renders the header's text label, the `canopy.yml` `title`. `northwestern.css` visually hides it so it can name the home link and the nav/search modals for screen readers. The wordmark image has empty `alt` so the name isn't read twice.
- Below `40rem`, and inside the nav/search modals, the wordmark drops to `1rem` tall.
- The wordmark is white-only. It must sit on Northwestern Purple (header, nav/search modal brand bar) or Purple 120 (footer). Never place it on white.

## Color

Northwestern's exact ramps, mapped onto Canopy's tokens in `northwestern.css`. Canopy places the `canopy.yml` theme before custom CSS, so these overrides win without `!important`.

| Canopy token | Northwestern value |
| --- | --- |
| `--color-accent-default` / `-700` | Purple 100 `#4E2A84` (Northwestern Purple) |
| `--color-accent-600` | Purple 90 `#5B3B8D` |
| `--color-accent-800` | Purple 120 `#401F68` |
| `--color-accent-900` | Purple 140 `#30104E` |
| `--color-accent-100`–`500` | Purple 10, 20, 30, 40, 60 |
| `--color-gray-50` | White `#FFFFFF` (page surface) |
| `--color-gray-100` | Off-White `#F0F0F0` (inset panels only) |
| `--color-gray-200`–`800` | Rich Black 10, 20, 40, 50, 60, 60, 70% |
| `--color-gray-900` / `-default` | Rich Black 80% `#342F2E` (primary text) |

- White is the predominant surface. Purple appears in the header bar, headings, links, and primary buttons; Purple 120 in the footer.
- Pure black (`#000000`) is never used.
- `--color-gray-400` maps to Rich Black 40% (3.7:1) rather than 30% so UI borders clear the 3:1 component contrast minimum.
- Raw brand values are exposed as `--nu-purple-*`, `--nu-rich-black-*`, `--nu-white`, `--nu-offwhite` for project CSS.
- Clover components (viewer, slider, image, scroll) follow these tokens through Canopy's `--clover-color-*` mapping, with square corners. `northwestern.css` overrides three of them on `:root`:
  - `accent-alt` → Purple 120, so hovers match the buttons
  - `secondary-alt` → Rich Black 10%
  - `secondary-muted` → Off-White

  The last two keep Clover's borders and handles light; the mapped gray 400/300 steps would be Rich Black 40%/20%.

## Typography

All faces load from Northwestern's central CDN (`common.northwestern.edu/v8/css/fonts/`, CORS `*`). Akkurat Pro is licensed for central hosting only — never copy the font files into `assets/`.

| Role | Face | Token |
| --- | --- | --- |
| Body, UI, navigation, buttons, h4–h6 | Akkurat Pro 400/700 | `--font-sans` |
| h1–h3 | Poppins 700, Northwestern Purple | `--font-display` (`font-display` utility) |
| Long-form editorial copy (opt-in) | Noto Serif 400/700 | `--font-serif` (`font-serif` utility) |

- Poppins is limited to h1–h3 because the brand forbids it below `1.375rem`. Navigation and buttons use Akkurat Pro Bold instead.
- Root font-size is `110%` (17.6px), matching Canopy's default template and sitting in Northwestern's 17–19px range for Akkurat Pro body copy. Body weight is 400 (Canopy's default template uses 300); line-height 1.7.
- Fallback stack is Arial → sans-serif. IBM Plex Sans is not loaded; add it from Google Fonts if the site will run where the CDN is unreachable.
- **Deviation:** the brand's `62.5%` root font-size convention is not adopted — Canopy's components are sized in `rem` against a 16px root, and changing it would shrink every component.

## Links & Focus

- In-copy links (`main p a`, `li a`, `dd a`, `blockquote a`) are always underlined. Purple next to Rich Black body text is only ~1.3:1, so color alone fails WCAG 1.4.1.
- Focus rings: 2px Northwestern Purple, white on purple surfaces.

## Shape & Borders

- Square corners everywhere — Canopy's UI already forces `border-radius: 0`, which matches the brand.
- No decorative borders. The footer drops Canopy's top rule in favor of the Purple 120 band.
- Cards (`.canopy-card`, used by search results and referenced items) drop their box border and sit on Off-White `#F0F0F0`.
- The hero keeps a single Rich Black 10% hairline at its base as a structural divider.

## Components

- **Header:** Northwestern Purple bar, opaque; white wordmark, label, nav links (Akkurat Pro Bold), and icons. Active/hover nav items get a 2px white underline. Because it is opaque, the hero's `-5rem` tuck-under margin is reset to `0`.
- **Nav/search modals:** the brand row becomes a full-bleed purple bar with a white close button (scoped to `.canopy-modal--nav` / `--search`).
- **Hero:** flat white (Canopy's lavender gradient removed); purple Poppins headline, Rich Black description, brand buttons.
- **Buttons:** primary = Purple 100 fill, Purple 120 on hover; secondary = white with Purple 100 outline/text, Purple 10 on hover. Akkurat Pro Bold, `0.75rem 1.5rem` padding.
- **Footer:** Purple 120 band, white wordmark linking to northwestern.edu, Libraries link, copyright + Canopy credit.

## Technical Notes

- `canopy.yml`'s `featured:` list **must** be present and non-empty — the homepage's `<RelatedItems top={3} />` (and, transitively, the `<Interstitials.Hero />` on the same page) fails to render if it's missing, with no build error surfaced.
- The monorepo's template staging (`packages/helpers/template/prepare-template.js`) overlays this variant's `app/` directory after copying the monorepo's `app/styles/`, so files here win.

## Open Decisions

- [x] Color tokens — exact ramps via `app/styles/northwestern.css`
- [x] Typography — Akkurat Pro / Poppins / Noto Serif from the Northwestern CDN
- [x] Logo — official white wordmark from the Northwestern CDN on a purple header
- [ ] Confirm the standalone wordmark header with University Marketing, or replace it with an official Libraries lockup
- [x] Hero treatment on the homepage — flat white, hairline base
- [ ] Work-page layout variations from the default template
- [ ] Content voice for starter copy
- [ ] Final demo collection (currently: Northwestern's [University Archives Postcards](https://api.dc.library.northwestern.edu/api/v2/collections/bd90de9e-8e1e-43c4-8009-dd13a916a2ac?as=iiif) collection)
