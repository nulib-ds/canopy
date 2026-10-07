const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { buildVariablesMap, toTailwindScale } = require('../../../packages/app/ui/theme-palette');

const repoRoot = path.resolve(__dirname, '../../..');

// Renders the SSR ThemeShowcase in a child process (the UI bundle is ESM) and
// returns the preview data it embeds for the browser script.
function renderPreviewData() {
  const script = `
    const React = await import('react');
    const { renderToStaticMarkup } = await import('react-dom/server');
    const { ThemeShowcase } = await import('@canopy-iiif/app/ui/server');
    const html = renderToStaticMarkup(React.createElement(ThemeShowcase));
    const match = html.match(/data-theme-showcase-values="true">([^<]*)<\\/script>/);
    process.stdout.write(match ? match[1] : '');
  `;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  expect(result.status).toBe(0);
  return JSON.parse(result.stdout);
}

function buildVars(type, name, appearance) {
  const scale = toTailwindScale(name, { appearance });
  const vars =
    type === 'accent'
      ? buildVariablesMap(scale, null, { appearance })
      : buildVariablesMap(null, scale, { appearance });
  delete vars['color-scheme'];
  return vars;
}

test('previews exactly the variables a build generates for every palette', () => {
  const data = renderPreviewData();
  let compared = 0;
  for (const appearance of data.appearances) {
    for (const type of ['accent', 'gray']) {
      const names = type === 'accent' ? data.accentColors : data.grayColors;
      for (const name of names) {
        expect(data.vars[appearance][type][name]).toEqual(buildVars(type, name, appearance));
        compared += 1;
      }
    }
  }
  expect(compared).toBe(2 * (data.accentColors.length + data.grayColors.length));
});

test('previews current Clover tokens rather than the legacy names', () => {
  const { vars } = renderPreviewData();
  const indigo = vars.light.accent.indigo;
  expect(indigo['--color-accent-100']).toBe(toTailwindScale('indigo')['100']);
  expect(indigo['--clover-color-accent']).toBe('var(--color-accent-default)');
  expect(Object.keys(indigo).some((key) => key.startsWith('--colors-'))).toBe(false);
});
