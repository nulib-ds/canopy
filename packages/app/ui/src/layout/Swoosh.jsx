import React from 'react';

// The brush stroke under a word or two (`--canopy-swoosh`): a hand-drawn swoosh in the
// site's accent, drawn in once as the page loads, at once where motion is reduced. It is
// decoration only: the words read as they are, to everyone.
//
//   ## Thoughtful and <Swoosh>flexible</Swoosh>.
//   <Interstitials.Hero headline={<>Explore <Swoosh>the collection</Swoosh></>} />
export default function Swoosh({ children, className = '', ...rest }) {
  if (children == null || children === '') return null;
  const classes = ['canopy-swoosh', className].filter(Boolean).join(' ');
  return (
    <span className={classes} {...rest}>
      {children}
    </span>
  );
}
