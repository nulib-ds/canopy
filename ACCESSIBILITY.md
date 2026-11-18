# Accessibility

WCAG 2.2 at Level AA is this repository's prime directive: non-negotiable, for the
package, the templates and the docs site alike (`AGENTS.md`, `packages/app/DESIGN.md`
§0). This file holds what is known to fail and the plan to clear it. Fixing any of it
is always in scope. When you do, remove its entry in the tests
(`tests/a11y/known-failures.mjs`, `tests/unit/a11y/contrast.test.js`) and move its row
to Fixed; the checks fail until the entry is gone.

## Baseline of November 13, 2026 (1.14.1)

- **The fixture sites**, `npm run test:a11y`: axe-core 4.14 with every WCAG 2.0, 2.1
  and 2.2 rule at Level A and AA; a keyboard walk that checks each stop's focus is
  visible, uncovered and in view, and that Tab keeps moving; reflow at 320px; and the
  hero carousel's pause control. It runs on a site built offline from each template: the
  default template in light and dark, and the i18n and Northwestern templates in light
  (152 checks on 38 pages, Spanish pages included).
- **The docs site**, `npm run build` then `CANOPY_A11Y_SITE=site CANOPY_A11Y_REPORT=1
  npm run test:a11y`: the same checks on 224 pages with live IIIF. It found 791 failures
  of 14 rules.
- **Every theme**, `tests/unit/a11y/contrast.test.js`: each color pair Canopy's theme
  draws, for all 31 palettes as the accent and as the gray, light and dark.
- **The components' JSX**, `npm run lint:a11y`: `eslint-plugin-jsx-a11y`'s recommended
  rules over `packages/app/ui/src`.
- **The code**, read for what the checks cannot see.

## Known failures

Owners: Canopy's own code, and Clover drawn through Canopy's wrappers: Clover 4
(`@nulib/clover`) in 2.x, which keeps its own register (`ACCESSIBILITY.md` in
nulib-ds/clover). The Northwestern template has none open.

### Canopy

| Id | Criterion | What fails | Where | Found by | Plan |
| --- | --- | --- | --- | --- | --- |
| C10 | 1.3.1 Info and Relationships | `Index` wraps its `dd`s in a `div` without their `dt`, and puts its "Show more" button inside the `dl`. | `packages/app/ui/src/content/Index.jsx` | axe `definition-list`, docs `/docs/components/metadata-index.html` | One `dl` of a `dt` and its `dd`s per group, the button after it |

### Clover 4, through Canopy's wrappers

From Clover's own register, live in 2.x since Canopy draws its Viewer and Image with
Clover 4.

