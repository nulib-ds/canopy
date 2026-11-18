// Characterizes what Canopy's Clover wrappers render on the server: the hydration
// placeholders for Viewer, Slider, Image and Scroll, and the markup of the manifest
// primitives, Clover 4's (`@nulib/clover/primitives`). The props authors write and the
// server-rendered markup must not drift without a decision.

const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repoRoot = path.resolve(__dirname, '../../..');

const MANIFEST = {
  id: 'https://example.org/iiif/m1.json',
  type: 'Manifest',
  label: { en: ['A bicycle catalog'] },
  summary: { en: ['Color plates of four models.'] },
  metadata: [
    { label: { en: ['Subject'] }, value: { en: ['Bicycles', 'Advertising'] } },
    { label: { en: ['Date'] }, value: { none: ['1896'] } },
    { label: { en: [''] }, value: { en: ['A pair with no label is dropped'] } },
  ],
  requiredStatement: {
    label: { en: ['Attribution'] },
    value: { en: ['Courtesy of the library'] },
  },
  __canopyMetadataFacets: [{ label: 'Subject', normalized: 'subject', slug: 'subject' }],
};

// Renders each case with the SSR bundle in a child process (the UI bundle is ESM)
// and returns the markup by case name.
function render() {
  const script = `
    const React = await import('react');
    const { renderToStaticMarkup } = await import('react-dom/server');
    const ui = await import('@nulib/canopy/ui/server');
    const h = React.createElement;
    const manifest = ${JSON.stringify(MANIFEST)};
    const Custom = ({ value }) => h('em', null, 'Dated ' + value);
    const cases = {
      viewer: h(ui.Viewer, { iiifContent: manifest.id }),
      viewerOptions: h(ui.Viewer, {
        iiifContent: manifest.id,
        options: { showTitle: true, informationPanel: { open: true, renderAbout: true } },
      }),
      viewerCrossOrigin: h(ui.Viewer, { iiifContent: manifest.id, options: { crossOrigin: undefined } }),
      slider: h(ui.Slider, { iiifContent: '/api/facet/subject/bicycles.json', className: 'extra' }),
      sliderBreakpoints: h(ui.Slider, {
        iiifContent: '/api/facet/subject/bicycles.json',
        options: { breakpoints: { 320: { slidesPerView: 1.5 }, 640: { slidesPerView: 2 } } },
      }),
      image: h(ui.Image, {
        src: 'https://example.org/a.jpg',
        alt: 'A map',
        caption: 'A caption',
        height: '420px',
      }),
      imageDefaults: h(ui.Image, { src: 'https://example.org/a.jpg', isTiledImage: true }),
      scroll: h(ui.Scroll, { iiifContent: manifest.id }),
      label: h(ui.Label, { manifest, as: 'h1' }),
      summary: h(ui.Summary, { manifest, as: 'p', className: 'canopy-lead' }),
      metadata: h(ui.Metadata, { manifest }),
      metadataCustom: h(ui.Metadata, {
        manifest,
        customValueContent: [{ matchingLabel: { en: ['Date'] }, Content: h(Custom) }],
      }),
      requiredStatement: h(ui.RequiredStatement, { manifest }),
      empty: h(React.Fragment, null,
        h(ui.Label, { manifest: {} }),
        h(ui.Summary, { manifest: {} }),
        h(ui.Metadata, { manifest: {} }),
        h(ui.RequiredStatement, { manifest: {} }),
      ),
    };
    const out = {};
    for (const [name, element] of Object.entries(cases)) out[name] = renderToStaticMarkup(element);
    process.stdout.write(JSON.stringify(out));
  `;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  if (result.status !== 0) throw new Error(result.stderr);
  return JSON.parse(result.stdout);
}

// The JSON a placeholder hands its runtime.
function placeholderProps(html) {
  const match = /<script type="application\/json">([\s\S]*?)<\/script>/.exec(html);
  if (!match) throw new Error(`No placeholder props in ${html}`);
  return JSON.parse(match[1]);
}

const CANOPY_VIEWER_DEFAULTS = {
  showDownload: false,
  showIIIFBadge: false,
  showTitle: false,
  informationPanel: { open: false, renderAbout: false, renderToggle: false },
};

const rem = (value) => ({ __canopySliderUnit: 'rem', value });

let html;
beforeAll(() => {
  html = render();
});

