// Known failures on the fixture sites, each with its id in ACCESSIBILITY.md. This
// list only shrinks: `npm run test:a11y` fails on a finding not listed here, and on
// an entry that no longer matches anything (fixed: remove it here and move its row in
// ACCESSIBILITY.md to Fixed). Keep each entry as narrow as its failure, so a new
// failure elsewhere is never mistaken for a known one.
//
// An entry matches a finding by `rule` (an axe rule id, or the keyboard-, reflow- and
// motion- checks' own), narrowed by `pages` (a RegExp of URL paths), `projects`
// (`template-light`, `template-dark`, `template-auto`, `i18n-light`,
// `northwestern-light`) and
// `targets` (substrings a failing element's selector or markup contains).

// Empty since 2.x Phase 4: C1, the last, was the hero carousel's missing pause control.
export const KNOWN = [];
