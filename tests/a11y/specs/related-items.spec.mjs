// A facet's sliders (`<RelatedItems>`, lib/build/mdx.js `makeHeader`) and the lists an
// author writes, as a visitor sees them:
// - Each slider's value is its heading's one link, to every work with that value on the
//   search page. Its name is the value, then the page's "View all", unseen, so it says
//   where it goes (2.4.4) and starts with the words it shows (2.5.3). Clover's own "View
//   all" is gone, and no slider's item shows a list's marker.
// - A Markdown list keeps its own: bullets for `ul`, numbers for `ol` (base/_common.scss).

import { expect, test } from '@playwright/test';
import { openPage } from '../lib/findings.mjs';
import { hasPage } from '../lib/sites.mjs';

test.use({ viewport: { width: 1280, height: 900 } });

const HOMES = ['/', '/es/'];
const VIEW_ALL = { en: 'View all', es: 'Ver todo' };

for (const home of HOMES) {
  test(`related items on ${home}: each slider's value links to its works`, async ({ page }, testInfo) => {
    test.skip(!hasPage(testInfo.project.name, home), 'Not a page of this site');
    await openPage(page, home);
    const sliders = page.locator('[data-canopy-related-items] .canopy-slider[data-facet-label]');
    test.skip(!(await page.locator('[data-canopy-related-items]').count()), 'No related items on this page');
    await expect(sliders.first()).toBeAttached();
    await expect(page.locator('[data-canopy-related-items] .clover-items-item').first()).toBeAttached();
    const lang = (await page.evaluate(() => document.documentElement.lang || 'en')).slice(0, 2);

    const headers = await sliders.evaluateAll((all) =>
      all.map((slider) => {
        const links = [...slider.querySelectorAll('h2 a[href]')];
        const link = links[0];
        return {
          links: links.length,
          value: link ? link.firstChild.textContent.trim() : '',
          name: link ? link.textContent.replace(/\s+/g, ' ').trim() : '',
          href: link ? link.getAttribute('href') : '',
          listName: (slider.querySelector('.clover-items-track') || {}).getAttribute?.('aria-label') || '',
        };
      }),
    );
    expect(headers.length).toBeGreaterThan(0);
    for (const header of headers) {
      expect(header.links).toBe(1);
      expect(header.value).not.toBe('');
      expect(header.name).toBe(`${header.value}, ${VIEW_ALL[lang] || VIEW_ALL.en}`);
      expect(header.href).toMatch(/\/search\/index\.html\?[^=]+=/);
      expect(header.listName).toBe(header.value);
    }
    expect(await page.locator('.clover-items-homepage').count()).toBe(0);
    const marked = await page.evaluate(
      () =>
        [...document.querySelectorAll('.clover-items-item')].filter(
          (item) => getComputedStyle(item).listStyleType !== 'none',
        ).length,
    );
    expect(marked).toBe(0);
  });
}

test("a Markdown list keeps its markers: bullets for ul, numbers for ol", async ({ page }, testInfo) => {
  test.skip(!hasPage(testInfo.project.name, '/prose.html'), 'Not a page of this site');
  await openPage(page, '/prose.html');
  const markers = await page.evaluate(() => ({
    ul: [...document.querySelectorAll('main ul:not([class]) > li')].map((li) => getComputedStyle(li).listStyleType),
    ol: [
      ...document.querySelectorAll('main ol:not([class]):not(section[data-footnotes] ol) > li'),
    ].map((li) => getComputedStyle(li).listStyleType),
  }));
  expect(markers.ul.length).toBeGreaterThan(0);
  expect(markers.ol.length).toBeGreaterThan(0);
  expect([...new Set(markers.ul)]).toEqual(['disc']);
  expect([...new Set(markers.ol)]).toEqual(['decimal']);
});
