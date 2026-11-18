const React = require("react");

// The line under the header saying whose project Canopy is, after Clover's docs
// (nulib-ds/clover, `docs/components/Subheader.tsx`, `docs/styles/layout.css`): on the
// docs site's home page alone (`content/index.mdx`), as Clover's is, the footer saying it
// everywhere else. A small acknowledgment on the page's own ground, at the end of the line,
// level with the header's last control (the GitHub link, `GithubCorner.js`), centered on
// a narrow window. Muted, its link too and underlined, so it is told apart by more than
// its color (WCAG 1.4.1). It scrolls away with the page. The docs site's own: a template
// has its own home page, so it never carries this (packages/helpers/template).
const styles = `
.app-project-credit {
  margin: 0;
  padding-block: 0.618rem 0;
  padding-inline: clamp(1rem, 3vw, 2rem) 1.25rem;
  font-size: var(--canopy-text-sm, 0.9375rem);
  line-height: 1.5;
  color: var(--color-gray-muted);
  text-align: end;
}
.app-project-credit a {
  color: inherit;
  text-decoration: underline;
  text-underline-offset: 0.2em;
}
/* The hero tucks its top under the header (its gradient starts in the page's own ground);
   after this line it starts under the line instead, so it never covers it. */
.app-project-credit + .canopy-interstitial--hero {
  margin-top: 0;
  padding-top: 0;
}
@media (max-width: 47.9375rem) {
  .app-project-credit {
    padding-inline: 0.75rem;
    text-align: center;
  }
}
`;

function ProjectCredit() {
  return React.createElement(
    React.Fragment,
    null,
    React.createElement("style", {
      "data-project-credit-styles": "true",
      dangerouslySetInnerHTML: {__html: styles},
    }),
    React.createElement(
      "p",
      {className: "app-project-credit"},
      "Canopy is a project of ",
      React.createElement(
        "a",
        {href: "https://www.library.northwestern.edu/"},
        "Northwestern University Libraries",
      ),
      ".",
    ),
  );
}

module.exports = ProjectCredit;
module.exports.default = ProjectCredit;
