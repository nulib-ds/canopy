import React from 'react';

// `<Swoosh>` marked a word or two with a brush stroke in 2.0.0 and 2.0.1. Canopy draws
// no stroke since 2.0.2 (Mat, 2026-11-18: "the marker under things is a Clover thing.
// remove this in Canopy."), and the words read as they are. The component stays, so MDX
// written with it keeps working (the MDX API is a contract, AGENTS.md); its class is
// there for a site that styles one of its own.
//
//   ## Thoughtful and <Swoosh>flexible</Swoosh>.
export default function Swoosh({ children, className = '', ...rest }) {
  if (children == null || children === '') return null;
  const classes = ['canopy-swoosh', className].filter(Boolean).join(' ');
  return (
    <span className={classes} {...rest}>
      {children}
    </span>
  );
}
