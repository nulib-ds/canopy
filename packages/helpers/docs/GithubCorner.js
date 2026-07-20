const React = require("react");

const styles = `
:where(.app-github-corner) {
  position: relative;
}
:where(.app-github-corner__content .canopy-header) {
  padding-right: 4.5rem;
}
:where(.app-github-corner .app-github-corner__link) {
  position: absolute;
  top: 1rem;
  right: 1.25rem;
  display: inline-flex;
  width: 2.75rem;
  height: 2.75rem;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  color: var(--color-gray-900);
  z-index: 2;
}
:where(.app-github-corner .app-github-corner__link svg) {
  width: 1.65rem;
  height: 1.65rem;
}
@media (max-width: 720px) {
  :where(.app-github-corner__content .canopy-header) {
    padding-right: 3.5rem;
  }
  :where(.app-github-corner .app-github-corner__link) {
    top: 0.75rem;
    right: 0.75rem;
  }
}
`;

function GithubCorner(props = {}) {
  const {
    href = "https://github.com/nulib-ds/canopy",
    label = "View the Canopy IIIF repository on GitHub",
    children,
  } = props;

  return React.createElement(
    "div",
    {className: "app-github-corner"},
    React.createElement("style", {
      key: "styles",
      "data-github-corner-styles": "true",
      dangerouslySetInnerHTML: {__html: styles},
    }),
    React.createElement(
      "div",
      {className: "app-github-corner__content", key: "content"},
      children,
    ),
    React.createElement(
      "a",
      {
        key: "link",
        className: "app-github-corner__link",
        href,
        target: "_blank",
        rel: "noreferrer noopener",
        "aria-label": label,
      },
      React.createElement(
        "svg",
        {
          xmlns: "http://www.w3.org/2000/svg",
          viewBox: "0 0 24 24",
          "aria-hidden": "true",
          focusable: "false",
        },
        React.createElement("path", {
          fill: "currentColor",
          fillRule: "evenodd",
          d: "M12 .5C5.53.5.5 5.57.5 12.11c0 5.14 3.32 9.49 7.93 11.03.58.12.79-.26.79-.58 0-.29-.01-1.05-.02-2.06-3.23.71-3.91-1.57-3.91-1.57-.54-1.38-1.33-1.75-1.33-1.75-1.09-.76.08-.75.08-.75 1.21.09 1.84 1.27 1.84 1.27 1.07 1.86 2.81 1.32 3.5 1.01.11-.8.42-1.32.77-1.63-2.58-.3-5.29-1.32-5.29-5.86 0-1.29.45-2.34 1.2-3.16-.12-.3-.52-1.5.11-3.13 0 0 .98-.32 3.2 1.21a10.7 10.7 0 0 1 5.83 0c2.22-1.53 3.2-1.21 3.2-1.21.63 1.63.23 2.83.11 3.13.75.82 1.2 1.87 1.2 3.16 0 4.55-2.72 5.56-5.31 5.86.43.38.82 1.12.82 2.26 0 1.63-.02 2.94-.02 3.34 0 .32.21.71.8.58a11.63 11.63 0 0 0 7.92-11.02C23.5 5.57 18.47.5 12 .5Z",
          clipRule: "evenodd",
        }),
      ),
    ),
  );
}

module.exports = GithubCorner;
module.exports.default = GithubCorner;
