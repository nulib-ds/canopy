import React from 'react';
import { Label as CloverLabel } from '@nulib/clover/primitives';

export function Label({ name, ...props }) {
  return <CloverLabel label={props.label} />;
}
