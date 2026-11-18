# Canopy Design Rules

The rules for how Canopy looks and behaves: the components in `packages/app/ui`, the theme
`packages/app/ui/theme.js` builds from `canopy.yml`, the HTML and runtimes the builder in
`packages/app/lib` writes, and the templates under `packages/helpers/`. §0 outranks
everything else in this file. §1 holds the tokens components draw with: color, type,
shape and surfaces, focus, the black materials and the brush stroke, and layout.

## 0. Prime directive: WCAG 2.2 AA

Every component, runtime, template and style Canopy ships conforms to WCAG 2.2 at Level AA,
and so does the docs site this repository builds. This outranks every other rule in this
file, every request and every deadline. No look, brand, size budget or schedule excuses a
failure.

- A change that fails a criterion does not ship. Fix it or take it back.
- When a design, a brand rule or a request conflicts with a criterion, conformance wins.
  Say so, and offer the way that conforms.
- Check each change against the criteria it touches: keyboard and focus (2.1.1, 2.1.2,
  2.4.3, 2.4.7, 2.4.11), bypass blocks (2.4.1), names, roles and states (4.1.2, 2.5.3),
  contrast (1.4.3, 1.4.11), target size (2.5.8), gestures and dragging (2.5.1, 2.5.7),
  motion (2.2.2, 2.3.1, `prefers-reduced-motion`), reflow and text spacing (1.4.10,
  1.4.12), content on hover or focus (1.4.13), status messages (4.1.3), language of the
  page and its parts (3.1.1, 3.1.2), consistent navigation and identification (3.2.3,
  3.2.4), headings, labels and structure (1.3.1, 2.4.6), text alternatives (1.1.1), media
  (1.2, 1.4.2).

### Canopy's own rules

- **Theme defaults are Canopy's responsibility.** Every palette `canopy.yml` offers, in
  light and dark, gives Canopy's default pairs their ratios: text 4.5:1; large text,
  controls' edges and focus indicators 3:1. A site's own overrides are the site's; a
  default that fails is a Canopy bug. `tests/unit/a11y/contrast.test.js` checks every
  palette and a range of hex accents, as the build emits them (§1).
- **Accessible before any script runs.** Components render usable, named markup at build
  time. A placeholder that waits for a runtime has a name and says what is loading
  (the Clover placeholders do not yet: R2). Mounting never moves focus, reorders content
  or drops a name.
- **Every word comes from the locale files.** Labels, accessible names and announcements
  are read with `getString` from `locale.yml`, never typed in English inside a component,
  so a Spanish page never announces English (3.1.1, 3.1.2). That includes role
  descriptions (`aria-roledescription`), as the hero carousel's are.
- **Nothing moves on its own without a pause.** Content that moves or advances by itself
  for more than five seconds shows a pause control first in its reading order, stops
  while hovered or focused and for good once a visitor uses a control, and never starts
  under `prefers-reduced-motion: reduce` (2.2.2). Rotation is not announced; a move the
  visitor makes is. The hero carousel is the pattern (`hero-slider-runtime.js`).
- **Targets and drags.** Controls are at least 24×24 CSS px, or spaced as 2.5.8 allows.
  Every drag has a single-pointer alternative (2.5.7).
  A control with nothing left to do at the end of a sequence is `aria-disabled`, never
  `disabled`, so focus stays put (2.4.3).
- **Headings follow the page.** A component that renders a heading takes `headingLevel`
  and nests what it holds exactly one level below it (1.3.1). No heading level is skipped.
- **Focus stays visible and in view.** No global rule removes outlines, or the shadows
  that draw edges and rings. A component that sets `outline: none` draws its own
  indicator in `--color-accent-default`. The
  sticky header never covers the focused element (`scroll-padding-top`, 2.4.11). Focus
  order follows reading order. A ring drawn outside an element must survive a container
  that clips it: draw it inside the element there, or on the container.
- **Links in running text are underlined**, never told apart by color alone (1.4.1).
  Text with nowhere to break wraps rather than push the page sideways (1.4.10).
