import React from 'react';
import CanopyBrand from './CanopyBrand.jsx';
import {useLocale} from "../locale/index.js";

export default function CanopyModal(props = {}) {
  const {
    id,
    variant,
    open = false,
    labelledBy,
    label,
    logo: Logo,
    href = '/',
    closeLabel,
    closeDataAttr,
    onClose,
    onBackgroundClick,
    bodyClassName,
    padded = true,
    className,
    ariaLabel,
    children,
  } = props;

  const rootClassName = ['canopy-modal', variant ? `canopy-modal--${variant}` : null, className]
    .filter(Boolean)
    .join(' ');

  const modalProps = {
    id,
    className: rootClassName,
    role: 'dialog',
    'aria-modal': 'true',
    'aria-hidden': open ? 'false' : 'true',
    'data-open': open ? 'true' : 'false',
  };

  if (variant) modalProps['data-canopy-modal'] = variant;

  // `ariaLabel` names the dialog for what it is ("Filters"), where the brand at its top,
  // the site's title, would not; without it the brand names the dialog.
  const resolvedLabelId = labelledBy || (label ? `${variant || 'modal'}-label` : undefined);
  if (typeof ariaLabel === 'string' && ariaLabel.trim()) modalProps['aria-label'] = ariaLabel.trim();
  else if (resolvedLabelId) modalProps['aria-labelledby'] = resolvedLabelId;

  if (typeof onBackgroundClick === 'function') {
    modalProps.onClick = (event) => {
      if (event.target === event.currentTarget) onBackgroundClick(event);
    };
  }

  const {getString} = useLocale();
  const resolvedCloseLabel = closeLabel || getString('common.actions.close', 'Close');

  const closeButtonProps = {
    type: 'button',
    className: 'canopy-modal__close',
    'aria-label': resolvedCloseLabel,
  };

  if (typeof closeDataAttr === 'string' && closeDataAttr) {
    closeButtonProps['data-canopy-header-close'] = closeDataAttr;
  }

  if (typeof onClose === 'function') {
    closeButtonProps.onClick = onClose;
  }

  const bodyClasses = ['canopy-modal__body'];
  if (padded) bodyClasses.push('canopy-modal__body--padded');
  if (bodyClassName) bodyClasses.push(bodyClassName);
  const bodyClassNameValue = bodyClasses.join(' ');

  return (
    <div {...modalProps}>
      <div className="canopy-modal__panel">
        <button {...closeButtonProps}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="canopy-modal__close-icon"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M6 18L18 6" />
          </svg>
          <span className="sr-only">{resolvedCloseLabel}</span>
        </button>
        <div className={bodyClassNameValue}>
          {label ? (
            <div className="canopy-modal__brand">
              <CanopyBrand
                labelId={resolvedLabelId}
                label={label}
                href={href}
                Logo={Logo}
                className="canopy-modal__brand-link"
              />
            </div>
          ) : null}
          {children}
        </div>
      </div>
    </div>
  );
}
