// axe-core against every WCAG 2.0, 2.1 and 2.2 rule at Level A and AA, on every page.
// axe catches a part of what WCAG asks; the other specs and a person do the rest.

import { test } from '@playwright/test';
import { runAxe } from '../lib/axe.mjs';
import { openPage, report } from '../lib/findings.mjs';
import { PAGES, hasPage } from '../lib/sites.mjs';

for (const pagePath of PAGES) {
  test(`axe: ${pagePath}`, async ({ page }, testInfo) => {
    test.skip(!hasPage(testInfo.project.name, pagePath), 'Not a page of this site');
    await openPage(page, pagePath);
    report(testInfo, 'axe', pagePath, await runAxe(page));
  });
}
