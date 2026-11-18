const fs = require("node:fs");
const path = require("node:path");
const React = require("react");
const {Container, DocsCodeBlock} = require("@nulib/canopy/ui/server");

const MAX_ITEMS = 30;
const RATIO_OPTIONS = [0.618, 1, 1.382];
const CODE_SAMPLE = `title: Art & Empire
collection:
  - https://api.dc.library.northwestern.edu/api/v2/collections/7ac5769f-a1d9-4227-a350-bf8bd8b1cddc?as=iiif
  - https://api.dc.library.northwestern.edu/api/v2/collections/94536627-cfdf-413c-852b-0cb16d986da3?as=iiif
manifest:
  - https://iiif.vam.ac.uk/collections/O1267239/manifest.json
  - https://iiif.vam.ac.uk/collections/O755793/manifest.json
  - https://iiif.vam.ac.uk/collections/O136839/manifest.json
  - https://iiif.vam.ac.uk/collections/O74660/manifest.json
metadata:
  - Subject
  - Date
  - Language
  - Genre
featured:
  - https://api.dc.library.northwestern.edu/api/v2/works/4bdb5a22-6c7f-498d-8e6e-e49ea9bc4778?as=iiif
  - https://api.dc.library.northwestern.edu/api/v2/works/c26591b2-994b-4ba3-a87e-9124419fa91b?as=iiif
theme:
  appearance: light
  accentColor: gold
  grayColor: gray`;