describe('hydration placeholders', () => {
  test('Viewer hands Clover its props with Canopy defaults merged in', () => {
    // `clover-viewer`, Clover 3's root, for a site's 1.x styles (`version-parity.css`).
    expect(html.viewer).toMatch(
      // The toggle a work page adds beside it takes its name from here (`viewer-runtime-entry.js`).
      /^<div data-canopy-viewer="1" data-canopy-viewer-widen="Widen the viewer" class="not-prose clover-viewer"><script/,
    );
    expect(placeholderProps(html.viewer)).toEqual({
      iiifContent: MANIFEST.id,
      options: CANOPY_VIEWER_DEFAULTS,
    });
  });

  test('Viewer deep-merges an author’s options over the defaults', () => {
    expect(placeholderProps(html.viewerOptions).options).toEqual({
      ...CANOPY_VIEWER_DEFAULTS,
      showTitle: true,
      informationPanel: { open: true, renderAbout: true, renderToggle: false },
    });
  });

  test('Viewer turns an explicitly undefined crossOrigin into null', () => {
    expect(placeholderProps(html.viewerCrossOrigin).options.crossOrigin).toBeNull();
  });

  test('Slider carries its class and the default breakpoints in rem', () => {
    expect(html.slider).toMatch(/^<div class="canopy-slider extra" data-canopy-slider="1">/);
    expect(placeholderProps(html.slider)).toEqual({
      iiifContent: '/api/facet/subject/bicycles.json',
      className: 'canopy-slider extra',
      options: {
        breakpoints: {
          400: { slidesPerView: 2, spaceBetween: rem(1) },
          640: { slidesPerView: 3, spaceBetween: rem(1.618) },
          1024: { slidesPerView: 4, spaceBetween: rem(1.618) },
        },
      },
    });
  });

  test('Slider merges an author’s breakpoints by width, replacing a whole step', () => {
    expect(placeholderProps(html.sliderBreakpoints).options.breakpoints).toEqual({
      320: { slidesPerView: 1.5 },
      400: { slidesPerView: 2, spaceBetween: rem(1) },
      640: { slidesPerView: 2 },
      1024: { slidesPerView: 4, spaceBetween: rem(1.618) },
    });
  });

  test('Image renders a figure, its caption, and a sized placeholder', () => {
    expect(html.image).toMatch(/^<figure class="canopy-iiif-image">/);
    expect(html.image).toContain(
      'data-canopy-image="1" style="--canopy-iiif-image-height:420px;--canopy-iiif-image-bg:var(--color-gray-200)"',
    );
    expect(html.image).toContain(
      '<figcaption class="canopy-iiif-image__caption">A caption</figcaption>',
    );
    expect(placeholderProps(html.image)).toEqual({
      src: 'https://example.org/a.jpg',
      alt: 'A map',
      caption: 'A caption',
      height: '420px',
    });
  });

  test('Image defaults to 600px and no caption', () => {
    expect(html.imageDefaults).toContain('--canopy-iiif-image-height:600px');
    expect(html.imageDefaults).not.toContain('<figcaption');
    expect(placeholderProps(html.imageDefaults)).toEqual({
      src: 'https://example.org/a.jpg',
      isTiledImage: true,
    });
  });

  test('Scroll hands its props through unchanged', () => {
    expect(html.scroll).toMatch(/^<div data-canopy-scroll="1" class="not-prose"><script/);
    expect(placeholderProps(html.scroll)).toEqual({ iiifContent: MANIFEST.id });
  });
});

describe('manifest primitives', () => {
  test('Label renders the label in the element asked for, in its language', () => {
    expect(html.label).toBe('<h1 class="clover-label" lang="en">A bicycle catalog</h1>');
  });

  // Whole, as 1.x drew it: Clover 4 cuts a summary to five lines unless told `none`.
  test('Summary renders the summary whole, with the author’s class', () => {
    expect(html.summary.replace(/ id="[^"]*"/, '')).toBe(
      '<div class="clover-read-more"><p class="clover-summary canopy-lead"' +
        ' style="--clover-summary-lines:none" data-read-more="" lang="en">' +
        'Color plates of four models.</p></div>',
    );
  });

  test('Metadata renders a description list, linking indexed facet values to search', () => {
    // No `role="group"` between the `dl` and its pairs (WCAG 1.3.1; ACCESSIBILITY.md C6).
    expect(html.metadata).toBe(
      '<dl class="clover-metadata">' +
        '<div data-label="subject"><dt lang="en">Subject</dt><dd><span lang="en">' +
        '<a href="/search?type=work&amp;subject=bicycles" data-canopy-facet-link="" data-facet-label="subject" data-facet-value="bicycles">Bicycles</a>, ' +
        '<a href="/search?type=work&amp;subject=advertising" data-canopy-facet-link="" data-facet-label="subject" data-facet-value="advertising">Advertising</a>' +
        '</span></dd></div>' +
        '<div data-label="date"><dt lang="en">Date</dt><dd>1896</dd></div>' +
        '</dl>',
    );
  });

  test('Metadata keeps an author’s custom value content beside the facet links', () => {
    expect(html.metadataCustom).toContain('<dd><em>Dated 1896</em></dd>');
    expect(html.metadataCustom).toContain('data-facet-value="bicycles"');
  });

  test('RequiredStatement renders its label and value as a pair', () => {
    expect(html.requiredStatement).toBe(
      '<dl class="clover-required-statement"><div data-label="attribution">' +
        '<dt lang="en">Attribution</dt><dd lang="en">Courtesy of the library</dd></div></dl>',
    );
  });

  test('primitives render nothing for a manifest without the property', () => {
    expect(html.empty).toBe('');
  });
});
