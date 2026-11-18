// The header's search at desktop widths (CanopyHeader.jsx, `setupDesktopSearch`): a button
// that opens into its field, after WAI-ARIA APG's disclosure. It says whether it is open
// (`aria-expanded`) and what it opens (`aria-controls`); opening it puts focus in the
// field (2.4.3); Escape closes it and gives focus back to the button; leaving the field
// empty closes it; the shortcut opens it with focus in the field. On the search page the
// field is the page's own and shows, with no button. Checked by keyboard on each site's
// home and search pages.

import { expect, test } from '@playwright/test';
import { openPage } from '../lib/findings.mjs';
import { hasPage } from '../lib/sites.mjs';

test.use({ viewport: { width: 1280, height: 900 } });

const HOMES = ['/', '/es/'];
const SEARCH_PAGES = ['/search/', '/es/buscar/'];

const inSearch = (page) =>
  page.evaluate(() => Boolean(document.activeElement.closest('[data-canopy-header-search]')));

for (const home of HOMES) {
  test(`header search on ${home}: a button that opens into its field`, async ({ page }, testInfo) => {
    test.skip(!hasPage(testInfo.project.name, home), 'Not a page of this site');
    await openPage(page, home);
    const toggle = page.locator('.canopy-header__search-toggle');
    const field = page.locator('.canopy-header [data-canopy-search-form-input]');
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    const controls = await toggle.getAttribute('aria-controls');
    expect(await page.locator(`#${controls}`).count()).toBe(1);
    await expect(field).toBeHidden();

    // Opened from the keyboard, focus goes into the field.
    await toggle.focus();
    await page.keyboard.press('Enter');
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(field).toBeFocused();

    // Escape closes it and gives focus back to the button.
    await page.keyboard.press('Escape');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(toggle).toBeFocused();
    await expect(field).toBeHidden();

    // Opened again and left empty by Tab, past its own submit: it closes behind focus.
    await page.keyboard.press('Enter');
    await expect(field).toBeFocused();
    for (let i = 0; i < 4 && (await inSearch(page)); i += 1) await page.keyboard.press('Tab');
    expect(await inSearch(page)).toBe(false);
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');

    // The shortcut opens it, focus in the field.
    await page.keyboard.press('Control+k');
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(field).toBeFocused();
  });
}

for (const searchPage of SEARCH_PAGES) {
  test(`header search on ${searchPage}: the page's own field, with no button`, async ({ page }, testInfo) => {
    test.skip(!hasPage(testInfo.project.name, searchPage), 'Not a page of this site');
    await openPage(page, searchPage);
    expect(await page.locator('.canopy-header__search-toggle').count()).toBe(0);
    await expect(page.locator('.canopy-header [data-canopy-search-form-input]')).toBeVisible();
  });
}
