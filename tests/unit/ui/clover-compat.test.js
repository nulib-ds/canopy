// Canopy's 1.x props, as authors write them for Clover 3, translated into Clover 4's
// (`packages/app/ui/src/iiif/clover-compat.js`). The MDX API is a contract (AGENTS.md):
// each option keeps doing what it did where Clover 4 can, and the build names the rest.

const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repoRoot = path.resolve(__dirname, '../../..');
const compat = path.join(repoRoot, 'packages/app/ui/src/iiif/clover-compat.js');

const rem = (value) => ({ __canopySliderUnit: 'rem', value });

// Canopy's Viewer defaults (`Viewer.jsx`) and its slider's (`sliderOptions.js`).
const VIEWER_DEFAULTS = {
  showDownload: false,
  showIIIFBadge: false,
  showTitle: false,
  informationPanel: { open: false, renderAbout: false, renderToggle: false },
};
const SLIDER_DEFAULTS = {
  breakpoints: {
    400: { slidesPerView: 2, spaceBetween: rem(1) },
    640: { slidesPerView: 3, spaceBetween: rem(1.618) },
    1024: { slidesPerView: 4, spaceBetween: rem(1.618) },
  },
};

// Runs each case through the module in a child process and returns the results by
// name. The module is ESM in a CommonJS package, so esbuild compiles it first, React
// stubbed: only its translations run here, never a factory's component.
function run(cases) {
  const script = `
    const { build } = await import('esbuild');
    const stubReact = {
      name: 'stub-react',
      setup(b) {
        b.onResolve({ filter: /^react$/ }, () => ({ path: 'react', namespace: 'stub' }));
        b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: 'export default {};' }));
      },
    };
    const built = await build({
      entryPoints: [${JSON.stringify(compat)}],
      bundle: true,
      format: 'esm',
      platform: 'node',
      write: false,
      logLevel: 'silent',
      plugins: [stubReact],
    });
    const code = built.outputFiles[0].text;
    const compat = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
    const cases = ${JSON.stringify(cases)};
    const out = {};
    for (const [name, [fn, ...args]] of Object.entries(cases)) out[name] = compat[fn](...args);
    process.stdout.write(JSON.stringify(out));
  `;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  if (result.status !== 0) throw new Error(result.stderr);
  return JSON.parse(result.stdout);
}

const viewer = (options, extra = {}) => ['toViewerProps', { iiifContent: 'm', options, ...extra }];

let out;
beforeAll(() => {
  out = run({
    defaults: viewer(VIEWER_DEFAULTS),
    titled: viewer({ ...VIEWER_DEFAULTS, showTitle: true }),
    open: viewer({ ...VIEWER_DEFAULTS, informationPanel: { open: true, renderToggle: false } }),
    toggled: viewer({ informationPanel: { open: false, renderToggle: true } }),
    clover3: viewer({}),
    map: viewer({ map: { enabled: true } }),
    sections: viewer({
      informationPanel: {
        renderContents: false,
        renderContentSearch: false,
        renderSupplementing: false,
        renderAnnotation: false,
        annotationTabLabel: 'Notes',
      },
      localeText: { contentSearch: { tabLabel: 'Find' } },
    }),
    look: viewer(
      { canvasHeight: '30rem', canvasBackgroundColor: '#123', background: 'white' },
      { className: 'mine' },
    ),
    height: viewer({ canvasHeight: '30rem' }, { height: '40rem' }),
    request: viewer({ withCredentials: true, requestHeaders: { 'X-Key': 'a' } }),
    crossOrigin: viewer({ crossOrigin: 'use-credentials' }),
    openSeadragon: viewer({
      openSeadragon: {
        maxZoomPixelRatio: 2,
        animationTime: 0.5,
        gestureSettingsMouse: { scrollToZoom: true },
        showNavigator: true,
      },
    }),
    at300: ['stepAt', SLIDER_DEFAULTS, 300],
    at500: ['stepAt', SLIDER_DEFAULTS, 500],
    at800: ['stepAt', SLIDER_DEFAULTS, 800],
    at1200: ['stepAt', SLIDER_DEFAULTS, 1200],
    fractions: [
      'stepAt',
      { breakpoints: { 320: { slidesPerView: 2.5 }, 640: { slidesPerView: 0.5 } } },
      800,
    ],
    items: ['toItemsProps', { iiifContent: 'c', options: SLIDER_DEFAULTS, height: '10rem' }, 1200],
    itemsPlain: ['toItemsProps', { iiifContent: 'c' }, 1200],
    canvas: [
      'toCanvasProps',
      {
        iiifContent: 'm',
        alt: 'A map',
        caption: 'Its caption',
        height: '420px',
        backgroundColor: 'black',
        openSeadragonConfig: { minZoomImageRatio: 0.5, showRotationControl: true },
      },
    ],
    noticesDefaults: ['unsupportedOptions', 'Viewer', { options: VIEWER_DEFAULTS }],
    notices: [
      'unsupportedOptions',
      'Viewer',
      {
        options: {
          showIIIFBadge: true,
          informationPanel: { defaultTab: 'annotations' },
          openSeadragon: { maxZoomPixelRatio: 2, showNavigator: true },
        },
      },
    ],
    noticesImage: [
      'unsupportedOptions',
      'Image',
      { openSeadragonConfig: { animationTime: 1, showRotationControl: true } },
    ],
    noticesScroll: ['unsupportedOptions', 'Scroll', { options: { offset: 80, figure: {} } }],
  });
});

