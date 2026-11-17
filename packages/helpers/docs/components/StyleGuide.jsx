const React = require('react');

// The docs' Style guide (content/docs/theme/style-guide.mdx): specimens drawn with
// Canopy's own text styles and tokens (packages/app/ui/styles/settings/_type.scss and
// _tokens.scss), so the page shows what every component draws with, in the site's theme.
// A small script reads each specimen's computed values into its spec, so the numbers are
// the stylesheet's own, never typed here.

const TEXT_STYLES = [
  {
    style: 'display',
    name: 'Display',
    sample: 'Explore the collection',
    use: "A hero's headline, once a page.",
  },
  {
    style: 'title',
    name: 'Title',
    sample: 'Maps of the Indian subcontinent',
    use: "A page's title, its h1 (# in Markdown), and a section's: Feature, Band.",
  },
  {
    style: 'h2',
    name: 'Heading 2',
    sample: 'Surveying the coast',
    use: 'A section within a page: ## in Markdown, a list of related works.',
  },
  {
    style: 'h3',
    name: 'Heading 3',
    sample: 'The first printed charts',
    use: "### in Markdown; a dialog's title; a timeline's.",
  },
  {
    style: 'h4',
    name: 'Heading 4 to 6',
    sample: 'Sources and further reading',
    use: "#### to ###### in Markdown; a slider's title; a page result's; the site's name.",
  },
  {
    style: 'lede',
    name: 'Lede',
    sample: 'Paintings and prints from libraries and museums, gathered in one place.',
    use: "Words under a title: .canopy-lead, a work's summary, the hero's description, a Feature's words, the footer's sentence, a quotation.",
  },
  {
    style: 'body',
    name: 'Body',
    sample:
      'By the early nineteenth century, the East India Company had transformed from a trading enterprise into a territorial power, exercising corporate sovereignty across much of the subcontinent.',
    use: 'What an author writes: paragraphs, lists and notes, held to a 70-character line.',
  },
  {
    style: 'ui',
    name: 'Interface',
    sample: 'Works  ·  About  ·  Search the collection',
    use: "Navigation, fields, menus, a card's title (in bold), a metadata value, a table's cells.",
  },
  {
    style: 'ui-sm',
    name: 'Interface, small',
    sample: 'Get started  ·  24 results  ·  1896, lithograph',
    use: "Buttons, captions, a card's second line, the footer, tabs, filters, counts.",
  },
  {
    style: 'label',
    name: 'Label',
    sample: 'Subject',
    use: "Over a value or a section: a metadata field, a table's head, an eyebrow (in the accent).",
  },
  {
    style: 'code',
    name: 'Code',
    sample: 'collection: https://example.org/iiif/collection.json',
    use: 'Code in running text and in blocks.',
  },
];

const SWATCHES = {
  text: [
    ['--color-gray-default', 'Body text', 'The page’s words. 4.5:1 or more on every surface.'],
    [
      '--color-gray-muted',
      'Muted text',
      'Ledes, captions, labels. 4.5:1 or more on every surface.',
    ],
    ['--color-accent-default', 'Accent text', 'Links, accent words, focus rings, a checked box.'],
  ],
  fills: [
    ['--color-accent-default', 'Primary fill', 'A primary button; its label is accent 50.'],
    ['--color-accent-hover', 'Primary hover', 'The fill under the pointer, away from its label.'],
    ['--color-accent-50', 'Label on a fill', 'The words on a primary fill, 4.5:1.'],
    ['--color-accent-600', 'Accent, solid', 'The brush stroke’s ink, a quotation’s rule.'],
  ],
  surfaces: [
    ['--color-gray-50', 'Page', 'The ground everything stands on.'],
    ['--canopy-surface', 'Surface', 'A panel’s solid fill: filters, chips, a field’s hint.'],
    ['--canopy-surface-raised', 'Raised', 'A card’s fill: the page in light, lighter in the dark.'],
    ['--canopy-surface-sunken', 'Sunken', 'A well. No muted text on it.'],
    ['--canopy-edge', 'Hairline', 'A card’s edge, a rule. Decoration only.'],
    ['--canopy-control-edge', 'Control edge', 'A field’s and an outline button’s edge, 3:1.'],
  ],
  black: [
    ['--canopy-band-background', 'Black', 'A band and a code block, in both appearances.'],
    ['--canopy-band-text', 'On black', 'Words on black, 21:1.'],
    ['--canopy-band-muted', 'Muted on black', 'Quieter words on black, 9:1 or more.'],
  ],
};

const RADII = ['sm', 'md', 'lg', 'xl', 'pill'];
const SHADOWS = [
  ['--canopy-shadow-sm', 'Small'],
  ['--canopy-shadow-md', 'Medium'],
  ['--canopy-shadow-lg', 'Large'],
  ['--canopy-card-shadow', 'Card'],
];
const SPACES = ['3xs', '2xs', 'xs', 's', 'm', 'l', 'xl', '2xl'];

