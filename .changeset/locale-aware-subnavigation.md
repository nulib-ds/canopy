---
"@canopy-iiif/app": patch
---

Fix `SubNavigation` rooting for locale-prefixed routes. The sidebar previously
rooted at the first path segment, which is the locale for prefixed content
(e.g. `content/fr/...`), causing it to list every section under that locale
instead of just the current one. Section roots are now computed locale-aware
(`<locale>/<section>`), so locale-prefixed pages mirror the default-locale
behavior.
