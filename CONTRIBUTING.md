# Contributing Guide

Thank you for contributing to Canopy. This repository is a monorepo with a private root app and a single publishable workspace package that contains both the library and the UI.

## Repository Layout
- `@canopy-iiif/app-root` (root): private app (the docs site), workspace orchestrator, dev entry (`npm run dev`).
- `packages/app` → `@nulib/canopy`: publishable package exposing the library (`lib/`), the UI (`ui/`) and the `canopy` command (`bin/`).
- `packages/app-alias` → `@canopy-iiif/app`: Canopy's 1.x name, published beside it at the same version; each entry passes through to `@nulib/canopy`.
- `content/`: MDX pages and per-folder layouts (e.g., `content/_layout.mdx`, `content/works/_layout.mdx`).
- `.cache/iiif/`: cached IIIF collection and manifests.

## Local Development
- Install: `npm install`
- Build once: `npm run build`
- Dev server (watch + live reload): `npm run dev` (serves `site/` at `http://localhost:5001`)

Entrypoint
- Both commands run the package's `canopy` command (`canopy dev`, `canopy build`; `packages/app/lib/cli.js`).
- In dev, it starts the UI watcher (`@nulib/canopy` → `ui:watch`) and the library dev server.
- In build, it builds UI assets once and then builds the site with the library.

## Interactive Components: SSR-Safe Pattern

Browser-only UI (e.g., components that touch `document` or depend on non-SSR libraries) must be SSR-safe:

1) UI component (in `packages/app/ui`):
   - Dynamically import the browser-only dependency inside `useEffect`.
   - On the server, render a placeholder `<div data-canopy-*>` containing a JSON `<script type="application/json">` with props.

   Example:

   ```jsx
   import React, { useEffect, useState } from 'react';
   export function Viewer(props) {
     const [Impl, setImpl] = useState(null);
     useEffect(() => {
       if (typeof window === 'undefined') return;
       import('@nulib/clover/viewer').then((m) => setImpl(() => m.default || m));
     }, []);
     if (!Impl) return (
       <div data-canopy-viewer>
         <script type="application/json" dangerouslySetInnerHTML={{ __html: JSON.stringify(props||{}) }} />
       </div>
     );
     return <Impl {...props} />;
   }
   ```

2) Hydration runtime (in `packages/app/lib`):
   - Bundle a small browser script with esbuild that finds placeholders and mounts the component.
   - Use React globals injected by `site/scripts/react-globals.js` (do not bundle React into the runtime).
   - Mark heavy libs not needed by that runtime as `external` to keep bundles slim (e.g., `@nulib/clover` and `@nulib/clover/*` for search).

