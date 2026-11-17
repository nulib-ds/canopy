// Reflow at 320 CSS px (WCAG 1.4.10): the page must not scroll sideways. Content that
// needs two dimensions to be used (a viewer, a map, a table, code) is exempt, so the
// elements listed are the outermost ones past the edge outside such content.

import { test } from '@playwright/test';
import { openPage, report } from '../lib/findings.mjs';
import { KEYBOARD_PAGES, hasKeyboardPage } from '../lib/sites.mjs';

test.use({ viewport: { width: 320, height: 640 } });

function measureOverflow() {
  const width = document.documentElement.clientWidth;
  window.scrollTo(10_000, window.scrollY);
  const scrolls = window.scrollX > 0;
  window.scrollTo(0, window.scrollY);
  if (!scrolls) return [];
  const exempt = [
    '[data-canopy-viewer]',
    '[data-canopy-image]',
    '[data-canopy-scroll]',
    '[data-canopy-slider]',
    '.leaflet-container',
    'pre',
    'table',
    'canvas',
    'video',
    'iframe',
    '[role="application"]',
  ].join(',');
  const describe = (node) => {
    const id = node.id ? `#${node.id}` : '';
    const classes =
      typeof node.className === 'string' && node.className.trim()
        ? `.${node.className.trim().split(/\s+/).slice(0, 3).join('.')}`
        : '';
    return `${node.tagName.toLowerCase()}${id}${classes}`;
  };
  // Past the edge but inside something that clips or scrolls it (a carousel's track)
  // is not what makes the page scroll.
  const clipped = (element) => {
    for (
      let node = element.parentElement;
      node && node !== document.body;
      node = node.parentElement
    ) {
      if (getComputedStyle(node).overflowX !== 'visible') return true;
    }
    return false;
  };
  const offenders = [];
  for (const element of document.body.querySelectorAll('*')) {
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 || rect.right <= width + 1) continue;
    if (element.closest(exempt) || clipped(element)) continue;
    if (offenders.some((offender) => offender.element.contains(element))) continue;
    offenders.push({ element, target: describe(element), html: element.outerHTML.slice(0, 200) });
    if (offenders.length >= 12) break;
  }
  return offenders.map(({ target, html }) => ({ target, html, summary: '' }));
}

for (const pagePath of KEYBOARD_PAGES) {
  test(`reflow 320px: ${pagePath}`, async ({ page }, testInfo) => {
    test.skip(!hasKeyboardPage(testInfo.project.name, pagePath), 'Not a page of this site');
    await openPage(page, pagePath);
    const nodes = await page.evaluate(measureOverflow);
    report(
      testInfo,
      'reflow',
      pagePath,
      nodes.length
        ? [
            {
              rule: 'reflow-320',
              help: 'The page scrolls sideways at 320 CSS px (WCAG 1.4.10)',
              nodes,
            },
          ]
        : [],
    );
  });
}
