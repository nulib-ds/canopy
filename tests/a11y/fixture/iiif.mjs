// The fixture's IIIF: three Manifests (two in Presentation 3, one in Presentation 2)
// with generated images, all served from the fixture site itself at `base`.

const sepia = (x, y, w, h) => [180 + Math.round((x / w) * 50), 150 + Math.round((y / h) * 40), 110];
const blue = (x, y, w, h) => [40 + Math.round((y / h) * 60), 90 + Math.round((x / w) * 60), 160];
const green = (x, y, w, h) => [70, 120 + Math.round((y / h) * 70), 80 + Math.round((x / w) * 40)];
const stripes = (x, y, w) => (Math.floor(x / (w / 8)) % 2 ? [200, 196, 180] : [120, 104, 86]);

function image(name, width, height, paint) {
  return {
    path: `iiif/images/${name}.png`,
    width,
    height,
    paint: (x, y) => paint(x, y, width, height),
  };
}

function canvas(base, manifest, index, img, label, extra = {}) {
  const id = `${base}/iiif/${manifest}/canvas/${index}`;
  return {
    id,
    type: 'Canvas',
    label: { en: [label] },
    width: img.width,
    height: img.height,
    items: [
      {
        id: `${id}/page`,
        type: 'AnnotationPage',
        items: [
          {
            id: `${id}/page/painting`,
            type: 'Annotation',
            motivation: 'painting',
            target: id,
            body: {
              id: `${base}/${img.path}`,
              type: 'Image',
              format: 'image/png',
              width: img.width,
              height: img.height,
            },
          },
        ],
      },
    ],
    ...extra,
  };
}

export function fixtureIiif(base) {
  const images = [
    image('m1-cover', 900, 675, sepia),
    image('m1-page', 900, 675, stripes),
    image('m2-map', 1000, 640, blue),
    image('m3-sketch', 640, 800, green),
  ];
  const [cover, inner, map, sketch] = images;
  const P3 = 'http://iiif.io/api/presentation/3/context.json';

  const m1Cover = `${base}/iiif/m1/canvas/1`;
  const m1 = {
    '@context': P3,
    id: `${base}/iiif/m1.json`,
    type: 'Manifest',
    label: { en: ['A bicycle catalog'] },
    summary: { en: ['A catalog of four bicycle models, with color plates.'] },
    metadata: [
      { label: { en: ['Subject'] }, value: { en: ['Bicycles', 'Advertising'] } },
      { label: { en: ['Date'] }, value: { none: ['1896'] } },
    ],
    requiredStatement: {
      label: { en: ['Attribution'] },
      value: { en: ['Generated for the Canopy accessibility fixture.'] },
    },
    thumbnail: [
      {
        id: `${base}/${cover.path}`,
        type: 'Image',
        format: 'image/png',
        width: cover.width,
        height: cover.height,
      },
    ],
    items: [
      canvas(base, 'm1', 1, cover, 'Front cover', {
        annotations: [
          {
            id: `${m1Cover}/notes`,
            type: 'AnnotationPage',
            items: [
              {
                id: `${m1Cover}/notes/1`,
                type: 'Annotation',
                motivation: 'commenting',
                target: m1Cover,
                body: {
                  type: 'TextualBody',
                  value: 'The cover shows a rider on a country road.',
                  format: 'text/plain',
                  language: 'en',
                },
              },
            ],
          },
        ],
      }),
      canvas(base, 'm1', 2, inner, 'Page 1'),
    ],
  };

  // A long identifier with no place to break, as many providers' are: the work page
  // shows it in full.
  const m2 = {
    '@context': P3,
    id: `${base}/iiif/m2.json?as=iiif&key=0f9a7032717f4446a0c3193404a4c09061927e08db0947`,
    type: 'Manifest',
    label: { en: ['A map of the coast'] },
    summary: { en: ['A survey of the coastline and its harbors.'] },
    metadata: [
      { label: { en: ['Subject'] }, value: { en: ['Maps', 'Bicycles'] } },
      { label: { en: ['Date'] }, value: { none: ['1717'] } },
    ],
    thumbnail: [
      {
        id: `${base}/${map.path}`,
        type: 'Image',
        format: 'image/png',
        width: map.width,
        height: map.height,
      },
    ],
    items: [canvas(base, 'm2', 1, map, 'The coast')],
  };

  const m3Canvas = `${base}/iiif/m3-p2/canvas/1`;
  const m3 = {
    '@context': 'http://iiif.io/api/presentation/2/context.json',
    '@id': `${base}/iiif/m3-p2.json`,
    '@type': 'sc:Manifest',
    label: 'A sketchbook',
    description: 'Field sketches, described in Presentation 2.1 terms.',
    metadata: [
      { label: 'Subject', value: 'Sketches' },
      { label: 'Date', value: '1850' },
    ],
    attribution: 'Generated for the Canopy accessibility fixture.',
    thumbnail: { '@id': `${base}/${sketch.path}`, width: sketch.width, height: sketch.height },
    sequences: [
      {
        '@type': 'sc:Sequence',
        canvases: [
          {
            '@id': m3Canvas,
            '@type': 'sc:Canvas',
            label: 'Sketch',
            width: sketch.width,
            height: sketch.height,
            images: [
              {
                '@type': 'oa:Annotation',
                motivation: 'sc:painting',
                on: m3Canvas,
                resource: {
                  '@id': `${base}/${sketch.path}`,
                  '@type': 'dctypes:Image',
                  format: 'image/png',
                  width: sketch.width,
                  height: sketch.height,
                },
              },
            ],
          },
        ],
      },
    ],
  };

  return {
    files: { 'iiif/m1.json': m1, 'iiif/m2.json': m2, 'iiif/m3-p2.json': m3 },
    images,
    manifests: ['assets/iiif/m1.json', 'assets/iiif/m2.json', 'assets/iiif/m3-p2.json'],
    featured: [m1.id, m2.id],
  };
}
