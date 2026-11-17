// Forced colors (Windows High Contrast, `forced-colors: active`): the browser draws every
// color in the system's few, and drops shadows. A focus ring drawn as a shadow is gone; one
// drawn as an outline stays (`settings/_focus.scss`, DESIGN.md §1, "Focus"). A keyboard
// walk, as `keyboard.spec.mjs` takes, on the default and Northwestern templates in light:
// each stop must look different focused and not (2.4.7).
//   forced-colors-focus-not-visible  focus shows no change under forced colors

import { test } from '@playwright/test';
import { openPage, report, settleMotion } from '../lib/findings.mjs';
import { KEYBOARD_PAGES, hasKeyboardPage } from '../lib/sites.mjs';

const MAX_STOPS = Number(process.env.CANOPY_A11Y_TAB_STOPS || 60);
const PROJECTS = new Set(['template-light', 'northwestern-light', 'site']);

function readFocus() {
  const element = document.activeElement;
  if (!element || element === document.body || element === document.documentElement) return null;
  const rect = element.getBoundingClientRect();
  const id = element.id ? `#${element.id}` : '';
  const classes =
    typeof element.className === 'string' && element.className.trim()
      ? `.${element.className.trim().split(/\s+/).slice(0, 3).join('.')}`
      : '';
  const name = element.getAttribute('aria-label');
  return {
    target: `${element.tagName.toLowerCase()}${id}${classes}${name ? `[aria-label="${name}"]` : ''}`,
    order: Array.prototype.indexOf.call(document.getElementsByTagName('*'), element),
    html: element.outerHTML.slice(0, 300),
    rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
    hidden: rect.width < 1 || rect.height < 1 || rect.bottom <= 0 || rect.top >= innerHeight,
  };
}

for (const pagePath of KEYBOARD_PAGES) {
  test(`forced colors: ${pagePath}`, async ({ page }, testInfo) => {
    const project = testInfo.project.name;
    test.skip(!PROJECTS.has(project), 'Checked on the light templates');
    test.skip(!hasKeyboardPage(project, pagePath), 'Not a page of this site');
    await page.emulateMedia({ forcedColors: 'active' });
    await openPage(page, pagePath);
    await settleMotion(page);
    await page.mouse.move(0, 0);
    const viewport = page.viewportSize();
    const missing = [];
    const visited = new Set();

    for (let stop = 0; stop < MAX_STOPS; stop += 1) {
      await page.keyboard.press('Tab');
      const focus = await page.evaluate(readFocus);
      if (!focus) break;
      const key = `${focus.target} #${focus.order}`;
      if (visited.has(key)) break;
      visited.add(key);
      if (focus.hidden) continue;
      const x = Math.max(0, Math.floor(focus.rect.x - 6));
      const y = Math.max(0, Math.floor(focus.rect.y - 6));
      const width = Math.min(viewport.width - x, Math.ceil(focus.rect.width + 12));
      const height = Math.min(viewport.height - y, Math.ceil(focus.rect.height + 12));
      if (width <= 0 || height <= 0) continue;
      const clip = { x, y, width, height };
      const handle = await page.evaluateHandle(() => document.activeElement);
      const focused = await page.screenshot({ clip });
      await handle.evaluate((element) => element.blur());
      const blurred = await page.screenshot({ clip });
      await handle.evaluate((element) =>
        element.focus({ focusVisible: true, preventScroll: true }),
      );
      await handle.dispose();
      if (focused.equals(blurred)) {
        missing.push({ target: focus.target, html: focus.html, summary: '' });
      }
    }

    report(
      testInfo,
      'forced-colors',
      pagePath,
      missing.length
        ? [
            {
              rule: 'forced-colors-focus-not-visible',
              help: 'Focus shows no change under forced colors (WCAG 2.4.7)',
              nodes: missing,
            },
          ]
        : [],
    );
  });
}
