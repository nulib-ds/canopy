// Motion (WCAG 2.2.2): content that advances by itself can be paused by the first control
// in its reading order, and does not announce itself as it moves. Checked by what a
// carousel does, on a page clock run forward, so it holds in any language.
//   motion-carousel-pause      a carousel that advances by itself, whose first control in
//                              reading order is not a button that stops it
//   motion-carousel-announced  a carousel that announces its own rotation (a live region
//                              in it changes as it advances)

import { test } from '@playwright/test';
import { openPage, report } from '../lib/findings.mjs';
import { KEYBOARD_PAGES, hasKeyboardPage } from '../lib/sites.mjs';

const ROTATE_MS = 6000;
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

for (const pagePath of KEYBOARD_PAGES) {
  test(`motion: ${pagePath}`, async ({ page }, testInfo) => {
    test.skip(!hasKeyboardPage(testInfo.project.name, pagePath), 'Not a page of this site');
    // The page's clock runs while it opens (openPage waits on its timers), then stops,
    // and moves only as far as each check runs it.
    await page.clock.install();
    await openPage(page, pagePath);
    await page.clock.pauseAt(new Date(Date.now() + 1000));
    await page.mouse.move(0, 0);

    const pause = [];
    const announced = [];
    const hosts = await page.locator('[data-canopy-hero-slider]').all();
    for (const host of hosts) {
      const facts = await host.evaluate((el) => ({
        slides: el.querySelectorAll('.canopy-interstitial__slide').length,
        target: `section[data-canopy-hero-slider]${el.id ? `#${el.id}` : ''}`,
        html: el.outerHTML.slice(0, 200),
      }));
      if (facts.slides < 2) continue;
      const shown = () =>
        host.evaluate((el) =>
          [...el.querySelectorAll('.canopy-interstitial__slide')].findIndex(
            (slide) => slide.getClientRects().length > 0 && !slide.hidden,
          ),
        );
      const spoken = () =>
        host.evaluate((el) =>
          [
            ...el.querySelectorAll(
              '[aria-live]:not([aria-live="off"]), [role="status"], [role="alert"], [role="log"]',
            ),
          ]
            .map((node) => node.textContent.trim())
            .join('|'),
        );

      const before = await shown();
      const said = await spoken();
      await page.clock.runFor(ROTATE_MS + 500);
      if ((await shown()) === before) continue; // It does not move by itself.
      const node = { target: facts.target, html: facts.html };
      if ((await spoken()) !== said) {
        announced.push({ ...node, summary: 'its rotation is announced to screen readers' });
      }

      // The carousel's own first control: the hero around it has links of its own.
      const region = host.locator(
        '[data-canopy-hero-carousel], [aria-roledescription][role="region"]',
      );
      const scope = (await region.count()) ? region.first() : host;
      const first = scope.locator(FOCUSABLE).first();
      const isButton = await first.evaluate((el) => el.tagName === 'BUTTON').catch(() => false);
      if (!isButton) {
        pause.push({
          ...node,
          summary: 'its slides advance by themselves; no control first in it pauses them',
        });
        continue;
      }
      await first.click();
      await page.mouse.move(0, 0);
      const stoppedAt = await shown();
      await page.clock.runFor(ROTATE_MS * 2 + 500);
      if ((await shown()) !== stoppedAt) {
        pause.push({ ...node, summary: 'its first control does not stop its slides advancing' });
      }
    }

    report(testInfo, 'motion', pagePath, [
      ...(pause.length
        ? [
            {
              rule: 'motion-carousel-pause',
              help: 'A carousel advances by itself with no pause control first (WCAG 2.2.2)',
              nodes: pause,
            },
          ]
        : []),
      ...(announced.length
        ? [
            {
              rule: 'motion-carousel-announced',
              help: 'A carousel announces its own rotation (WCAG 2.2.2, APG carousel)',
              nodes: announced,
            },
          ]
        : []),
    ]);
  });
}
