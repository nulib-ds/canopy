# Contributing Guide

Thank you for contributing to Canopy. This repository is a monorepo with a private root app and a single publishable workspace package that contains both the library and the UI.

## Repository Layout
- `@canopy-iiif/app` (root): private app, workspace orchestrator, dev entry (`npm run dev`).
- `packages/app` → `@canopy-iiif/app`: publishable package exposing the library (`lib/`) and the UI (`ui/`).
- `content/`: MDX pages and per-folder layouts (e.g., `content/_layout.mdx`, `content/works/_layout.mdx`).
- `.cache/iiif/`: cached IIIF collection and manifests.

## Local Development
- Install: `npm install`
- Build once: `npm run build`
- Dev server (watch + live reload): `npm run dev` (serves `site/` at `http://localhost:5001`)

Entrypoint
- Both commands call `node app/scripts/canopy-build.mjs`.
- In dev, it starts the UI watcher (`@canopy-iiif/app` → `ui:watch`) and the library dev server.
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
       import('@samvera/clover-iiif/viewer').then((m) => setImpl(() => m.default || m));
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
   - Mark heavy libs not needed by that runtime as `external` to keep bundles slim (e.g., `@samvera/clover-iiif/*` for search).

Existing examples:
 - Viewer: placeholder from `@canopy-iiif/app/ui/iiif/Viewer`, hydration in `packages/app/lib/mdx.js` → `site/canopy-viewer.js`.
 - Search: MDX placeholders (`SearchTabs`, `SearchSummary`, `SearchResults`) from `@canopy-iiif/app/ui/search/*`, runtime in `packages/app/lib/search.js` (shared client store) → `site/search.js`.

Tips:
 - Add a detection to inject React globals when a page contains your placeholder.
 - Hard refresh during dev after changing bundles to avoid stale caches.

## Versioning

- Semver: patch = fixes/internal, minor = features, major = breaking.
- Command: `npm run version:packages` with a bump flag:
  - Minor: `npm run version:packages -- --minor`
  - Patch: `npm run version:packages`
  - Major: `npm run version:packages -- --major`
- Scope: `@canopy-iiif/app` versions independently; the root app stays private and auto‑syncs its version.
- The helper prompts for a short summary + bullet highlights and writes them to `content/docs/releases/releases.json` (and regenerates `releases.data.mjs`) so the releases log stays current. Press enter on an empty line to skip the prompt.
- Don’t hand-edit versions or release logs; the helper script records them for you.

## Release Flow

- Open a PR with changes and get approval.
- Run the version bump command and commit:
  - Commit updated `package.json` files plus the generated `content/docs/releases/releases.json` + `releases.data.mjs` files (and any edits to `content/docs/releases/index.mdx` if present).
- Merge to `main`. The Release workflow:
  - Publishes `@canopy-iiif/app` to npm.
  - Keeps the root app private (guarded by a pre‑publish check).
  - If a publish happened, prepares and pushes a cleaned template repository.

## Template Workflow
This repo is the source for a separate template repository:
- Pushing to `main` triggers `.github/workflows/release-and-template.yml`.
- After a successful publish, the workflow prepares a clean template (excludes dev‑only paths) and force‑pushes it to `nulib-ds/canopy-template`.
- In the template, dependencies on `@canopy-iiif/*` are set to the latest published versions and `build`/`dev` run `node app/scripts/canopy-build.mjs`.

## Pull Requests
- Keep PRs focused and small. Include rationale and test plan.
- Ensure `npm run build` passes locally.
- If changing the library API or behavior, include a changeset (`npm run changeset`).

Thanks for helping improve Canopy!