const CSS = `
.style-guide { display: grid; gap: var(--canopy-space-l); margin: var(--canopy-space-l) 0 var(--canopy-space-xl); }
.style-guide__row { display: grid; gap: var(--canopy-space-s); padding: var(--canopy-space-m) 0; border-top: 1px solid var(--canopy-edge); }
@media (min-width: 64rem) { .style-guide__row { grid-template-columns: minmax(0, 2fr) minmax(14rem, 1fr); align-items: baseline; } }
.style-guide__sample { min-width: 0; margin: 0; padding: 0; overflow-wrap: anywhere; }
.style-guide__meta { display: grid; gap: var(--canopy-space-2xs); }
.style-guide__name { margin: 0; color: var(--color-gray-900); }
.style-guide__spec, .style-guide__use { margin: 0; padding: 0; color: var(--color-gray-muted); }
.style-guide__spec code { background: none; padding: 0; color: inherit; }
.style-guide__grid { display: grid; gap: var(--canopy-space-m); grid-template-columns: repeat(auto-fill, minmax(13rem, 1fr)); margin: var(--canopy-space-m) 0 var(--canopy-space-xl); padding: 0; list-style: none; }
.style-guide__grid > li { margin: 0; list-style: none; display: grid; gap: var(--canopy-space-2xs); align-content: start; }
.style-guide__chip { height: 4.236rem; border-radius: var(--canopy-radius-md); box-shadow: inset 0 0 0 1px var(--canopy-edge); }
.style-guide__shape { height: 4.236rem; background: var(--canopy-surface-raised); }
.style-guide__space { height: 1rem; background: var(--color-accent-600); border-radius: var(--canopy-radius-sm); }
.style-guide__family { margin: 0; padding: 0; font-size: var(--canopy-text-2xl); line-height: 1.3; overflow-wrap: anywhere; }
`;

// The specimens' own layout, once on the page.
function StyleGuideStyles() {
  return <style dangerouslySetInnerHTML={{ __html: CSS }} />;
}

function Spec({ fallback }) {
  return (
    <p className="style-guide__spec canopy-type-ui-sm" data-style-spec>
      <code>{fallback}</code>
    </p>
  );
}