Existing examples:
 - Viewer: placeholder from `packages/app/ui/src/iiif/Viewer.jsx` (exported as `@nulib/canopy/ui`'s `Viewer`), hydration in `packages/app/lib/build/mdx.js` → `site/scripts/canopy-viewer.js`.
 - Search: MDX placeholders (`SearchTabs`, `SearchSummary`, `SearchResults`) from `packages/app/ui/src/search/`, runtime in `packages/app/lib/search/search-app.jsx` (shared client store) → `site/scripts/search.js`.

Tips:
 - Add a detection to inject React globals when a page contains your placeholder.
 - Hard refresh during dev after changing bundles to avoid stale caches.

## Versioning

- Semver: patch = fixes/internal, minor = features, major = breaking.
- Command: `npm run version:packages` with a bump flag:
  - Minor: `npm run version:packages -- --minor`
  - Patch: `npm run version:packages`
  - Major: `npm run version:packages -- --major`
- Scope: `@nulib/canopy` and `@canopy-iiif/app` version together, as one fixed group (`.changeset/config.json`); the root app stays private and auto‑syncs its version.
- The helper prompts for a short summary + bullet highlights and writes them to `content/docs/releases/releases.json` (and regenerates `releases.data.mjs`) so the releases log stays current. Press enter on an empty line to skip the prompt.
- Don’t hand-edit versions or release logs; the helper script records them for you.
- Prereleases, when one is wanted: `npm run changeset -- pre enter next` puts Changesets in pre mode (`.changeset/pre.json`), so a bump gives `x.y.z-next.N`, published on npm's `next` tag and marked as a prerelease on GitHub; the template jobs skip it. `npm run changeset -- pre exit`, then a bump, for the release itself. 2.x went straight to a release.

## Release Flow

- Open a PR with changes and get approval.
- Run the version bump command and commit:
  - Commit updated `package.json` files plus the generated `content/docs/releases/releases.json` + `releases.data.mjs` files (and any edits to `content/docs/releases/index.mdx` if present).
- Merge to `main`. The Release workflow:
  - Publishes `@nulib/canopy` and `@canopy-iiif/app` to npm (`guard-publish.js` checks they share a version).
  - Keeps the root app private (guarded by a pre‑publish check).
  - If a publish happened, prepares and pushes a cleaned template repository.

## Publishing to npm

The release workflow publishes with npm's trusted publishing: npm accepts the workflow's GitHub identity in place of a token, and attaches provenance to each version. No npm token is stored in this repository's secrets.

- Each package names the workflow on npmjs.com, in its settings under **Trusted Publisher**: GitHub Actions, organization `nulib-ds`, repository `canopy`, workflow `release-and-template.yml`, no environment. Under **Allowed actions**, tick **Allow npm publish**: the workflow publishes directly (`changeset publish` runs `npm publish`), and without it a trusted publisher may only `npm stage publish`. Leave **Allow npm dist-tag** unticked, then **Set up connection**. Both packages need it: `@nulib/canopy` and `@canopy-iiif/app`. The fields are case-sensitive, and npm checks them only when a publish uses them.
- A new trusted publisher expires unless a publish uses it within 2 days, so add one just before a release.
- Once a trusted publish has worked, set each package's **Publishing access** to "Require two-factor authentication and disallow tokens", and revoke any npm automation token.

### A new package's first release

npm adds a trusted publisher only to a package that already exists, so a package's first version needs it created first, as `@nulib/canopy` was on 2026-11-17, before 2.0.1:

1. From your own machine, logged in to npm with 2FA, publish a placeholder to create the package:

   ```bash
   mkdir -p /tmp/nulib-canopy-placeholder && cd /tmp/nulib-canopy-placeholder
   cat > package.json <<'JSON'
   {
     "name": "@nulib/canopy",
     "version": "0.0.0",
     "description": "A placeholder: Canopy is published here from 2.0.",
     "license": "MIT",
     "repository": {"type": "git", "url": "git+https://github.com/nulib-ds/canopy.git"}
   }
   JSON
   printf '# @nulib/canopy\n\nA placeholder, published to create the package. Canopy is published here from 2.0: https://nulib-ds.github.io/canopy/\n' > README.md
   npm publish --access public
   ```

2. Add the trusted publisher to `@nulib/canopy` and to `@canopy-iiif/app`, with **Allow npm publish** ticked. Leave **Publishing access** as it is until the first release is out: the token is the fallback until then.
3. Within 2 days, run `npm run version:packages`, commit and push. The workflow publishes both packages, which uses both trusted publishers for the first time.
4. Then deprecate the placeholder (`npm deprecate @nulib/canopy@0.0.0 "A placeholder; Canopy is published here from 2.0.1."`), set both packages to disallow tokens, and delete the `NPM_TOKEN` secret.

Don't publish the release itself from your machine: the workflow would then find nothing to publish, and skip the GitHub release and the template pushes.

## Template Workflow
This repo is the source for a separate template repository:
- Pushing to `main` triggers `.github/workflows/release-and-template.yml`.
- After a successful publish, the workflow prepares a clean template (excludes dev‑only paths) and force‑pushes it to `nulib-ds/canopy-template`.
- In the template, the one Canopy dependency is the just-published `@nulib/canopy`, beside React and React DOM, and `build`/`dev` run `canopy build` and `canopy dev`.

## Commits
- A commit is authored by the person who makes it, and credits no AI tool: no `Co-Authored-By` trailer or "Generated with" line for one. The commit-msg hook and the Tests workflow refuse such a commit (`packages/helpers/check-commit-authors.js`), so it is never released.
- Its message is one short sentence in the imperative, ending with a period, that fits on one line in GitHub's commit list (about 50 characters, never past 72): `Release Canopy 2.0.0 as @nulib/canopy.`

## Pull Requests
- Keep PRs focused and small. Include rationale and test plan.
- Ensure `npm run build` passes locally.
- If changing the library API or behavior, include a changeset (`npm run changeset`).

Thanks for helping improve Canopy!
