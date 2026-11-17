import React from 'react';

function headingTag(level) {
  const n = Number(level);
  return Number.isInteger(n) && n >= 1 && n <= 6 ? `h${n}` : 'h2';
}

// A section's introduction, after Clover's homepage: a short eyebrow, a title at the
// section's level (`headingLevel`, 2 by default, as the page's own headings go), and the
// words under it, a step larger and muted, with whatever follows them (a `<Button>`).
// The eyebrow and title are one heading group (`hgroup`), read in order.
//
//   <Feature eyebrow="Search" title="Find anything in the collection">
//     Every work, by its title, subjects and summary.
//   </Feature>
export default function Feature({
  eyebrow,
  title,
  headingLevel = 2,
  align = 'start',
  className = '',
  children,
  ...rest
}) {
  const Heading = headingTag(headingLevel);
  const classes = ['canopy-feature', className].filter(Boolean).join(' ');
  const alignment = align === 'center' ? 'center' : 'start';
  const hasHeading = title != null && title !== '';
  return (
    <div className={classes} data-align={alignment} {...rest}>
      {hasHeading ? (
        eyebrow ? (
          <hgroup className="canopy-feature__heading">
            <p className="canopy-feature__eyebrow">{eyebrow}</p>
            <Heading className="canopy-feature__title">{title}</Heading>
          </hgroup>
        ) : (
          <Heading className="canopy-feature__title">{title}</Heading>
        )
      ) : null}
      {children != null && children !== '' ? (
        <div className="canopy-feature__body">{children}</div>
      ) : null}
    </div>
  );
}