- **A modal dialog holds focus.** It takes focus as it opens, keeps Tab and Shift+Tab
  inside, closes on Escape and gives focus back to what opened it (2.4.3). It is named for
  what it is ("Search", "Filters"; `CanopyModal`'s `ariaLabel`), not by the brand at its
  top (2.4.6). The header's dialogs (`CanopyHeader.jsx` and its script) and the search
  filters (`SearchFiltersDialog.jsx`) are the pattern.
- **What a search finds is said.** A count or summary that changes as a visitor types is a
  status message (`role="status"`), said once typing pauses rather than at every key
  (4.1.3): the search page's summary and the header's suggestions.
- **One thing, one name.** A control that does the same thing on two pages has the same
  name and look on both (3.2.4); navigation stays in the same order across pages (3.2.3).
- **Brand layers restyle; they never lower a ratio, hide focus or remove a name.** The
  Northwestern template follows this section before its own brief.
- **Clover is audited upstream; the integration is ours.** The viewer, slider, image and
  scroll are Clover's, which keeps its own register (`ACCESSIBILITY.md` in
  nulib-ds/clover). Canopy keeps its tokens at their ratios, keeps its CSS from undoing
  Clover's (layers, resets) and keeps its wrappers from dropping names or focus.

### How it is checked

| Layer | Command | What it checks |
| --- | --- | --- |
| Unit | `npm run test:unit` | Contrast for every palette and appearance (`tests/unit/a11y/`); names, roles and structure of server-rendered markup |
| Browser | `npm run test:a11y` | axe-core against every WCAG 2.0–2.2 A and AA rule on a built fixture site, plus keyboard focus, the sticky header, 320px reflow, the carousel, focus under forced colors, and search as a visitor uses it (`tests/a11y/`) |
| Any built site | `CANOPY_A11Y_SITE=site npm run test:a11y` | The same checks on a site you built, such as this repository's docs (`npm run build`) |
| Manual | Each release | A keyboard walk and a screen reader pass (VoiceOver, NVDA) through every template; findings go into `ACCESSIBILITY.md` |

Automated checks catch some failures. Most need a keyboard, a screen reader and a look.
Known failures and the plan to clear them are in the repository's `ACCESSIBILITY.md`. The
known-failure lists in the tests (`tests/a11y/known-failures.mjs`,
`tests/unit/a11y/contrast.test.js`) mirror it and only shrink: a newly found failure goes
into both with a plan, never to silence a regression.

## 1. Tokens

Components draw with tokens, never literal colors, so a theme or a site's own stylesheet
restyles all of them at once. The color tokens come from `canopy.yml` (`ui/theme.js`,
`ui/theme-palette.js`), written at the start of each site's stylesheet in
`@layer properties`, where a site's own rules come after them and win.

### Color

| Token | What it is | Held at |
| --- | --- | --- |
| `--color-gray-50` … `900` | The gray palette's ten steps (Radix steps 1–4 and 7–12) | Radix's own |
| `--color-gray-default` | Body text (gray 900) | 4.5:1 on gray 50 |
| `--color-gray-muted` | Muted text: captions, summaries, labels (gray 800) | 4.5:1 on gray 50 |
| `--color-accent-50` … `900` | The accent's ten steps, from a palette or a hex color | Radix's own, but 800 |
| `--color-accent-default` | Links, accent text, the primary fill, focus indicators (accent 800) | 4.5:1 on any palette's gray 50, and under accent 50 |
| `--color-accent-hover` | A filled accent control under the pointer or focus | 4.5:1 under accent 50 |
| `--clover-color-*` | Clover 4's tokens, each a `var()` of the ones above | As above |

- **A text step is held by its ratio, not picked by hand.** Level 800 of each role is
  moved toward black (white, in dark mode) only as far as 4.5:1 needs: against every
  gray's page for the accent, since `grayColor` may name any of them, and against its own
  page for the gray. Most palettes keep Radix's step 11 exactly.
  `tests/unit/a11y/contrast.test.js` measures every palette and a range of hex accents.
- **Draw text in the text tokens.** Text in the accent is `--color-accent-default`; muted
  text is `--color-gray-muted`. Accent steps 100 to 700 are fills, tints and edges: none
  holds 4.5:1 as text across palettes. A focus indicator, a checked box or an icon that
  carries a state takes `--color-accent-default` (3:1, 1.4.11).
- **A filled control's label is accent 50 on `--color-accent-default`**, and on
  `--color-accent-hover` under the pointer. The hover moves away from the label (darker on
  light, lighter on dark), mixed from `--color-accent-default` itself, so a site that sets
  its own accent gets a hover of its own color.
- **A hex accent** (`accentColor: "#0f62fe"`) takes the hex as step 9 and mixes the other
  steps from it in OKLab: toward the page for 1 to 8, toward black (white, in dark mode)
  for 10 to 12.

### Appearance

- `light` (the default) and `dark` draw one set of tokens. `dark` puts `class="dark"` on
  `<html>`.
