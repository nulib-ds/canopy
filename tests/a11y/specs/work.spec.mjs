// A work page's viewer toggle (`lib/components/viewer-runtime-entry.js`, `_work.scss`):
// from 961px, where the viewer and the work's words sit side by side, a toggle button
// (`aria-pressed`) named in the page's words spreads the viewer across the column and
// stacks the words under it, and back, by keyboard. Under a wide viewer the metadata runs
// in columns, each label at the top of its row with its value under it. Checked on each
// site's work pages.

import { expect, test } from '@playwright/test';
import { openPage } from '../lib/findings.mjs';
import { PAGES, hasPage } from '../lib/sites.mjs';

test.use({ viewport: { width: 1280, height: 900 } });

const NAME = { en: 'Widen the viewer', es: 'Ampliar el visor' };
const WORKS = PAGES.filter((page) => /^\/(es\/obras|works)\/[^/]+\.html$/.test(page));

for (const work of WORKS) {
  test(`work ${work}: the viewer's toggle widens it and stacks the words under it`, async ({ page }, testInfo) => {
    test.skip(!hasPage(testInfo.project.name, work), 'Not a page of this site');
    await openPage(page, work);
    await page.evaluate(() => {
      try {
        localStorage.removeItem('canopy:work-viewer');
      } catch (_) {}
    });
    await openPage(page, work);
    const layout = page.locator('.canopy-work--layout');
    const toggle = layout.locator('.canopy-work__widen');
    test.skip(!(await toggle.count()), 'No viewer on this work page');
    const lang = (await page.evaluate(() => document.documentElement.lang || 'en')).slice(0, 2);
    await expect(toggle).toHaveAttribute('aria-label', NAME[lang] || NAME.en);
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');

    const side = () =>
      layout.evaluate((el) => {
        const primary = el.querySelector('.canopy-work--primary').getBoundingClientRect();
        const secondary = el.querySelector('.canopy-work--secondary').getBoundingClientRect();
        return secondary.top >= primary.bottom - 1 ? 'stacked' : 'beside';
      });
    expect(await side()).toBe('beside');

    await toggle.focus();
    await page.keyboard.press('Enter');
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect(toggle).toBeFocused();
    expect(await side()).toBe('stacked');

    // Each row of the metadata's columns: its labels share a top.
    const tops = await layout.evaluate((el) => {
      const rows = new Map();
      for (const item of el.querySelectorAll('.canopy-work--secondary dl.clover-metadata > div')) {
        const box = item.getBoundingClientRect();
        const key = Math.round(box.top);
        if (!rows.has(key)) rows.set(key, new Set());
        rows.get(key).add(Math.round(item.querySelector('dt').getBoundingClientRect().top));
      }
      return [...rows.values()].map((set) => set.size);
    });
    expect(tops.every((count) => count === 1)).toBe(true);
    // Three columns at most, and the attribution and id across the whole width.
    const shape = await layout.evaluate((el) => ({
      columns: getComputedStyle(el.querySelector('dl.clover-metadata')).gridTemplateColumns.split(' ').length,
      others: [...el.querySelectorAll('.canopy-work--secondary dl:not(.clover-metadata)')].map(
        (dl) => getComputedStyle(dl).display,
      ),
    }));
    expect(shape.columns).toBeLessThanOrEqual(3);
    expect(shape.others.every((display) => display !== 'grid')).toBe(true);

    await page.keyboard.press('Space');
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(await side()).toBe('beside');
  });
}