const componentStyles = `
.collection-example {
  position: relative;
  display: block;
  padding: clamp(var(--canopy-space-xl, 2.618rem), 6vw, var(--canopy-space-2xl, 4.236rem)) 0;
}

.collection-example__container {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 2.618rem;
}

.collection-example__grid {
  animation: collection-example-panel-in 0.8s forwards;
  display: flex;
  gap: clamp(var(--canopy-space-l, 1.618rem), 4vw, var(--canopy-space-2xl, 4.236rem));
  flex-wrap: nowrap;
  flex-direction: row-reverse;
  align-items: center;
}

.collection-example__panel {
  animation: collection-example-panel-in 0.8s forwards;
  width: 50%;
  display: flex;
  flex-direction: column;
  gap: 2.618rem;
}

.collection-example__intro {
  margin: 0 auto;
  max-width: 48rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  text-align: center;
}

/* Two balanced lines, centered over the words under it, however wide the column. */
.collection-example__heading {
  font-size: var(--canopy-text-title, 2rem);
  line-height: 1.1;
  margin: 0 auto;
  max-width: 14em;
  text-wrap: balance;
}

.collection-example__description {
  color: var(--color-gray-muted);
  font-size: var(--canopy-text-lede, 1.125rem);
  line-height: 1.5;
  text-wrap: balance;
}

.collection-example__code-shell {
  border-radius: 0.75rem;
  overflow: hidden;
}

.collection-example__code-shell > div {
  margin: 0 !important;
}

.collection-example__code-block {
  font-family: var(--font-mono);
  font-size: var(--canopy-text-code);
  line-height: 1.6;
  mask-image: linear-gradient(to right, black calc(100% - 5rem), transparent calc(100% - 1rem));
}

.collection-example__code-block code {
  display: block;
  overflow: hidden !important;
}

.collection-example__collection {
  width: 50%;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  height: 900px;
  overflow: hidden;
  mask-image: linear-gradient(to bottom, black calc(100% - 5rem), transparent calc(100% - 1rem));
}

.collection-example__collection-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: var(--canopy-text-label);
  font-weight: var(--canopy-weight-bold);
  letter-spacing: var(--canopy-tracking-label);
  text-transform: uppercase;
  color: var(--color-gray-muted);
}

.collection-example__columns {
  display: flex;
  gap: 1rem;
}

.collection-example__column {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  flex: 1 1 0;
}

.collection-example__item {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin: 0;
}

.collection-example__figure {
  position: relative;
  width: 100%;
  border-radius: 0.5rem;
  overflow: hidden;
  background: var(--color-gray-100);
  box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.06);
}

.collection-example__image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  color: transparent;
}

.collection-example__placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--canopy-text-sm);
}

/* A picture of a collection page, drawn small: its captions at the picture's scale. */
.collection-example__caption {
  font-size: 0.5rem;
  line-height: 1.1;
  color: var(--color-gray-800);
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

@media (max-width: 1024px) {
  .collection-example__grid {
    flex-direction: column;
  }

  .collection-example__panel,
  .collection-example__collection {
    width: 100%;
  }
}

.collection-example__code-block {
  font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace);
  font-size: var(--canopy-text-code);
  line-height: 1.6;
}

.collection-example__code-block code {
  display: block;
  overflow: hidden;
  overflow-x: auto;
}

@keyframes collection-example-line-in {
  0% { opacity: 0; transform: translateY(0.4rem); }
  100% { opacity: 1; transform: translateY(0); }
}

.collection-example__code-block code > span {
  opacity: 0;
  animation: collection-example-line-in 0.55s forwards;
}

.collection-example__code-block code > span:nth-child(1) { animation-delay: 0.02s; }
.collection-example__code-block code > span:nth-child(2) { animation-delay: 0.05s; }
.collection-example__code-block code > span:nth-child(3) { animation-delay: 0.08s; }
.collection-example__code-block code > span:nth-child(4) { animation-delay: 0.11s; }
.collection-example__code-block code > span:nth-child(5) { animation-delay: 0.14s; }
.collection-example__code-block code > span:nth-child(6) { animation-delay: 0.17s; }
.collection-example__code-block code > span:nth-child(7) { animation-delay: 0.2s; }
.collection-example__code-block code > span:nth-child(8) { animation-delay: 0.23s; }
.collection-example__code-block code > span:nth-child(9) { animation-delay: 0.26s; }
.collection-example__code-block code > span:nth-child(10) { animation-delay: 0.29s; }
.collection-example__code-block code > span:nth-child(11) { animation-delay: 0.32s; }
.collection-example__code-block code > span:nth-child(12) { animation-delay: 0.35s; }
.collection-example__code-block code > span:nth-child(13) { animation-delay: 0.38s; }
.collection-example__code-block code > span:nth-child(14) { animation-delay: 0.41s; }
.collection-example__code-block code > span:nth-child(15) { animation-delay: 0.44s; }
.collection-example__code-block code > span:nth-child(16) { animation-delay: 0.47s; }
.collection-example__code-block code > span:nth-child(17) { animation-delay: 0.5s; }
.collection-example__code-block code > span:nth-child(18) { animation-delay: 0.53s; }
.collection-example__code-block code > span:nth-child(19) { animation-delay: 0.56s; }
.collection-example__code-block code > span:nth-child(20) { animation-delay: 0.59s; }
.collection-example__code-block code > span:nth-child(21) { animation-delay: 0.62s; }
.collection-example__code-block code > span:nth-child(22) { animation-delay: 0.65s; }
.collection-example__code-block code > span:nth-child(23) { animation-delay: 0.68s; }
.collection-example__code-block code > span:nth-child(24) { animation-delay: 0.71s; }
.collection-example__code-block code > span:nth-child(25) { animation-delay: 0.74s; }
.collection-example__code-block code > span:nth-child(26) { animation-delay: 0.77s; }
.collection-example__code-block code > span:nth-child(27) { animation-delay: 0.8s; }
.collection-example__code-block code > span:nth-child(28) { animation-delay: 0.83s; }
.collection-example__code-block code > span:nth-child(29) { animation-delay: 0.86s; }
.collection-example__code-block code > span:nth-child(30) { animation-delay: 0.89s; }

@keyframes collection-example-panel-in {
  0% { opacity: 0; transform: translateY(1rem) scale(0.98); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}
  
@media (prefers-reduced-motion: reduce) {
  .collection-example__panel {
    animation: none;
    opacity: 1;
    transform: none;
  }
  .collection-example__code-block code > span {
    animation: none;
    opacity: 1;
    transform: none;
  }
}
`;

let cachedItems;