| Id | Criterion | What fails | Where | Found by | Plan |
| --- | --- | --- | --- | --- | --- |
| C21 | 2.5.7 Dragging Movements | An image Canvas pans by dragging alone unless its navigator is shown (Clover's N25). | `Viewer`, `Image` | Clover's register | Clover's fix (N25); until then, show `Image`'s navigator |

## Fixed

Each fix is checked by `npm run test:a11y`; its known-failure entry is gone.

- **C31**, 1.4.3 (2.x Phase 6, November 15, 2026): search fields' placeholders were too
  faint to read. The header's was gray step 9 at 75%, 2.29:1 on the page in slate; the
  search filters' value field drew the browser's own placeholder gray; the Northwestern
  brief's Purple 30 is 2.2:1. Each takes the muted text now, 4.5:1
  (`search/_form.scss`, `search/_filters.scss`), and Northwestern's Purple 70, 5.2:1
  (`northwestern.css`). Found reading the code for the 2.x look.
- **C32**, 2.4.7 (2.x Phase 6, November 15, 2026): the header search's suggestions
  showed keyboard focus only as a fill a step darker than the page, near 1:1. The one in
  focus takes a ring (`search/_results.scss`).
- **C33**, 4.1.2 and 3.1.2 (2.x Phase 6, November 15, 2026): a page among search results
  drew any link in its snippet inside the card's own link, a link in a link, and said
  "(opens in new tab)" in English on every page. The snippet keeps the link's words
  alone (`ArticleCard.jsx`).
- **C34**, 3.1.2 (2.x Phase 6, November 15, 2026): a code block's copy button, on every
  fenced block that asks for one, said "Copy", "Copy code to clipboard" and "Copied to
  clipboard" in English. They come from `common.actions.copy`, `common.phrases.copy_code`
  and `common.phrases.copied_code` in `locale.yml`, with Spanish in the i18n template
  (`CodeBlock.jsx`).
- **C35**, 1.4.11 (2.x Phase 6, November 15, 2026): the search filters' value field drew
  its edge in gray step 4, 1.2:1 against its panel. It takes `--canopy-control-edge`, 3:1
  or more for every palette (`search/_filters.scss`; the contrast test's `control-edge`).
- **C36**, 2.4.7 (2.x Phase 6, November 15, 2026): the header dialogs' close button
  showed focus only as a change from accent step 12 to step 11, nearly the same color.
  It takes the focus ring, inside the panel that clips (`modal/_modal.scss`).
- **C37**, 2.4.7 (2.x Phase 6, November 15, 2026): under forced colors (Windows High
  Contrast), the Northwestern header's links showed no focus: a dark fill with white words,
  both of which the mode replaces, and no outline. They keep a transparent outline, which
  the mode draws (`northwestern.css`). Found by `tests/a11y/specs/forced-colors.spec.mjs`,
  new: a keyboard walk under forced colors on the default and Northwestern templates.
- **C38**, 2.4.3 (2.x Phase 6, November 15, 2026): a `<Gallery>` popup, closed, still
  held what a viewer mounted in it made visible again: the docs' Gallery page sent
  keyboard focus into an Image Story's canvas and buttons, off screen, behind the page.
  A closed popup is `inert` now, and an open one is not (`Gallery.jsx`'s runtime). Found by
  the keyboard walk, which had stopped short of it: it told focus stops apart by their
  place in the window, so code blocks one after another, coming to rest at the same spot
  under the sticky header, read as one stop held (`keyboard.spec.mjs` now keys each stop by
  its place in the document).
- **C39**, 4.1.3 (2.x Phase 7, November 16, 2026): what a search found was shown and
  never said. The search page's summary ("Found 3 of 175 in Works for…") changed with
  every key and was no status message, and the header's suggestions appeared with
  nothing to tell a screen reader they had. Both are status messages now, said once
  typing pauses (`search-app.jsx`'s `SummaryMount`, `search-form-runtime.js`), the count
  of suggestions in `locale.yml`'s words (`common.nouns.suggestion`, `suggestions`,
  `common.phrases.count_content`). Found by `tests/a11y/specs/search.spec.mjs`, new: search
  as a visitor uses it, on the search page and off it, in both languages.
- **C40**, 3.1.2 (2.x Phase 7, November 16, 2026): the header's suggestions named their
  groups "Works" and "Pages" in English on every page, Spanish ones included. They take
  `common.types` from the page's locale, and each group is a group named by its label
  (`search-form-runtime.js`).
- **C41**, 2.4.3 (2.x Phase 7, November 16, 2026): the search filters' dialog
  (`aria-modal`) left focus on the Filters button behind it as it opened, let Tab leave it
  for the works behind, did not close on Escape, and dropped focus to the page as it
  closed; and "Clear all", made `disabled` once nothing was left to clear, dropped the
  focus it held. The dialog now takes focus, keeps Tab inside, closes on Escape and gives
  focus back to the Filters button, and "Clear all" is `aria-disabled`
  (`SearchFiltersDialog.jsx`). It is named for what it is, "Filters", where the site's
  title named it, and on the docs site that title was `canopy.yml`'s placeholder, "Site
  title" (`CanopyModal`'s new `ariaLabel`); the header's dialogs, named by the site's
  title too, are "Search" and "Primary navigation" (2.4.6). Found by hand on the docs site;
  `search.spec.mjs` checks the filters by keyboard, in both languages, and
  `dialogs.spec.mjs` the header dialogs' names.
- **C42**, 3.1.2 (2.x Phase 7, November 16, 2026): a search page in a language other than
  the site's default was titled in the default's words: `/es/buscar` was "Search", as
  `canopy.yml`'s one `search.page.title` titled every search page. Such a page takes its
  locale's `common.nouns.search` now ("Buscar"; `lib/search/search.js`), for its `<title>`
  and its new `h1`. Found making the `h1` (R7); `search.spec.mjs` checks both languages.
- **C43**, 1.4.1 (2.x Phase 8, November 16, 2026): a footnote's link back to where it was
  called (↩) was told from the words around it by its color alone. C11's underline takes
  the links Markdown writes by their having no class, and GFM gives this one the class
  `data-footnote-backref`; the rule in `base/_common.scss` takes it too now. Found by
  axe (`link-in-text-block`) on the 1.x default template's `about/example` page, built
  as a 1.x site upgraded to 2.x; the fixture's Prose page has a footnote now.
- **R7**, resolved (2.x Phase 7): the search page had no `h1` or `h2`, and each page or
  annotation result's title was an `h3`, against `DESIGN.md` §0's "No heading level is
  skipped" (1.3.1). The default search layout (`content/search/_layout.mdx`) opens with
  the page's title as its `h1`, and the results' titles sit one level below the last
  heading before them, `h2` there: `ArticleCard` takes `headingLevel` (3 by default, as
  in 1.x), which `<SearchResults headingLevel>` sets or the runtime works out. A layout of
  a site's own keeps the headings it has, and should give the page its `h1`. Checked by
  `search.spec.mjs`: one `h1`, no level skipped, the results at `h2`.
- **R5**, resolved (2.x Phase 7): the search tabs follow WAI-ARIA APG's tabs pattern. One
  tab stop, the arrows, Home and End move between them, the selection follows focus, and
  the results are the selected tab's panel, named by it (`SearchTabs.jsx`,
  `SearchResults.jsx`); with no matches the panel takes focus itself, and shows it. The
  moving bar follows focus as well as the pointer. Checked by `search.spec.mjs`.
- **R3**, resolved (2.x Phase 6): the header search field's edge is
  `--canopy-control-edge`, 3:1 or more against the page for every palette, light and
  dark, where it was 1.19:1.

- **C1**, 2.2.2 (2.x Phase 4, November 14, 2026): the hero carousel is hand-rolled after
  WAI-ARIA APG's auto-rotating carousel, in place of Embla
  (`lib/components/hero-slider-runtime.js`, `ui/src/interstitials/Hero.jsx`).
  - Its pause control comes first in its reading order.
  - Rotation holds while the pointer is over it, and stops for good on keyboard focus,
    on any of its controls or on a swipe.
  - It never starts under `prefers-reduced-motion: reduce`.
  - Its slides are `aria-live="off"` while they rotate and polite once stopped, so only a
    visitor's own move is announced.
  - One slide shows at a time, so no hidden slide takes focus, and without a script the
    first one shows alone, with no controls.
  - The motion check now tests what a carousel does, on a page clock, rather than a
    button's English name; `tests/a11y/specs/carousel.spec.mjs` checks the rest.
  - Since 2.0.2 (November 18, 2026) the hero does not rotate: it moves only when a
    visitor moves it, so it has nothing to pause, and the pause control is gone. Its
    slides are polite from the start. `carousel.spec.mjs` checks that nothing moves on
    its own; the motion check still fails a carousel that advances with no pause first.
- **C3**, 3.1.2 (2.x Phase 4, November 14, 2026): the carousel's words, its role
  descriptions ("carousel", "slide") among them, and the hero's default "View work" link
  come from `common.carousel` and `common.actions.view_work` in `locale.yml`, with
  Spanish in the i18n template. `carousel.spec.mjs` checks both languages.
- **C30**, 1.4.11 (2.x Phase 4, November 14, 2026): the carousel's slide buttons drew
  their dots in accent step 7, 1.85:1 on the page in the default indigo. They take
  `--color-gray-muted` (4.5:1), and the current one the accent, drawn larger, so its
  state is not in its color alone (`_interstitial-hero.scss`). Found reading the code.
  Since 2.0.2 the dots are that gray at 80%, the hero's ground showing through; 3.42:1
  at worst (light, mauve on crimson), held by `tests/unit/a11y/contrast.test.js`.

- **C4**, 1.4.3 (2.x Phase 3, November 14, 2026): each role's text step (level 800) is
  held at 4.5:1 by the build: the accent's on every gray's page and under its own level
  50, the gray's on its own page. A step that falls short moves toward black (white, in
  dark mode) only as far as that needs, so amber's accent text goes from `#ab6400` to
  `#aa6400`, and palettes that passed keep Radix's step 11 (`theme-palette.js`,
  `theme-color.js`). The contrast test measures what the build emits, for every palette
  and eight hex accents, light and dark.
