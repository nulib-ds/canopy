// The IIIF build upgrades Presentation 2 sources to Presentation 3 with
// `@iiif/parser/upgrader`. The build swallows a failure to load it (the source then
// passes through un-upgraded), so these tests are where that failure gets loud.

const path = require('node:path');
const { __TESTING__ } = require('../../../packages/app/lib/build/iiif');

const { ensurePresentation3Manifest } = __TESTING__;
const buildDir = path.resolve(__dirname, '../../../packages/app/lib/build');

const P2_MANIFEST = {
  '@context': 'http://iiif.io/api/presentation/2/context.json',
  '@id': 'https://example.org/iiif/p2/manifest.json',
  '@type': 'sc:Manifest',
  label: 'A Presentation 2 manifest',
  description: 'Described in 2.1 terms.',
  metadata: [{ label: 'Date', value: '1896' }],
  attribution: 'Courtesy of the library',
  sequences: [
    {
      '@type': 'sc:Sequence',
      canvases: [
        {
          '@id': 'https://example.org/iiif/p2/canvas/1',
          '@type': 'sc:Canvas',
          label: 'Front',
          width: 1000,
          height: 800,
          images: [
            {
              '@type': 'oa:Annotation',
              motivation: 'sc:painting',
              on: 'https://example.org/iiif/p2/canvas/1',
              resource: {
                '@id': 'https://example.org/images/1.jpg',
                '@type': 'dctypes:Image',
                format: 'image/jpeg',
                width: 1000,
                height: 800,
              },
            },
          ],
        },
      ],
    },
  ],
};

test('the upgrader resolves from the IIIF build', () => {
  // Fails if `@iiif/parser`, a dependency of @nulib/canopy, stops being installed.
  expect(() => require.resolve('@iiif/parser/upgrader', { paths: [buildDir] })).not.toThrow();
});

test('a Presentation 2 manifest is upgraded to Presentation 3', async () => {
  const { manifest, changed } = await ensurePresentation3Manifest(P2_MANIFEST);
  expect(changed).toBe(true);
  expect(manifest['@context']).toBe('http://iiif.io/api/presentation/3/context.json');
  expect(manifest).toMatchObject({
    id: 'https://example.org/iiif/p2/manifest.json',
    type: 'Manifest',
    label: { none: ['A Presentation 2 manifest'] },
    summary: { none: ['Described in 2.1 terms.'] },
    metadata: [{ label: { none: ['Date'] }, value: { none: ['1896'] } }],
    requiredStatement: {
      label: { none: ['Attribution'] },
      value: { none: ['Courtesy of the library'] },
    },
  });
  const canvas = manifest.items[0];
  expect(canvas).toMatchObject({
    id: 'https://example.org/iiif/p2/canvas/1',
    type: 'Canvas',
    label: { none: ['Front'] },
  });
  expect(canvas.items[0].items[0].body).toMatchObject({
    id: 'https://example.org/images/1.jpg',
    type: 'Image',
    format: 'image/jpeg',
    width: 1000,
    height: 800,
  });
});

test('a Presentation 3 manifest passes through unchanged', async () => {
  const p3 = {
    '@context': 'http://iiif.io/api/presentation/3/context.json',
    id: 'https://example.org/iiif/p3/manifest.json',
    type: 'Manifest',
    label: { en: ['A Presentation 3 manifest'] },
    items: [],
  };
  const { manifest, changed } = await ensurePresentation3Manifest(p3);
  expect(changed).toBe(false);
  expect(manifest).toMatchObject({ id: p3.id, label: { en: ['A Presentation 3 manifest'] } });
});
