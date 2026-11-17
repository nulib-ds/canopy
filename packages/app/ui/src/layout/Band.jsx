import React from 'react';

// A black band for a call to action, after Clover's homepage: white words on black in
// both appearances (21:1; muted words 9:1 or more), its links and focus ring white, and
// any `<Button>` in it drawn for the dark (`_band.scss`).
//
//   <Band>
//     ## Have an idea for a project?
//     <Button href="/docs" label="Get started" />
//   </Band>
export default function Band({ children, className = '', align = 'center', ...rest }) {
  const classes = ['canopy-band', className].filter(Boolean).join(' ');
  const alignment = align === 'start' ? 'start' : 'center';
  return (
    <div className={classes} data-align={alignment} {...rest}>
      <div className="canopy-band__inner">{children}</div>
    </div>
  );
}
