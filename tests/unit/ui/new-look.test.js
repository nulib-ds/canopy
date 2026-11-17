// The 2.x look's components, as the server renders them (packages/app/DESIGN.md §1):
// `Swoosh`, `Band` and `Feature`, the footer's new props beside its 1.x children, and the
// hero's centered variant. Rendered in a child process, as the UI bundle is ESM.

const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repoRoot = path.resolve(__dirname, '../../..');

function render(cases) {
  const script = `
    const React = await import('react');
    const { renderToStaticMarkup } = await import('react-dom/server');
    const ui = await import('@nulib/canopy/ui/server');
    const h = React.createElement;
    const Logo = () => h('svg', { viewBox: '0 0 10 10' });
    const cases = {
      swoosh: h(ui.Swoosh, null, 'flexible'),
      swooshEmpty: h(ui.Swoosh, null, ''),
      band: h(ui.Band, null, h('h2', null, 'Have an idea?')),
      bandStart: h(ui.Band, { align: 'start' }, 'Words'),
      feature: h(ui.Feature, { eyebrow: 'Search', title: 'Find it', headingLevel: 3 }, 'Every work.'),
      featureBare: h(ui.Feature, { title: 'Find it', headingLevel: 9 }),
      footer1x: h(ui.CanopyFooter, null, h('p', null, 'Copyright')),
      footer2x: h(
        ui.CanopyFooter,
        {
          logo: Logo,
          title: 'A site',
          description: 'What it is.',
          links: [{ href: '/about', label: 'About' }, { href: '', label: 'Nowhere' }],
        },
        h('p', null, 'Copyright'),
      ),
      hero: h(ui.Interstitials.Hero, {
        variant: 'centered',
        headline: h(React.Fragment, null, 'Explore ', h(ui.Swoosh, null, 'the collection')),
        description: 'Words.',
        item: { title: 'A work', href: '/works/a-work.html', thumbnail: '/a.jpg' },
      }),
      heroFeatured: h(ui.Interstitials.Hero, {
        variant: 'anything',
        headline: 'Explore',
        item: { title: 'A work', href: '/works/a-work.html', thumbnail: '/a.jpg' },
      }),
    };
    const out = {};
    for (const name of ${JSON.stringify(cases)}) out[name] = renderToStaticMarkup(cases[name]);
    process.stdout.write(JSON.stringify(out));
  `;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  if (result.status !== 0) throw new Error(result.stderr);
  return JSON.parse(result.stdout);
}

const html = render([
  'swoosh',
  'swooshEmpty',
  'band',
  'bandStart',
  'feature',
  'featureBare',
  'footer1x',
  'footer2x',
  'hero',
  'heroFeatured',
]);

test('Swoosh wraps its words, and draws nothing with none', () => {
  expect(html.swoosh).toBe('<span class="canopy-swoosh">flexible</span>');
  expect(html.swooshEmpty).toBe('');
});

test('Band is centered unless asked to start', () => {
  expect(html.band).toMatch(
    /^<div class="canopy-band" data-align="center"><div class="canopy-band__inner"><h2>/,
  );
  expect(html.bandStart).toContain('data-align="start"');
});

test('Feature groups its eyebrow and title, at the level it is given', () => {
  expect(html.feature).toContain(
    '<hgroup class="canopy-feature__heading"><p class="canopy-feature__eyebrow">Search</p><h3 class="canopy-feature__title">Find it</h3></hgroup>',
  );
  expect(html.feature).toContain('<div class="canopy-feature__body">Every work.</div>');
  // No eyebrow, no group; a level out of range is a section's, 2.
  expect(html.featureBare).toContain('<h2 class="canopy-feature__title">Find it</h2>');
  expect(html.featureBare).not.toContain('hgroup');
  expect(html.featureBare).not.toContain('canopy-feature__body');
});

test("a 1.x footer's children show as they did, with nothing added", () => {
  expect(html.footer1x).toBe(
    '<footer class="canopy-footer"><div class="canopy-footer__inner"><p>Copyright</p></div></footer>',
  );
});

test('the footer opens with the brand and its sentence, and ends with its links', () => {
  const footer = html.footer2x;
  expect(footer).toMatch(
    /<div class="canopy-footer__about"><a href="\/" class="canopy-logo canopy-footer__brand"><svg[^>]*><\/svg><span>A site<\/span><\/a>/,
  );
  expect(footer).toContain('<p class="canopy-footer__lede">What it is.</p>');
  expect(footer.indexOf('<p>Copyright</p>')).toBeGreaterThan(footer.indexOf('canopy-footer__lede'));
  // A link with no address is left out.
  expect(footer).toContain(
    '<div class="canopy-footer__legal"><ul class="canopy-footer__links" role="list"><li><a href="/about">About</a></li></ul></div>',
  );
});

test("the centered hero is the featured hero's markup, centered, its headline's stroke kept", () => {
  expect(html.hero).toMatch(
    /<section class="canopy-interstitial canopy-interstitial--hero canopy-interstitial--hero-featured canopy-interstitial--hero-centered"[^>]*data-canopy-hero-slider="1"[^>]*data-canopy-hero-variant="centered"/,
  );
  expect(html.hero).toContain(
    '<h1 class="canopy-interstitial__headline">Explore <span class="canopy-swoosh">the collection</span></h1>',
  );
  expect(html.hero).toContain('canopy-interstitial__media-group');
  // Any other variant is the featured hero, as in 1.x.
  expect(html.heroFeatured).toMatch(
    /class="canopy-interstitial canopy-interstitial--hero canopy-interstitial--hero-featured"/,
  );
  expect(html.heroFeatured).not.toContain('data-canopy-hero-variant');
});
