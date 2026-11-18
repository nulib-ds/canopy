const React = require("react");
const {Container, DocsCodeBlock, Image} = require("@nulib/canopy/ui/server");

const CODE_SAMPLE = `### Corporate Empire and Cartographic Authority

By the early nineteenth century, the East India Company had 
transformed from  a trading enterprise into a territorial 
power, exercising corporate sovereignty across much of the 
Indian subcontinent. Maps such as this one helped naturalize 
that expansion by translating diverse political landscapes 
into legible borders, routes, and regions that could be 
governed, taxed, and defended. The atlas format reinforced 
these claims by presenting Company influence as stable 
geography rather than contested rule.

<Image
  src="https://iiif.dc.library.northwestern.edu/iiif/3/f0e6bb1d-f5a4-4b20-ad08-1ee9db915c9f"
  height="400px"
  isTiledImage
  alt="Map of Hindostan (1811)"
  caption="“Hindostan” from Pinkerton’s Modern Atlas shows the Indian subcontinent through a British colonial lens. Its borders, place names, and measurements reflect imperial rule and East India Company influence."
/>

This cartographic vision also reveals how knowledge 
production and imperial power worked together. By 
privileging standardized measurement, European place-name 
conventions, and administrative divisions, the map frames 
the subcontinent as a coherent space open to managerial 
control. Such representations supported both practical 
governance and public legitimacy, offering metropolitan 
readers an image of order and possession that obscured 
local authority, resistance, and the uneven realities of 
Company rule.`;

const componentStyles = `
.markdown-authoring {
  padding: clamp(var(--canopy-space-xl, 2.618rem), 6vw, var(--canopy-space-2xl, 4.236rem)) 0;
}

.markdown-authoring__container {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 2.618rem;
}

.markdown-authoring__intro {
  margin: 0 auto;
  max-width: 48rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  text-align: center;
}

/* Two balanced lines, centered over the words under it, however wide the column. */
.markdown-authoring__heading {
  font-size: var(--canopy-text-title, 2rem);
  line-height: 1.1;
  margin: 0 auto;
  max-width: 14em;
  text-wrap: balance;
}

.markdown-authoring__description {
  color: var(--color-gray-muted);
  font-size: var(--canopy-text-lede, 1.125rem);
  line-height: 1.5;
  text-wrap: balance;
}

.markdown-authoring__grid {
  display: flex;
  flex-wrap: nowrap;
  gap: clamp(var(--canopy-space-l, 1.618rem), 4vw, var(--canopy-space-2xl, 4.236rem));
  animation: markdown-authoring-panel-in 0.8s forwards;
}

.markdown-authoring__panel {
  animation: markdown-authoring-panel-in 0.8s forwards;
  width: 50%;
  display: flex;
  flex-direction: column;
  gap: 2.618rem;
  justify-content: center;
}

.markdown-authoring__content {
  position: relative;
}

/* The rendered page, as a site draws its prose: the reading serif. */
.markdown-authoring__content-text {
  font-family: var(--canopy-font-body, Georgia, serif);
  font-size: var(--canopy-text-body, 1.0625rem);
}

.markdown-authoring__content::before,
.markdown-authoring__content::after {
  position: absolute;
  font-size: var(--canopy-text-display);
  line-height: 1;
  color: var(--color-accent-default);
  font-weight: var(--canopy-weight-regular);
  pointer-events: none;
}

.markdown-authoring__content::before {
  content: "“";  
  top: 2.618rem;
  left: -1.618rem;
  transform: translate(-40%, -40%);
}

.markdown-authoring__content::after {
  content: "”";
  bottom: 0;
  right: -1rem;
  transform: translate(40%, 40%);
}

@media (max-width: 1024px) {
  .markdown-authoring__grid {
    flex-direction: column;
    gap: 0rem;
  }

  .markdown-authoring__panel {
    width: 100%;
    padding: 0;
  }
}

.markdown-authoring__content .canopy-iiif-image {
  margin: 1.618rem 0;
}

.markdown-authoring__panel--delay-1 { animation-delay: 0.2s; }
.markdown-authoring__panel--delay-2 { animation-delay: 0.35s; }
.markdown-authoring__panel--delay-3 { animation-delay: 0.5s; }

.markdown-authoring__code-shell {
  border-radius: 0.75rem;
}

.markdown-authoring__code-shell > div {
  margin: 0 !important;
}

.markdown-authoring__code-block {
  font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace);
  font-size: var(--canopy-text-code);
  line-height: 1.6;
  mask-image: linear-gradient(to right, black calc(100% - 5rem), transparent calc(100% - 1rem));
}

.markdown-authoring__code-block code {
  display: block;
  overflow: hidden;
}

@keyframes markdown-authoring-line-in {
  0% { opacity: 0; transform: translateY(0.4rem); }
  100% { opacity: 1; transform: translateY(0); }
}

.markdown-authoring__code-block code > span {
  opacity: 0;
  animation: markdown-authoring-line-in 0.55s forwards;
}

.markdown-authoring__code-block code > span:nth-child(1) { animation-delay: 0.02s; }
.markdown-authoring__code-block code > span:nth-child(2) { animation-delay: 0.05s; }
.markdown-authoring__code-block code > span:nth-child(3) { animation-delay: 0.08s; }
.markdown-authoring__code-block code > span:nth-child(4) { animation-delay: 0.11s; }
.markdown-authoring__code-block code > span:nth-child(5) { animation-delay: 0.14s; }
.markdown-authoring__code-block code > span:nth-child(6) { animation-delay: 0.17s; }
.markdown-authoring__code-block code > span:nth-child(7) { animation-delay: 0.2s; }
.markdown-authoring__code-block code > span:nth-child(8) { animation-delay: 0.23s; }
.markdown-authoring__code-block code > span:nth-child(9) { animation-delay: 0.26s; }
.markdown-authoring__code-block code > span:nth-child(10) { animation-delay: 0.29s; }
.markdown-authoring__code-block code > span:nth-child(11) { animation-delay: 0.32s; }
.markdown-authoring__code-block code > span:nth-child(12) { animation-delay: 0.35s; }
.markdown-authoring__code-block code > span:nth-child(13) { animation-delay: 0.38s; }
.markdown-authoring__code-block code > span:nth-child(14) { animation-delay: 0.41s; }
.markdown-authoring__code-block code > span:nth-child(15) { animation-delay: 0.44s; }
.markdown-authoring__code-block code > span:nth-child(16) { animation-delay: 0.47s; }
.markdown-authoring__code-block code > span:nth-child(17) { animation-delay: 0.5s; }
.markdown-authoring__code-block code > span:nth-child(18) { animation-delay: 0.53s; }
.markdown-authoring__code-block code > span:nth-child(19) { animation-delay: 0.56s; }
.markdown-authoring__code-block code > span:nth-child(20) { animation-delay: 0.59s; }
.markdown-authoring__code-block code > span:nth-child(21) { animation-delay: 0.62s; }
.markdown-authoring__code-block code > span:nth-child(22) { animation-delay: 0.65s; }
.markdown-authoring__code-block code > span:nth-child(23) { animation-delay: 0.68s; }
.markdown-authoring__code-block code > span:nth-child(24) { animation-delay: 0.71s; }
.markdown-authoring__code-block code > span:nth-child(25) { animation-delay: 0.74s; }
.markdown-authoring__code-block code > span:nth-child(26) { animation-delay: 0.77s; }
.markdown-authoring__code-block code > span:nth-child(27) { animation-delay: 0.8s; }
.markdown-authoring__code-block code > span:nth-child(28) { animation-delay: 0.83s; }
.markdown-authoring__code-block code > span:nth-child(29) { animation-delay: 0.86s; }
.markdown-authoring__code-block code > span:nth-child(30) { animation-delay: 0.89s; }

@keyframes markdown-authoring-panel-in {
  0% { opacity: 0; transform: translateY(1rem) scale(0.98); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}
  
@media (prefers-reduced-motion: reduce) {
  .markdown-authoring__panel {
    animation: none;
    opacity: 1;
    transform: none;
  }
  .markdown-authoring__code-block code > span {
    animation: none;
    opacity: 1;
    transform: none;
  }
}
`;

