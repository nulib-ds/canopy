import React from "react";
import {
  LEVELS,
  buildVariablesMap,
  swatchColor,
  toTailwindScale,
} from "../../theme-palette.js";

const COLOR_SCALES = [
  {label: "Accent", prefix: "--color-accent"},
  {label: "Gray", prefix: "--color-gray"},
];

const ACCENT_COLOR_NAMES = [
  "gray",
  "gold",
  "bronze",
  "brown",
  "yellow",
  "amber",
  "orange",
  "tomato",
  "red",
  "ruby",
  "crimson",
  "pink",
  "plum",
  "purple",
  "violet",
  "iris",
  "indigo",
  "blue",
  "cyan",
  "teal",
  "jade",
  "green",
  "grass",
  "lime",
  "mint",
  "sky",
];

const GRAY_COLOR_NAMES = ["gray", "mauve", "slate", "sage", "olive", "sand"];
const APPEARANCES = ["light", "dark"];
const DEFAULTS = {
  appearance: "light",
  accentColor: "indigo",
  grayColor: "slate",
};
const Section = ({title, description, children}) => (
  <div className="canopy-theme-showcase__section">
    <h3 className="canopy-theme-showcase__section-title">{title}</h3>
    {description ? (
      <p className="canopy-theme-showcase__section-description">
        {description}
      </p>
    ) : null}
    {children}
  </div>
);

const ColorScaleRow = ({label, prefix}) => (
  <div className="canopy-theme-showcase__scale-row">
    <div className="canopy-theme-showcase__scale-label">
      <strong>{label}</strong>
    </div>
    <div className="canopy-theme-showcase__scale-track">
      {LEVELS.map((stop) => (
        <div
          key={`${label}-${stop}`}
          className="canopy-theme-showcase__scale-stop"
        >
          <span
            className="canopy-theme-showcase__scale-chip"
            style={{backgroundColor: `var(${prefix}-${stop})`}}
          />
          <span className="canopy-theme-showcase__scale-token">{stop}</span>
        </div>
      ))}
    </div>
  </div>
);

// The variables a build emits for one palette, without `color-scheme`, which
// the preview sets from the chosen appearance.
function paletteVars(type, name, appearance) {
  const scale = toTailwindScale(name, {appearance});
  if (!scale) return null;
  const vars =
    type === "accent"
      ? buildVariablesMap(scale, null, {appearance})
      : buildVariablesMap(null, scale, {appearance});
  delete vars["color-scheme"];
  return vars;
}

function buildPreviewData() {
  const data = {
    appearances: APPEARANCES,
    accentColors: ACCENT_COLOR_NAMES,
    grayColors: GRAY_COLOR_NAMES,
    defaults: DEFAULTS,
    vars: {},
  };
  for (const appearance of APPEARANCES) {
    const accent = {};
    const gray = {};
    for (const name of ACCENT_COLOR_NAMES) {
      const vars = paletteVars("accent", name, appearance);
      if (vars) accent[name] = vars;
    }
    for (const name of GRAY_COLOR_NAMES) {
      const vars = paletteVars("gray", name, appearance);
      if (vars) gray[name] = vars;
    }
    data.vars[appearance] = {accent, gray};
  }
  return data;
}

const PREVIEW_DATA = buildPreviewData();