- **C5**, 1.4.3 (2.x Phase 3, November 14, 2026): a primary button's hover fill is
  `--color-accent-hover`, its rest fill moved a fifth of the way on, away from its label
  (darker on light, lighter on dark), so the label's ratio only rises. It is mixed from
  `--color-accent-default`, so a site's own accent reaches it; the Northwestern template
  keeps Purple 90 (8.55:1 under white).
- **C24**, 1.4.3 (2.x Phase 3, November 14, 2026): the map popups' links were accent step 9
  as text, under 4.5:1 for 26 palettes in light and 12 in dark (the default indigo in
  dark). They take `--color-accent-default` (`_map.scss`). Found reading the code.
- **C25**, 1.4.3 and 2.4.7 (2.x Phase 3, November 14, 2026): the search filters' primary
  button put gray 50 on accent step 9, under 4.5:1 for 26 palettes in light and 12 in
  dark, and its secondary and primary buttons took their outline away on focus. Both draw
  as `.canopy-button--primary` does now, with a focus ring (`search/_filters.scss`).
  Found reading the code.
- **C26**, 1.4.11 (2.x Phase 3, November 14, 2026): the search form's focused edge and
  icon, the filters' quick-find field's focused edge (its outline taken away) and the
  facet checkboxes' checked state were accent step 8, under 3:1 for all 31 palettes in
  light (indigo 2.36:1) and 6 in dark. They take `--color-accent-default`, and the field
  draws an outline inside its edge (`search/_form.scss`, `search/_filters.scss`). Found
  reading the code.