function MarkdownAuthoring({
  heading,
  description,
  className = "",
  style = {},
  ...rest
}) {
  return (
    <section
      className={`markdown-authoring ${className}`}
      style={style}
      {...rest}
    >
      <style
        suppressHydrationWarning
        dangerouslySetInnerHTML={{__html: componentStyles}}
      />
      <Container variant="wide" className="markdown-authoring__container">
        <div className="markdown-authoring__grid" data-nosnippet="true">
          <div className="markdown-authoring__panel">
            <div className="markdown-authoring__intro">
              <h2 className="markdown-authoring__heading">{heading}</h2>
              <p className="markdown-authoring__description">{description}</p>
            </div>
            <div className="markdown-authoring__code-shell">
              <DocsCodeBlock className="markdown-authoring__code-block">
                <code
                  className="markdown-authoring__code language-mdx"
                  data-filename="content/corporate-empire.mdx"
                >
                  {CODE_SAMPLE}
                </code>
              </DocsCodeBlock>
            </div>
          </div>
          <div className="markdown-authoring__content">
            <h3 className="markdown-authoring__content-heading">
              Corporate Empire and Cartographic Authority
            </h3>
            <p className="markdown-authoring__content-text">
              By the early nineteenth century, the East India Company had
              transformed from a trading enterprise into a territorial power,
              exercising corporate sovereignty across much of the Indian
              subcontinent. Maps such as this one helped naturalize that
              expansion by translating diverse political landscapes into legible
              borders, routes, and regions that could be governed, taxed, and
              defended. The atlas format reinforced these claims by presenting
              Company influence as stable geography rather than contested rule.
            </p>
            <Image
              src="https://iiif.dc.library.northwestern.edu/iiif/3/f0e6bb1d-f5a4-4b20-ad08-1ee9db915c9f"
              height="400px"
              alt="Map of Hindostan (1811)"
              caption="“Hindostan” from Pinkerton’s Modern Atlas shows the Indian subcontinent through a British colonial lens. Its borders, place names, and measurements reflect imperial rule and East India Company influence."
              isTiledImage
            />
            <p className="markdown-authoring__content-text">
              This cartographic vision also reveals how knowledge production and
              imperial power worked together. By privileging standardized
              measurement, European place-name conventions, and administrative
              divisions, the map frames the subcontinent as a coherent space
              open to managerial control. Such representations supported both
              practical governance and public legitimacy, offering metropolitan
              readers an image of order and possession that obscured local
              authority, resistance, and the uneven realities of Company rule.
            </p>
          </div>
        </div>
      </Container>
    </section>
  );
}

module.exports = MarkdownAuthoring;
module.exports.default = MarkdownAuthoring;
