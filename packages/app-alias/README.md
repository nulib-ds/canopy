# @canopy-iiif/app

Canopy is published as [`@nulib/canopy`](https://www.npmjs.com/package/@nulib/canopy) since 2.0. This package is Canopy's 1.x name, kept so that a site made before 2.0 upgrades without editing its files: its `package.json`, its stylesheet's `@import`, its `app/scripts/canopy-build.mts` and its MDX imports name `@canopy-iiif/app`, and each of those entries passes through to `@nulib/canopy` at the same version.

To move a site to the new name, follow [Upgrading to 2.0](https://nulib-ds.github.io/canopy/docs/developers/upgrading.html). A site that stays on this name keeps working; its build says once that the new name exists.

## For maintainers

- Every entry in `@nulib/canopy`'s `exports` has its counterpart here, a file that re-exports it (`tests/unit/packaging/alias.test.js` holds them together).
- The two packages are released together, at one version (`.changeset/config.json`, `fixed`); this one depends on `@nulib/canopy` at exactly that version.