- **C27**, 2.4.7 (2.x Phase 3, November 14, 2026): the search form's submit button showed
  no focus: its outline was taken away and its focused fill was its rest fill. It takes
  `--color-accent-hover` and a ring inside it in its label's color (`search/_form.scss`).
  Found reading the code.
- **C28**, 2.4.3 (2.x Phase 3, November 14, 2026): below the header's desktop breakpoint,
  opening the search dialog (`aria-modal`) left focus on its button, behind it: the
  script focused the header's inline field, which that layout hides. Neither the search
  nor the navigation dialog gave focus back on closing, and Tab left both. The header's
  script now focuses the dialog's own field, keeps Tab inside an open dialog, and returns
  focus to the button that opened it (`CanopyHeader.jsx`). Found by hand at 1024px;
  `tests/a11y/specs/dialogs.spec.mjs` checks both dialogs by keyboard at 800px.
- **C29**, 2.4.7 (2.x Phase 3, November 14, 2026): a map took focus (Leaflet's container)
  and showed none: its panes paint over a ring drawn on or inside it, and `.canopy-map`
  clips one drawn outside. Its frame draws the ring while the map has focus, in every
  template (`_map.scss`), as C19 did for the Northwestern template alone. Found by the
  keyboard walk on the docs site's `/docs/components/map.html`.

- **C6, C7, C8, C9 and C18**, Clover 3 (2.x Phase 2, November 13, 2026): Canopy draws
  with Clover 4. Metadata and RequiredStatement are a `dl` of `dt` and `dd` with no
  `role="group"` between them (1.3.1); the slider's "View all" is named by its words
  (2.5.3); the deep-zoom viewport is named, `Image`'s by its `alt` (1.1.1, 4.1.2); Scroll's
  search field and figure text went with Clover 3's Scroll (2.4.7, 1.4.3). The fixture's
  run on Clover 4 finds none of them.
- **C16**, 4.1.2, Clover 3 (2.x Phase 2, November 14, 2026): a Viewer given a Collection
  draws Clover 4's Collection line, its label and a pager whose buttons are named, in
  place of Clover 3's unnamed collection menu button. The docs site's
  `/docs/components/viewer.html`, given the lithographs Collection, has no findings
  (`CANOPY_A11Y_SITE=site`, Clover 4.10.2).
- **R1** (2.x Phase 2, November 13, 2026): the global reset of `border-radius` and
  `box-shadow` is gone from `settings/_effects.scss`, so Clover 4's focus ring on every
  Viewer and Image (2.4.7) and the outlines around its hotspots (1.4.11) draw. Square
  corners stay as tokens.
- **C23**, 2.4.7 (November 13, 2026): `ImageStory`'s text panel, which scrolls and so takes
  focus, shows a focus ring, drawn inside as the viewer's frame clips
  (`components/_image-story.scss`). Found by the keyboard walk on the docs site's
  `/docs/components/image-story.html`.
- **C22**, 3.1.2 (2.x Phase 2, November 13, 2026): metadata values Canopy draws itself, the
  facet links among them, are marked with their language, as Clover marks the values it
  draws, so a Spanish page reads an English subject as English (`ManifestPrimitives.jsx`).

- **C2**, 2.5.8 (November 13, 2026): the hero carousel's dots are 24px buttons, the dot
  drawn at its old size by `::before` (`_interstitial-hero.scss`).
- **C11**, 1.4.1 (November 13, 2026): links in running text are underlined. The rule in
  `base/_common.scss` covers links with no class of their own inside paragraphs, list
  items, table cells, quotations and captions, outside `nav`, so components keep their
  own link treatment.
- **C12**, 2.1.1 (November 13, 2026): code blocks take focus, so a keyboard can scroll
  them, and are named by their file or language. Their frame clips, so the focus ring
  is drawn inside (`docs/CodeBlock.jsx`, which draws every fenced block on every site,
  and `base/_markdown.scss`).
- **C13**, 1.4.10 (November 13, 2026): prose, metadata values and inline code wrap text
  that has nowhere to break, such as a manifest's URL in `Id` (`base/_common.scss`).
- **C14**, 4.1.2 (November 13, 2026): map markers are named by their point's title, or
  by its coordinates where it has none (`content/map/Map.jsx`).
- **C15**, 4.1.2 (November 13, 2026): each checkbox in a Markdown task list is named by
  its item's words (`lib/build/rehype-task-list-labels.js`).
- **C17**, 1.4.3 (2.x Phase 3, November 14, 2026): the docs' Theme page taught a custom
  crimson button at `#df3478`, 4.21:1 under its white label, in its "Complex selectors"
  example and on the page. The example is `#cb1d63` now (5.3:1), with a hover of
  `#ab1251` (7:1), and says to keep 4.5:1 on each fill (`content/docs/theme/index.mdx`).
  It had been filed as C5's, but it is the docs' own CSS, not the primary button: fixing
  C5 left it failing, which the docs site's check found.
- **C19**, 2.4.7 and 2.4.11 (November 13, 2026): the Northwestern focus ring is drawn
  inside elements where a container clips it (the hero's slides, the viewers, Scroll),
  and on the map's frame, whose panes paint over anything inside it. The header's
  hidden Search button shows itself while it has focus (`northwestern.css`).
- **C20**, 2.4.7 (November 13, 2026): the Northwestern footer's wordmark link is named
  by its image's `alt`, so it shows that name, rather than collapsing to nothing, when
  the image does not load (`template-northwestern/_app.mdx`).

## Risks for 2.x

Not failures today, but each becomes one, or blocks a fix, as 2.x lands.

- **R2.** The placeholders `Viewer`, `Slider`, `Image` and `Scroll` render have no name
  and no loading message before their runtimes mount (`DESIGN.md` §0, "Accessible before
  any script runs").
- **R6.** Every code block is now a tab stop, including the many that do not scroll.
  Taking the stop away from blocks that fit needs a script that measures them.

## Not yet checked

- A screen reader (VoiceOver, NVDA) and a person's keyboard walk through each template.
- Text spacing (1.4.12), and zoom to 200% and 400%. Forced colors are checked for focus
  on the default and Northwestern templates (`forced-colors.spec.mjs`), not yet for
  every control's edge.
- The i18n and Northwestern templates in dark; both ship light.
- That Spanish pages announce only Spanish, beyond the carousel's and search's words
  (`carousel.spec.mjs`, `search.spec.mjs`): the checks do not compare what is announced
  with the page's `lang`.
- The docs site again since the fixes: rebuild it (`npm run build`) and rerun the report
  to retire what it found. Rechecked with no findings: on November 14, 2026, the Canopy
  page and the Map, Image, Image Story and Scroll components; on November 15, in the 2.x
  look, the home, Docs, Theme, Markdown, Search and About pages and the Viewer, Slider,
  Search, Card and components index pages; on November 16, with search rebuilt, the
  home, Search, About, Docs, Theme and Style guide pages, the search docs, and the Search,
  Map, Timeline, Gallery, Image Story, Viewer, Slider and Card component pages.

## Keeping this file current

- `npm run test:a11y` builds the fixture sites and fails on any finding that is not in
  `tests/a11y/known-failures.mjs`, and on a known failure that no longer occurs.
  `npm run test:a11y:summary` prints the last run as a table.
- `CANOPY_A11Y_SITE=<dir> CANOPY_A11Y_REPORT=1 npm run test:a11y` reports on any site you
  built, such as the docs (`npm run build`).
- A newly found failure gets the next free id, a row here and an entry in the tests,
  with a plan. A fix removes its entry in the tests and moves its row to Fixed.