- `auto` draws the light tokens, and the dark ones under
  `@media (prefers-color-scheme: dark)` and on `html.dark`. An inline script in each
  page's `<head>`, ahead of the stylesheet (`lib/build/appearance.js`), sets `light` or
  `dark` on `<html>` from the visitor's choice or their system, so the first paint is
  already right. `CanopyFooter` adds `AppearanceToggle`, a labeled native select. Without
  a script the tokens still follow the system, and the select stays hidden.
- A rule written for dark mode keys off `html.dark`, which every appearance that is dark
  sets.

### Type

The docs' [Style guide](/docs/theme/style-guide/) (`content/docs/theme/style-guide.mdx`)
draws every style below in a site's theme, its numbers read from the page. It is the
definition: where a component and the guide disagree, the component is wrong.

**Two families, two weights.** Google Sans Flex for headlines and the interface
(`--font-sans`, `--default-font-family`, `--canopy-font-display`); Source Serif 4 for
reading text (`--font-serif`, `--canopy-font-body`); the system's monospace for code.
Regular (400) and bold (700), `--canopy-weight-regular` and `--canopy-weight-bold`; no
weight between. Both families ship with the package and are served from the site itself
(`ui/fonts/`, OFL; `lib/build/fonts.js`).

**Eleven text styles, and nothing else.** Each is a mixin in `ui/styles/settings/_type.scss`
and a class for authors (`.canopy-type-<style>`, `base/_type.scss`):

| Style | Family, size, weight | Used for |
| --- | --- | --- |
| `display` | sans, `--canopy-text-display` (2 to 5.236rem), bold, −0.04em | A hero's headline |
| `title` | sans, `--canopy-text-title` (1.875 to 2.618rem), bold | A page's `h1`; a `<Feature>`'s, a `<Band>`'s, a gallery's title |
| `h2` | sans, `--canopy-text-2xl` (1.618rem), bold | `h2`; a list of related works |
| `h3` | sans, `--canopy-text-xl` (1.382rem), bold | `h3`; a dialog's, a timeline's title |
| `h4` | sans, `--canopy-text-lg` (1.125rem), bold | `h4` to `h6`; a slider's and a page result's title; the brand |
| `lede` | serif, `--canopy-text-lede` (1.125 to 1.375rem), muted | Words under a title: `.canopy-lead`, a summary, the hero's and a `<Feature>`'s words, the footer's sentence, a quotation |
| `body` | serif, `--canopy-text-body` (1.0625rem), line 1.618 | What an author writes; notes |
| `ui` | sans, `--canopy-text-md` (1rem) | Navigation, fields, a card's title (bold), a metadata value, table cells |
| `ui-sm` | sans, `--canopy-text-sm` (0.9375rem) | Buttons, captions, a card's second line, the footer, tabs, filters, counts |
| `label` | sans, `--canopy-text-label` (0.875rem), bold, uppercase, +0.06em, muted | A metadata field, a table's head, an eyebrow (in the accent), a date on a timeline |
| `code` | mono, `--canopy-text-code` (0.875rem) in blocks, 0.92em inline | Code |

- **Components take a style, never a size.** `@include type.<style>`; colors are the
  context's. `tests/unit/ui/type-scale.test.js` fails on a size, weight or tracking a UI
  stylesheet writes by hand, and on uppercase outside `label`. Tracking has tokens too
  (`--canopy-tracking-*`), for plain CSS such as `version-parity.css`.
- **As a magazine sets it** (Mat, 2026-11-15): a sans for headlines and the interface, a
  serif for reading, one serif on every page, marketing and long read alike (Newsreader
  was tried and read too light beside the headlines on a marketing page).
  - In the serif: the paragraphs, lists and quotes Markdown writes (no class), across the
    whole width of what holds them, as the components beside them are (Mat, 2026-11-18:
    paragraphs reach their container's edges; the 70ch measure is gone,
    `base/_common.scss`); every lede.
  - In the sans: headings, navigation, buttons (wherever they sit), cards, labels,
    metadata, tables, search, the footer, and whatever a Clover part draws.
  - `--canopy-font-body: var(--font-sans)` sets one family throughout, as the
    Northwestern template does (Akkurat Pro, at 1rem).
- Headings take their styles as element rules in `@layer base`, after Tailwind's preflight.
  A site's own `app/styles` base rules come later and win, so a 1.x site keeps its own
  faces and weights; its own `--font-serif` (Fraunces, in the 1.x template) is what its
  prose takes.

### Shape and surfaces