describe('the Viewer', () => {
  // Clover 3 showed its collection browser without the title; Clover 4's Collection line.
  test("Canopy's defaults: no title but a Collection's line, no downloads, no panel", () => {
    expect(out.defaults).toMatchObject({
      iiifContent: 'm',
      header: 'collection',
      download: false,
      panel: false,
      defaultPanelOpen: false,
    });
  });

  test('showTitle draws the whole header', () => {
    expect(out.titled.header).toBe(true);
  });

  test('an open panel with renderToggle false has no toggle beside the Body', () => {
    expect(out.open).toMatchObject({ panel: true, defaultPanelOpen: true, panelToggle: false });
  });

  test('a shut panel with its toggle keeps the toggle', () => {
    expect(out.toggled).toMatchObject({ panel: true, defaultPanelOpen: false });
    expect(out.toggled).not.toHaveProperty('panelToggle');
  });

  test("leaves the map out unless map.enabled asks for it, as Clover 3's default did", () => {
    expect(out.clover3.panelSections).not.toContain('map');
    expect(out.map).not.toHaveProperty('panelSections');
  });

  test("leaves out each section its option turns off, and names its tabs", () => {
    expect(out.sections.panelSections).toEqual(['about', 'targets', 'collection']);
    expect(out.sections.panelLabels).toEqual({ annotations: 'Notes', search: 'Find' });
  });

  test('sizes and colors the Body as canvasHeight, canvasBackgroundColor and background did', () => {
    expect(out.look.style).toEqual({
      '--clover-body-height': '30rem',
      '--clover-canvas-background': '#123',
      background: 'white',
    });
    expect(out.look.className).toBe('mine');
    // Canopy's own `height` prop over the option.
    expect(out.height.style['--clover-body-height']).toBe('40rem');
  });

  test('sends credentials and headers as Clover 3 did', () => {
    expect(out.request.request).toEqual({ credentials: 'include', headers: { 'X-Key': 'a' } });
    expect(out.crossOrigin.request).toEqual({ credentials: 'include' });
    expect(out.defaults).not.toHaveProperty('request');
  });

  test("hands the Canvas the OpenSeadragon options it reads by the same name", () => {
    expect(out.openSeadragon.canvasOptions).toEqual({
      maxZoomPixelRatio: 2,
      animationTime: 0.5,
      gestures: { scrollToZoom: true },
    });
  });
});

describe('the Slider', () => {
  test('takes slides per view and their space from the breakpoint the width reaches', () => {
    expect(out.at300).toEqual({ slidesPerView: 1 });
    expect(out.at500).toEqual({ slidesPerView: 2, spaceBetween: rem(1) });
    expect(out.at800).toEqual({ slidesPerView: 3, spaceBetween: rem(1.618) });
    expect(out.at1200).toEqual({ slidesPerView: 4, spaceBetween: rem(1.618) });
  });

  // As Clover's `perView`: from 1, fractions too; a value under 1 is passed over.
  test('counts slides per view from 1, passing over a value under it', () => {
    expect(out.fractions).toEqual({ slidesPerView: 2.5 });
  });

  test("is Items' slider, so many items to a view, its gap and height from Canopy's props", () => {
    expect(out.items).toEqual({
      layout: 'slider',
      iiifContent: 'c',
      perView: 4,
      style: { '--clover-items-gap': '1.618rem', '--clover-items-height': '10rem' },
    });
    expect(out.itemsPlain).toEqual({ layout: 'slider', iiifContent: 'c' });
  });
});

describe('Image', () => {
  test("names the Canvas by its alt, and keeps Canopy's figure props to itself", () => {
    expect(out.canvas).toEqual({ iiifContent: 'm', label: 'A map', options: { minZoomImageRatio: 0.5 } });
  });
});

describe('build notices', () => {
  test("say nothing of Canopy's own defaults", () => {
    expect(out.noticesDefaults).toEqual([]);
  });

  test('name each option Clover 4 has nothing to do with, by its path', () => {
    expect(out.notices).toEqual([
      'options.showIIIFBadge',
      'options.informationPanel.defaultTab',
      'options.openSeadragon.showNavigator',
    ]);
    expect(out.noticesImage).toEqual(['openSeadragonConfig.showRotationControl']);
    expect(out.noticesScroll).toEqual(['options.offset', 'options.figure']);
  });
});
