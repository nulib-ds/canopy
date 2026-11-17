import React from 'react';
import { useLocale } from '../locale/index.js';

// The site's appearance (System, Light or Dark) where `canopy.yml` sets
// `theme.appearance: auto`. `CanopyFooter` draws it there; a site with a footer of its
// own can place it anywhere, once a page.
//
// A native select with a visible label: keyboard, touch and screen readers work with
// it as they do with any select. The page's inline appearance script
// (lib/build/appearance.js) shows it, sets it to the visitor's choice, and applies and
// keeps a change. It stays hidden without that script, since it would do nothing.
export default function AppearanceToggle({ className = '' }) {
  const { getString } = useLocale();
  const generatedId = typeof React.useId === 'function' ? React.useId() : '';
  const selectId = `canopy-appearance-${String(generatedId).replace(/[^a-zA-Z0-9_-]/g, '') || 'select'}`;
  const classes = ['canopy-appearance', className].filter(Boolean).join(' ');
  return (
    <div className={classes} data-canopy-appearance="" hidden>
      <label className="canopy-appearance__label" htmlFor={selectId}>
        {getString('common.appearance.label', 'Appearance')}
      </label>
      <select id={selectId} className="canopy-appearance__select" defaultValue="system">
        <option value="system">{getString('common.appearance.system', 'System')}</option>
        <option value="light">{getString('common.appearance.light', 'Light')}</option>
        <option value="dark">{getString('common.appearance.dark', 'Dark')}</option>
      </select>
    </div>
  );
}
