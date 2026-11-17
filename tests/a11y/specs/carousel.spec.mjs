// The hero carousel (`<Interstitials.Hero />`, lib/components/hero-slider-runtime.js),
// after WAI-ARIA APG's auto-rotating carousel (WCAG 2.2.2, packages/app/DESIGN.md §0):
// it holds while pointed at, stops for good on keyboard focus or any control, never
// starts under reduced motion, keeps hidden slides out of reach, announces only a
// visitor's own move, and reads every word from the page's locale (3.1.2,
// ACCESSIBILITY.md C1 and C3). Checked on each site's home page, on a page clock.

import { expect, test } from '@playwright/test';
import { openPage } from '../lib/findings.mjs';

const ROTATE_MS = 6000;
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
    test('holds while pointed at, and goes on once the pointer leaves', async ({ page }) => {
      const carousel = await openPaused(page, home);
      test.skip(!carousel, 'No carousel on this page');
      const start = await shownIn(carousel);
      await carousel.hover();
      await page.clock.runFor(ROTATE_MS * 2);
      expect(await shownIn(carousel)).toBe(start);
      await page.mouse.move(0, 0);
      await page.clock.runFor(ROTATE_MS + 500);
      expect(await shownIn(carousel)).not.toBe(start);
    });

    test('stops for good when keyboard focus enters, its pause control first', async ({ page }) => {
      const carousel = await openPaused(page, home);
      test.skip(!carousel, 'No carousel on this page');
      const rotation = carousel.locator('.canopy-interstitial__rotation');
      // Focus the control before the carousel, then Tab in.
      await page.evaluate(() => {
        const region = document.querySelector('[data-canopy-hero-carousel]');
        const all = [...document.querySelectorAll('a[href], button:not([disabled])')].filter(
          (el) => el.getClientRects().length > 0,
        );
        const before = all.filter(
          (el) => region.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_PRECEDING,
        );
        before[before.length - 1].focus();
      });
      await page.keyboard.press('Tab');
      await expect(rotation).toBeFocused();
      const start = await shownIn(carousel);
      await page.clock.runFor(ROTATE_MS * 2 + 500);
      expect(await shownIn(carousel)).toBe(start);
      // Its control now offers to start it again, in the page's words.
      await expect(rotation).toHaveAttribute(
        'aria-label',
        (await rotation.getAttribute('data-label-start')) || 'missing',
      );
      await expect(carousel.locator('.canopy-interstitial__slide-wrapper')).toHaveAttribute(
        'aria-live',
        'polite',
      );
      // Started again from its control, it rotates, its slides silent again.
      await page.keyboard.press('Enter');
      await expect(carousel.locator('.canopy-interstitial__slide-wrapper')).toHaveAttribute(
        'aria-live',
        'off',
      );
      await page.clock.runFor(ROTATE_MS + 500);
      expect(await shownIn(carousel)).not.toBe(start);
    });

    test('moves by its buttons, announced, and they stop it', async ({ page }) => {
      const carousel = await openPaused(page, home);
      test.skip(!carousel, 'No carousel on this page');
      const total = await carousel.locator('.canopy-interstitial__slide').count();
      const start = await shownIn(carousel);
      await carousel.locator('.canopy-interstitial__nav-btn--next').click();
      await page.mouse.move(0, 0);
      expect(await shownIn(carousel)).toBe((start + 1) % total);
      await expect(carousel.locator('.canopy-interstitial__slide-wrapper')).toHaveAttribute(
        'aria-live',
        'polite',
      );
      await carousel.locator('.canopy-interstitial__nav-btn--prev').click();
      expect(await shownIn(carousel)).toBe(start);
      const last = carousel.locator('.canopy-interstitial__dot').nth(total - 1);
      await last.click();
      await page.mouse.move(0, 0);
      expect(await shownIn(carousel)).toBe(total - 1);
      await expect(last).toHaveAttribute('aria-current', 'true');
      await page.clock.runFor(ROTATE_MS * 2 + 500);
      expect(await shownIn(carousel)).toBe(total - 1);
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
        stop: el.querySelector('.canopy-interstitial__rotation').getAttribute('data-label-stop'),
        next: el.querySelector('.canopy-interstitial__nav-btn--next').getAttribute('aria-label'),
        slide: el.querySelector('.canopy-interstitial__slide').getAttribute('aria-label'),
      }));
      if (lang.startsWith('es')) {
        expect(words).toEqual({
          region: 'carrusel',
          stop: 'Pausar la presentación',
          next: 'Diapositiva siguiente',
          slide: expect.stringMatching(/^1 de \d+$/),
        });
      } else {
        expect(words).toEqual({
          region: 'carousel',
          stop: 'Pause the slideshow',
          next: 'Next slide',
          slide: expect.stringMatching(/^1 of \d+$/),
        });
      }
    });
  });
}

test.describe('carousel under reduced motion', () => {
  test('never starts, and offers to', async ({ page }) => {
    // Playwright 1.56 takes `reducedMotion` as a context option, not a test one.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const carousel = await openPaused(page, '/');
    test.skip(!carousel, 'No carousel on this page');
    const start = await shownIn(carousel);
    await page.clock.runFor(ROTATE_MS * 3);
    expect(await shownIn(carousel)).toBe(start);
    const rotation = carousel.locator('.canopy-interstitial__rotation');
    await expect(rotation).toHaveAttribute('data-rotation', 'off');
    await expect(rotation).toHaveAttribute(
      'aria-label',
      (await rotation.getAttribute('data-label-start')) || 'missing',
    );
  });
});