function TypeStyles() {
  return (
    <div className="style-guide" data-style-guide>
      {TEXT_STYLES.map((entry) => (
        <div className="style-guide__row" key={entry.style}>
          <p className={`style-guide__sample canopy-type-${entry.style}`} data-style-sample>
            {entry.sample}
          </p>
          <div className="style-guide__meta">
            <p className="style-guide__name canopy-type-ui">
              <strong>{entry.name}</strong> · <code>.canopy-type-{entry.style}</code>
            </p>
            <Spec fallback={`@include type.${entry.style}`} />
            <p className="style-guide__use canopy-type-ui-sm">{entry.use}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function Families() {
  const families = [
    [
      'var(--canopy-font-display)',
      'Google Sans Flex',
      'Headlines and the interface.',
      ['--font-sans', '--canopy-font-display'],
    ],
    [
      'var(--canopy-font-body)',
      'Source Serif 4',
      'Reading text.',
      ['--font-serif', '--canopy-font-body'],
    ],
    ['var(--font-mono)', 'The system’s monospace', 'Code.', ['--font-mono']],
  ];
  return (
    <ul className="style-guide__grid" role="list">
      {families.map(([family, name, use, tokens]) => (
        <li key={name}>
          <p className="style-guide__family" style={{ fontFamily: family }} aria-hidden="true">
            Aa Gg 123
          </p>
          <p className="style-guide__name canopy-type-ui">
            <strong>{name}</strong>
          </p>
          <p className="style-guide__use canopy-type-ui-sm">{use}</p>
          <p className="style-guide__spec canopy-type-ui-sm">
            {tokens.map((token, index) => (
              <React.Fragment key={token}>
                {index ? ', ' : null}
                <code>{token}</code>
              </React.Fragment>
            ))}
          </p>
        </li>
      ))}
    </ul>
  );
}

function Swatches({ group = 'text' }) {
  const list = SWATCHES[group] || [];
  return (
    <ul className="style-guide__grid" role="list">
      {list.map(([token, name, use]) => (
        <li key={`${group}-${token}`}>
          <div
            className="style-guide__chip"
            style={{ background: `var(${token})` }}
            data-swatch={token}
          />
          <p className="style-guide__name canopy-type-ui">
            <strong>{name}</strong>
          </p>
          <p className="style-guide__spec canopy-type-ui-sm">
            <code>{token}</code> <span data-swatch-value={token} />
          </p>
          <p className="style-guide__use canopy-type-ui-sm">{use}</p>
        </li>
      ))}
    </ul>
  );
}

function Shapes() {
  return (
    <>
      <ul className="style-guide__grid" role="list">
        {RADII.map((radius) => (
          <li key={radius}>
            <div
              className="style-guide__shape"
              style={{
                borderRadius: `var(--canopy-radius-${radius})`,
                boxShadow: 'var(--canopy-card-shadow)',
              }}
            />
            <p className="style-guide__spec canopy-type-ui-sm">
              <code>--canopy-radius-{radius}</code>
            </p>
          </li>
        ))}
      </ul>
      <ul className="style-guide__grid" role="list">
        {SHADOWS.map(([token, name]) => (
          <li key={token}>
            <div
              className="style-guide__shape"
              style={{ borderRadius: 'var(--canopy-radius-lg)', boxShadow: `var(${token})` }}
            />
            <p className="style-guide__name canopy-type-ui">
              <strong>{name}</strong>
            </p>
            <p className="style-guide__spec canopy-type-ui-sm">
              <code>{token}</code>
            </p>
          </li>
        ))}
        <li>
          <div
            className="style-guide__shape"
            style={{
              borderRadius: 'var(--canopy-radius-lg)',
              boxShadow: 'var(--canopy-focus-ring)',
            }}
          />
          <p className="style-guide__name canopy-type-ui">
            <strong>Focus ring</strong>
          </p>
          <p className="style-guide__spec canopy-type-ui-sm">
            <code>--canopy-focus-ring</code>
          </p>
        </li>
      </ul>
    </>
  );
}

function Spacing() {
  return (
    <ul className="style-guide__grid" role="list" style={{ gridTemplateColumns: '1fr' }}>
      {SPACES.map((step) => (
        <li
          key={step}
          style={{ gridTemplateColumns: '10rem minmax(0, 1fr)', alignItems: 'center' }}
        >
          <p className="style-guide__spec canopy-type-ui-sm">
            <code>--canopy-space-{step}</code> <span data-space-value={step} />
          </p>
          <div className="style-guide__space" style={{ width: `var(--canopy-space-${step})` }} />
        </li>
      ))}
    </ul>
  );
}

// Fills each spec with the computed values, once the page has its fonts.
function StyleGuideScript() {
  const code = `
(function () {
  function rem(px) { var base = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16; return (Math.round(px / base * 1000) / 1000) + 'rem'; }
  // Any CSS color, OKLab mixes among them, as hex: painted on a pixel and read back.
  var pixel = document.createElement('canvas');
  pixel.width = pixel.height = 1;
  var ctx = pixel.getContext('2d', { willReadFrequently: true });
  function hex(color) {
    if (!ctx) return color;
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = '#000';
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 1, 1);
    var d = ctx.getImageData(0, 0, 1, 1).data;
    return '#' + [d[0], d[1], d[2]].map(function (v) { return v.toString(16).padStart(2, '0'); }).join('');
  }
  function fill() {
    document.querySelectorAll('[data-style-sample]').forEach(function (sample) {
      var row = sample.closest('.style-guide__row');
      var spec = row && row.querySelector('[data-style-spec]');
      if (!spec) return;
      var s = getComputedStyle(sample);
      var family = s.fontFamily.split(',')[0].replace(/["']/g, '');
      var size = parseFloat(s.fontSize);
      var lh = s.lineHeight === 'normal' ? 'normal' : (Math.round(parseFloat(s.lineHeight) / size * 100) / 100);
      var track = s.letterSpacing === 'normal' ? '0' : (Math.round(parseFloat(s.letterSpacing) / size * 100) / 100) + 'em';
      spec.textContent = family + ' · ' + rem(size) + ' (' + Math.round(size) + 'px) · ' + s.fontWeight + ' · line ' + lh + ' · tracking ' + track + (s.textTransform === 'uppercase' ? ' · uppercase' : '');
    });
    document.querySelectorAll('[data-swatch-value]').forEach(function (el) {
      var token = el.getAttribute('data-swatch-value');
      var value = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
      var probe = document.querySelector('[data-swatch="' + token + '"]');
      var shown = probe ? getComputedStyle(probe).backgroundColor : value;
      el.textContent = hex(shown);
    });
    document.querySelectorAll('[data-space-value]').forEach(function (el) {
      var step = el.getAttribute('data-space-value');
      var value = getComputedStyle(document.documentElement).getPropertyValue('--canopy-space-' + step).trim();
      el.textContent = value;
    });
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fill); else fill();
  window.addEventListener('resize', fill);
})();
`;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}

// One default export, its parts as members (`<StyleGuide.TypeStyles />`), as the docs'
// MDX imports its helpers.
const StyleGuide = {
  Families,
  Script: StyleGuideScript,
  Shapes,
  Spacing,
  Styles: StyleGuideStyles,
  Swatches,
  TypeStyles,
};

module.exports = StyleGuide;
module.exports.default = StyleGuide;