| Token | Value | What it is |
| --- | --- | --- |
| `--canopy-radius-sm` … `xl` | 4, 8, 12, 16px | Corners; what sits inside a rounded thing takes a smaller step. `pill` and `circle` too |
| `--canopy-surface` | gray 200 | A panel's solid fill: a block of color, not an outline |
| `--canopy-surface-raised` | gray 50 (light), gray 300 (dark) | A card's fill: the page in light mode, lighter than the page in the dark, where a shadow does not read |
| `--canopy-surface-sunken` | gray 300 (light), gray 100 (dark) | A well. Draw no muted text on it |
| `--canopy-edge` | between gray 300 and 400 | A hairline: decoration, never the only thing that marks a control |
| `--canopy-control-edge` | the muted text, 80% into the page | A field's and an outline button's edge, 3:1 against the page (1.4.11) |
| `--canopy-shadow-sm`, `md`, `lg` | soft, deeper in dark | Lifts; `--canopy-card-shadow` is a hairline and `md` |

- **Text holds its ratio on every surface it is drawn on.** The build holds the gray's
  text step at 4.5:1 on its page, on `--canopy-surface` and on `--canopy-surface-raised`,
  and the accent's on every gray's page and raised surface (`theme-palette.js`, the
  contrast test's `*-on-surface` and `*-on-raised` pairs).
- **Square and flat are one line each.** `--canopy-radius-sm: 0` and so on; for
  shadows, a zero shadow (`0 0 #0000`) rather than `none`, so a shadow Canopy builds from
  several stays valid. The Northwestern template sets them. Nothing forces a value on
  every element (ACCESSIBILITY.md, R1). Clover's `--clover-radius` follows
  `--canopy-radius-sm`.

### Focus

- `--canopy-focus-color` (the accent's text step, 3:1 or more on the page in every
  palette), `--canopy-focus-width` and `--canopy-focus-offset` (2px each). Components
  draw them with `focus-ring()` (`settings/_focus.scss`): an outline, which forced-colors
  mode keeps and which follows corners, standing off the element so the page shows
  between as a second tone. `focus-ring($inset: true)` draws it inside, where a
  container clips. `--canopy-focus-ring` is the same ring as a shadow, for a custom
  element that needs one.
- On black (`<Band>`, code blocks) the ring is white.

### Bands and code

- **Black materials.** `<Band>` and code blocks are black in both appearances, their
  words white or near-white (19:1 or more), their quieter words `--canopy-band-muted`
  (9:1 or more); on a dark page a hairline sets them off (`--canopy-band-edge`). A
  `<Button>` on a band takes the band's colors.
- **No brush stroke** since 2.0.2 (Mat, 2026-11-18: "the marker under things is a Clover
  thing. remove this in Canopy."). `<Swoosh>` draws nothing and its words read as they
  are; it stays so MDX written with it keeps working. The brand draws no stroke under the
  site's name; its focus ring is the controls' own.

### Space

- The golden steps from the page's 1rem, `--canopy-space-3xs` (0.146rem) to
  `--canopy-space-2xl` (4.236rem), as Clover's: the more closely two things belong
  together, the smaller the step between them; a container's inset is a step larger than
  the gap between what it holds.
- **Two columns**, as tokens: the page's own, `--canopy-container-content` (75rem,
  `<Container>`, `max-w-content`), and a wide one for sections side by side and the
  featured hero, `--canopy-container-wide` (90rem, `variant="wide"`, `max-w-wide`). Wider
  since 2.0.2 (1080 and 1300px), so a wide window keeps less of itself empty. The hero's
  words start where the sections' do: its panel's inset is `<Container>`'s, 1.618rem.
- **Sections apart** by a golden step between `--canopy-space-xl` and `-2xl`, by the
  window; sliders by `--canopy-space-xl`.

### Layout

- The header is 64px and sticks only where the window is at least 36rem tall: zoomed
  in, it scrolls away (1.4.10). While it sticks, `--canopy-sticky-top` is 4rem, the
  page's `scroll-padding-top` leaves room under it (2.4.11), and whatever else sticks
  stands below it.
- At its end the header holds the search, the primary navigation and the actions (2.0.2).
  At desktop widths the search is a button that opens into its field, a disclosure
  (`aria-expanded`): focus goes into the field, Escape gives it back to the button, and
  an empty field left behind closes. On the search page the field is the page's own and
  shows, with no button.
- A facet's slider (`<RelatedItems>`) is headed by its value, the link to every work with
  it (2.0.2), where Clover's header put "View all" beside it; the page's "View all" goes
  with the value, unseen (2.4.4).
- A work page (`canopy-work--layout`): from 961px the viewer and the work's words sit side
  by side, and a toggle at the viewer's corner (`aria-pressed`) spreads the viewer across
  the column with the words under it (2.0.2). Wherever the metadata has the whole width it
  runs in three columns at most, none under 16rem; its attribution and id keep the width.
