// The hero carousel (`<Interstitials.Hero />`, lib/components/hero-slider-runtime.js),
// after WAI-ARIA APG's carousel: nothing in it moves on its own, so it has nothing to
// pause (WCAG 2.2.2, packages/app/DESIGN.md §0); it moves by its buttons, from the
// keyboard too, and announces the slide a visitor moves to; it keeps hidden slides out
// of reach; and it reads every word from the page's locale (3.1.2, ACCESSIBILITY.md C1
// and C3). Checked on each site's home page, on a page clock.

import { expect, test } from '@playwright/test';
import { openPage } from '../lib/findings.mjs';

// Far longer than the six seconds the hero rotated by until 2.0.2.
const WAIT_MS = 30000;
const HOMES = ['/', '/es/'];

async function openPaused(page, pagePath) {
  await page.clock.install();
  await openPage(page, pagePath);
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  await page.mouse.move(0, 0);
  const carousel = page.locator('[data-canopy-hero-carousel]').first();
  return (await carousel.count()) ? carousel : null;
}

const shownIn = (carousel) =>
  carousel.evaluate((el) =>
    [...el.querySelectorAll('.canopy-interstitial__slide')].findIndex((slide) => !slide.hidden),
  );

for (const home of HOMES) {
  test.describe(`carousel on ${home}`, () => {
    test('never moves on its own, and has nothing to pause', async ({ page }) => {
      const carousel = await openPaused(page, home);
      test.skip(!carousel, 'No carousel on this page');
      const start = await shownIn(carousel);
      await page.clock.runFor(WAIT_MS);
      expect(await shownIn(carousel)).toBe(start);
      await expect(carousel.locator('.canopy-interstitial__rotation')).toHaveCount(0);
      await expect(carousel.locator('.canopy-interstitial__slide-wrapper')).toHaveAttribute(
        'aria-live',
        'polite',
      );
    });

    test('moves by its buttons, and stays where a visitor leaves it', async ({ page }) => {
      const carousel = await openPaused(page, home);
      test.skip(!carousel, 'No carousel on this page');
      const total = await carousel.locator('.canopy-interstitial__slide').count();
      const start = await shownIn(carousel);
      await carousel.locator('.canopy-interstitial__nav-btn--next').click();
      expect(await shownIn(carousel)).toBe((start + 1) % total);
      await carousel.locator('.canopy-interstitial__nav-btn--prev').click();
      expect(await shownIn(carousel)).toBe(start);
      const last = carousel.locator('.canopy-interstitial__dot').nth(total - 1);
      await last.click();
      expect(await shownIn(carousel)).toBe(total - 1);
      await expect(last).toHaveAttribute('aria-current', 'true');
      await page.clock.runFor(WAIT_MS);
      expect(await shownIn(carousel)).toBe(total - 1);
    });

    test('moves from the keyboard', async ({ page }) => {
      const carousel = await openPaused(page, home);
      test.skip(!carousel, 'No carousel on this page');
      const total = await carousel.locator('.canopy-interstitial__slide').count();
      const start = await shownIn(carousel);
      const next = carousel.locator('.canopy-interstitial__nav-btn--next');
      await next.focus();
      await page.keyboard.press('Enter');
      expect(await shownIn(carousel)).toBe((start + 1) % total);
      await page.keyboard.press('Space');
      expect(await shownIn(carousel)).toBe((start + 2) % total);
      await expect(next).toBeFocused();
    });

    test('keeps the slides it does not show out of the tab order', async ({ page }) => {
      const carousel = await openPaused(page, home);
      test.skip(!carousel, 'No carousel on this page');
      const reachable = await carousel.evaluate(
        (el) =>
          [...el.querySelectorAll('.canopy-interstitial__slide a[href]')].filter(
            (link) => link.getClientRects().length > 0,
          ).length,
      );
      expect(reachable).toBe(1);
    });

    test("reads its words from the page's locale", async ({ page }) => {
      const carousel = await openPaused(page, home);
      test.skip(!carousel, 'No carousel on this page');
      const lang = await page.evaluate(() => document.documentElement.lang);
      const words = await carousel.evaluate((el) => ({
        region: el.getAttribute('aria-roledescription'),
        previous: el.querySelector('.canopy-interstitial__nav-btn--prev').getAttribute('aria-label'),
        next: el.querySelector('.canopy-interstitial__nav-btn--next').getAttribute('aria-label'),
        slide: el.querySelector('.canopy-interstitial__slide').getAttribute('aria-label'),
      }));
      if (lang.startsWith('es')) {
        expect(words).toEqual({
          region: 'carrusel',
          previous: 'Diapositiva anterior',
          next: 'Diapositiva siguiente',
          slide: expect.stringMatching(/^1 de \d+$/),
        });
      } else {
        expect(words).toEqual({
          region: 'carousel',
          previous: 'Previous slide',
          next: 'Next slide',
          slide: expect.stringMatching(/^1 of \d+$/),
        });
      }
    });
  });
}
