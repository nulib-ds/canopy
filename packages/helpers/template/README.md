# Canopy Template

A project of [Northwestern University Libraries](https://www.library.northwestern.edu/).

This repository offers a trimmed down starting point for new Canopy IIIF projects. When you need deeper documentation, examples, or release notes, vist the main project at https://nulib-ds.github.io/canopy/.

## Getting Started

Walk through the [Quick Start guide](https://nulib-ds.github.io/canopy/docs/user-guides/canopy-get-started.html) to stand up your new digital project, configure `canopy.yml` using IIIF collections and manifests, and add pages and layouts under `content/`.

## Preview from the monorepo

Working inside `nulib-ds/canopy`? Run `npm run preview:template` to stage this starter into `.template-preview/`, install its dependencies, and launch `npm run dev`. Stop the script with `Ctrl+C` when you are done.

## Updates

Keep your project current by running `npm install @canopy-iiif/app@latest @samvera/clover-iiif@latest` whenever a new release ships, or trigger the _Update Canopy App_ GitHub action (Actions tab → _Update Canopy App_ → _Run workflow_) and let it open a pull request that bumps both dependencies for you. Read the [Developer documentation](https://nulib-ds.github.io/canopy/docs/developers) for more information.

## Contributing

All development happens in https://github.com/nulib-ds/canopy. If you are interested in shaping Canopy IIIF, please open an issue, share feedback, or send a pull request.

## License

Canopy IIIF (Canopy) is an open-source project of [Northwestern University Libraries](https://www.library.northwestern.edu/), created by Mat Jordan and Mark Baggett, released under the MIT License. By working directly with IIIF resources, Canopy keeps materials with the libraries, museums, and archives that serve them, along with their metadata, rights statements, and terms of use. Implementers should be aware of the rights and terms governing the materials they reference, publish, and deploy to the web using Canopy.