function encodeJson(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

const ColorsLabeled = ({colors, type}) => (
  <div className="canopy-theme-showcase__swatch-grid">
    {colors.map((name) => {
      const colorValue = swatchColor(name);
      return (
        <button
          key={`${type}-${name}`}
          type="button"
          className="canopy-theme-showcase__swatch"
          data-theme-swatch
          data-theme-swatch-type={type}
          data-theme-swatch-value={name}
          aria-pressed="false"
        >
          <span
            className="canopy-theme-showcase__swatch-chip"
            style={{background: colorValue || "var(--color-gray-200)"}}
          />
          <span className="canopy-theme-showcase__swatch-label">{name}</span>
        </button>
      );
    })}
  </div>
);

export default function ThemeShowcase() {
  const accentColors = ACCENT_COLOR_NAMES;
  const grayColors = GRAY_COLOR_NAMES;

  const styles = `
    .canopy-theme-showcase {
      margin: 2.618rem 0;
    }
    .canopy-theme-showcase__appearance-buttons {
      display: inline-flex;
      gap: 0.35rem;
      flex-wrap: wrap;
    }
    .canopy-theme-showcase__appearance-button {
      border: 1px solid var(--color-gray-300);
      background: var(--color-gray-50);
      color: var(--color-gray-900);
      padding: 0.3rem 0.9rem;
      font-size: 0.85rem;
      cursor: pointer;
      transition: border-color 0.15s ease, color 0.15s ease, background 0.15s ease;
    }
    .canopy-theme-showcase__appearance-button.is-active {
      border-color: var(--color-accent-default);
      color: var(--color-accent-default);
      background: color-mix(in srgb, var(--color-accent-100) 65%, transparent);
    }
    .canopy-theme-showcase__reset {
      border: 1px solid var(--color-gray-400);
      background: transparent;
      padding: 0.35rem 1.2rem;
      font-size: 0.85rem;
      cursor: pointer;
      color: var(--color-gray-900);
    }
    .canopy-theme-showcase__section {
      margin: 2.618rem 0;
    }
    .canopy-theme-showcase__section:first-of-type {
      margin-top: 0;
    }
    .canopy-theme-showcase__section:last-of-type {
      margin-bottom: 0;
    }
    .canopy-theme-showcase__section-title {
      margin: 0 0 0.382rem;
      font-size: 1.382rem;
    }
    .canopy-theme-showcase__section-description {
      margin: 0 0 1rem;
      color: var(--color-gray-muted);
      line-height: 1.5;
    }
    .canopy-theme-showcase__scale-group {
      display: flex;
      flex-direction: column;
      gap: 1.618rem;
    }
    .canopy-theme-showcase__scale-row {
      display: flex;
      gap: 1rem;
      align-items: center;
      flex-wrap: wrap;
    }
    .canopy-theme-showcase__scale-label {
      min-width: 90px;
      font-size: 0.9222rem;
    }
    .canopy-theme-showcase__scale-track {
      display: flex;
      flex: 1;
      overflow: auto;
    }
    .canopy-theme-showcase__scale-stop {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.382rem;
      overflow: hidden;
    }
    .canopy-theme-showcase__scale-chip {
      display: block;
      width: 100%;
      min-height: 2.618rem;
    }
    .canopy-theme-showcase__scale-token {
      font-size: 0.8333rem;
    }
    .canopy-theme-showcase__swatch-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 1rem;
    }
    .canopy-theme-showcase__swatch {
      width: 5.5rem;
      border: 1px solid var(--color-gray-200);
      background: var(--color-gray-50);
      padding: 0.5rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.35rem;
      cursor: pointer;
      transition: border-color 0.2s ease, background 0.2s ease, color 0.2s ease;
      font-weight: 300;
    }
    .canopy-theme-showcase__swatch:focus-visible {
      outline: 2px solid var(--color-accent-default);
      outline-offset: 3px;
    }
    .canopy-theme-showcase__swatch[data-swatch-active="true"] {
      border-color: var(--color-accent-default);
      background: linear-gradient(135deg, var(--color-accent-50), var(--color-accent-100));
      color: var(--color-gray-900);
      font-weight: 400;
    }
    .canopy-theme-showcase__swatch[data-swatch-active="true"][data-theme-swatch-type="gray"]  {
      border-color: var(--color-gray-default);
      background: linear-gradient(135deg, var(--color-gray-50), var(--color-gray-100));
    }
    .canopy-theme-showcase__swatch-chip {
      width: 100%;
      height: 2.618rem;
    }
    .canopy-theme-showcase__swatch-label {
      font-size: 0.9222rem;
      margin-top: 0.1rem;
    }
    .canopy-theme-showcase__swatch-controls { display: none; }
    .canopy-theme-showcase__clear-button { display: none; }
  `;

  return (
    <div className="canopy-theme-showcase" data-theme-showcase>
      <style dangerouslySetInnerHTML={{__html: styles}} />
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "1rem",
          marginBottom: "1rem",
        }}
      >
        <Section
          title="Appearance"
          description="Pick the base light or dark mode for the theme preview."
        >
          <div className="canopy-theme-showcase__appearance-buttons">
            {["light", "dark"].map((mode) => {
              const label = `${mode.charAt(0).toUpperCase()}${mode.slice(1)}`;
              const baseClass = "canopy-theme-showcase__appearance-button";
              const isDefault = mode === DEFAULTS.appearance;
              const className = isDefault
                ? `${baseClass} is-active`
                : baseClass;
              return (
                <button
                  key={mode}
                  type="button"
                  className={className}
                  data-theme-appearance={mode}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </Section>
        <button
          type="button"
          className="canopy-theme-showcase__reset"
          data-theme-reset
        >
          Reset
        </button>
      </div>
      <Section
        title="Color scales"
        description="Accent and gray ramps from the active theme."
      >
        <div style={{display: "flex", flexDirection: "column", gap: "1.5rem"}}>
          {COLOR_SCALES.map((scale) => (
            <ColorScaleRow
              key={scale.label}
              label={scale.label}
              prefix={scale.prefix}
            />
          ))}
        </div>
      </Section>
      <Section
        title="Accent color palette options"
        description="Click a swatch to temporarily override the accent palette."
      >
        <ColorsLabeled
          colors={accentColors}
          type="accent"
        />
      </Section>
      <Section
        title="Gray color palette options"
        description="Click a swatch to preview the neutral ramp for surfaces and text."
      >
        <ColorsLabeled
          colors={grayColors}
          type="gray"
        />
      </Section>
      <script
        type="application/json"
        data-theme-showcase-values
        dangerouslySetInnerHTML={{__html: encodeJson(PREVIEW_DATA)}}
      />
    </div>
  );
}
