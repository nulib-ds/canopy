// A search result's excerpt (`ArticleCard`, ui/src/layout/ArticleCard.jsx): read as inline
// Markdown, then cut to a window around the query by runs of text, never inside a span.
// Rendered in a child process, as the UI bundle is ESM.

const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repoRoot = path.resolve(__dirname, '../../..');

function render(cases) {
  const script = `
    const React = await import('react');
    const { renderToStaticMarkup } = await import('react-dom/server');
    const ui = await import('@nulib/canopy/ui');
    const cases = ${JSON.stringify(cases)};
    const out = {};
    for (const [name, props] of Object.entries(cases)) {
      const html = renderToStaticMarkup(React.createElement(ui.ArticleCard, { href: '/x.html', title: 'X', ...props }));
      const match = html.match(/<p class="canopy-article-card__snippet">([\\s\\S]*?)<\\/p>/);
      out[name] = match ? match[1] : '';
      out[name + ':html'] = html;
    }
    process.stdout.write(JSON.stringify(out));
  `;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  if (result.status !== 0) throw new Error(result.stderr);
  return JSON.parse(result.stdout);
}

const LONG_CODE = `Intro \`${'alpha '.repeat(80).trim()}\` then \`x\` target words follow here.`;

const html = render({
  cut: { summaryMarkdown: LONG_CODE, query: 'target' },
  escaped: { summaryMarkdown: 'A snake\\_case name and 5 \\* 3.' },
  intraword: { summary: 'Box a_b_c, folder d_e.' },
  emphasis: { summaryMarkdown: 'An _emphatic_ word and **strong** one.' },
  link: { summaryMarkdown: 'Read [the guide](/guide/) first.' },
  terms: { summaryMarkdown: 'Set `canopy.yml` and the theme.', query: 'canopy theme' },
  words: { summaryMarkdown: `${'lorem '.repeat(70)}needle ${'ipsum '.repeat(70)}`, query: 'needle' },
  pictured: { summaryMarkdown: 'Words.', thumbnail: '/images/a.jpg' },
  plain: { summaryMarkdown: 'Words.' },
  level2: { summaryMarkdown: 'Words.', headingLevel: 2 },
  level1: { summaryMarkdown: 'Words.', headingLevel: 1 },
  level9: { summaryMarkdown: 'Words.', headingLevel: 9 },
  levelText: { summaryMarkdown: 'Words.', headingLevel: 'x' },
});

test('a cut inside a code span keeps the code as code and the words after it as words', () => {
  expect(html.cut.startsWith('…<code>alpha')).toBe(true);
  expect(html.cut).toContain('</code> then <code>x</code> <mark>target</mark> words');
});

test('escaped characters are characters', () => {
  expect(html.escaped).toBe('A snake_case name and 5 * 3.');
});

test('an underscore inside a word is not emphasis', () => {
  expect(html.intraword).toBe('Box a_b_c, folder d_e.');
});

test('emphasis and strong at the edges of words are kept', () => {
  expect(html.emphasis).toBe('An <em>emphatic</em> word and <strong>strong</strong> one.');
});

test('a link keeps its words alone, as the card is a link', () => {
  expect(html.link).toBe('Read the guide first.');
});

test('each word of the query is marked', () => {
  expect(html.terms).toBe('Set <code><mark>canopy</mark>.yml</code> and the <mark>theme</mark>.');
});

test('a cut falls between words, marked with an ellipsis', () => {
  expect(html.words).toMatch(/^…lorem /);
  expect(html.words).toMatch(/ ipsum…$/);
  expect(html.words).toContain('<mark>needle</mark>');
});

test('a result with an image shows it beside its words, as decoration', () => {
  expect(html['pictured:html']).toMatch(/^<a href="\/x.html" class="canopy-article-card canopy-article-card--media">/);
  expect(html['pictured:html']).toContain(
    '<article><img class="canopy-article-card__thumb" src="/images/a.jpg" alt="" loading="lazy" decoding="async"/><h3 class="canopy-article-card__title">X</h3>',
  );
  expect(html['plain:html']).not.toMatch(/<img|--media/);
});

test('its title is a heading at the level it is given, 2 to 6, else 3', () => {
  const tag = (name) => (html[`${name}:html`].match(/<(h[1-6]) class="canopy-article-card__title">/) || [])[1];
  expect(tag('plain')).toBe('h3');
  expect(tag('level2')).toBe('h2');
  expect(tag('level1')).toBe('h2');
  expect(tag('level9')).toBe('h6');
  expect(tag('levelText')).toBe('h3');
});