function normalizeLabel(label) {
  if (!label) return null;
  if (typeof label === "string") return label;
  if (Array.isArray(label)) return label[0];
  if (typeof label === "object") {
    const priority = ["en", "none"];
    for (const key of priority) {
      if (Array.isArray(label[key]) && label[key].length) {
        return label[key][0];
      }
    }
    const firstEntry = Object.values(label).find(
      (value) => Array.isArray(value) && value.length,
    );
    return firstEntry ? firstEntry[0] : null;
  }
  return null;
}

function humanizeSlug(slug = "") {
  return slug
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getManifestLabel(cacheDir, slug) {
  try {
    const manifestPath = path.join(cacheDir, "manifests", `${slug}.json`);
    if (!fs.existsSync(manifestPath)) return null;
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    return normalizeLabel(manifest.label);
  } catch (error) {
    return null;
  }
}

function loadDefaultItems() {
  if (cachedItems) return cachedItems;
  const cacheDir = path.join(process.cwd(), ".cache", "iiif");
  const indexPath = path.join(cacheDir, "index.json");

  if (!fs.existsSync(indexPath)) {
    cachedItems = [];
    return cachedItems;
  }

  try {
    const index = JSON.parse(fs.readFileSync(indexPath, "utf8"));
    const manifests = Array.isArray(index.byId)
      ? index.byId.filter((entry) => entry.type === "Manifest")
      : [];

    const items = [];
    for (const manifest of manifests) {
      if (items.length >= MAX_ITEMS) break;
      const label =
        getManifestLabel(cacheDir, manifest.slug) ||
        humanizeSlug(manifest.slug);
      const image = manifest.thumbnail || manifest.heroThumbnail || null;
      if (!image) continue;
      items.push({
        id: manifest.id,
        slug: manifest.slug,
        label,
        image,
      });
    }

    cachedItems = items;
  } catch (error) {
    cachedItems = [];
  }

  return cachedItems;
}

function buildColumns(items, columnCount = 5) {
  const columns = Array.from({length: columnCount}, () => []);
  items.forEach((item, index) => {
    const columnIndex = index % columnCount;
    columns[columnIndex].push({
      ...item,
      ratio: RATIO_OPTIONS[index % RATIO_OPTIONS.length],
    });
  });
  return columns.filter((column) => column.length > 0);
}

function CollectionExampleInterstitial({
  heading,
  description,
  items = loadDefaultItems(),
  className = "",
  style = {},
  ...rest
}) {
  const columns = buildColumns(items);

  return (
    <section
      className={`collection-example ${className}`}
      style={style}
      {...rest}
    >
      <style
        suppressHydrationWarning
        dangerouslySetInnerHTML={{__html: componentStyles}}
      />
      <Container variant="wide" className="collection-example__container">
        <div className="collection-example__grid" data-nosnippet="true">
          <div className="collection-example__panel">
            <div className="collection-example__intro">
              <h2 className="collection-example__heading">{heading}</h2>
              <p className="collection-example__description">{description}</p>
            </div>
            <div className="collection-example__code-shell">
              <DocsCodeBlock className="collection-example__code-block">
                <code
                  className="markdown-authoring__code language-mdx"
                  data-filename="canopy.yml"
                >
                  {CODE_SAMPLE}
                </code>
              </DocsCodeBlock>
            </div>
          </div>
          <div className="collection-example__collection">
            {columns.length && (
              <div className="collection-example__columns">
                {columns.map((column, columnIndex) => (
                  <div
                    className="collection-example__column"
                    key={`column-${columnIndex}`}
                  >
                    {column.map((item, itemIndex) => (
                      <figure
                        className="collection-example__item"
                        key={item.id}
                      >
                        <div
                          className="collection-example__figure"
                          style={{aspectRatio: item.ratio}}
                        >
                          {item.image ? (
                            <img
                              src={item.image}
                              alt={item.label}
                              className="collection-example__image"
                              loading="lazy"
                            />
                          ) : (
                            <div className="collection-example__placeholder">
                              Preview unavailable
                            </div>
                          )}
                        </div>
                        <figcaption className="collection-example__caption">
                          {item.label}
                        </figcaption>
                      </figure>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Container>
    </section>
  );
}

module.exports = CollectionExampleInterstitial;
module.exports.default = CollectionExampleInterstitial;
