import React from 'react';
import AppearanceToggle from './AppearanceToggle.jsx';
import CanopyBrand from './CanopyBrand.jsx';
import getSafePageContext from './pageContext.js';

function normalizeLinks(links) {
  if (!Array.isArray(links)) return [];
  return links
    .map((link) => {
      if (!link) return null;
      const href = typeof link.href === 'string' ? link.href.trim() : '';
      const label = link.label != null ? String(link.label).trim() : '';
      if (!href || !label) return null;
      return { href, label };
    })
    .filter(Boolean);
}

// The site's footer, in Clover's layout: what the site is (its brand and a sentence, when
// given `logo`, `title` or `description`), the footer's own content (`children`, as in
// 1.x), then a row under a hairline with its links and, for `theme.appearance: auto`, the
// appearance switch, a control rather than one of the links.
export default function CanopyFooter({
  className = '',
  children,
  logo: SiteLogo,
  title,
  description,
  links,
  brandHref = '/',
}) {
  const footerClassName = ['canopy-footer', className].filter(Boolean).join(' ');
  const PageContext = getSafePageContext();
  const context = React.useContext(PageContext);
  const appearance = context && context.site ? context.site.appearance : '';
  const footerLinks = normalizeLinks(links);
  const titleText = typeof title === 'string' ? title.trim() : '';
  const hasBrand = typeof SiteLogo === 'function' || Boolean(titleText);
  const hasAbout = hasBrand || Boolean(description);
  const hasToggle = appearance === 'auto';
  const hasLegal = footerLinks.length > 0 || hasToggle;

  return (
    <footer className={footerClassName}>
      <div className="canopy-footer__inner">
        {hasAbout ? (
          <div className="canopy-footer__about">
            {hasBrand ? (
              <CanopyBrand
                label={titleText}
                href={brandHref}
                className="canopy-footer__brand"
                Logo={SiteLogo}
              />
            ) : null}
            {description ? <p className="canopy-footer__lede">{description}</p> : null}
          </div>
        ) : null}
        {children}
        {hasLegal ? (
          <div className="canopy-footer__legal">
            {footerLinks.length ? (
              <ul className="canopy-footer__links" role="list">
                {footerLinks.map((link) => (
                  <li key={`${link.href}-${link.label}`}>
                    <a href={link.href}>{link.label}</a>
                  </li>
                ))}
              </ul>
            ) : null}
            {hasToggle ? <AppearanceToggle /> : null}
          </div>
        ) : null}
      </div>
    </footer>
  );
}
