// A keyboard walk: Tab through each page and check every stop.
//   keyboard-focus-not-visible  nothing on screen changes when it takes focus (2.4.7)
//   keyboard-focus-obscured     something else covers it entirely (2.4.11)
//   keyboard-focus-offscreen    it takes focus while out of sight or zero-sized (2.4.7)
//   keyboard-trap               Tab stops moving (2.1.2)

import { test } from '@playwright/test';
import { openPage, report, settleMotion } from '../lib/findings.mjs';
import { KEYBOARD_PAGES, hasKeyboardPage } from '../lib/sites.mjs';

const MAX_STOPS = Number(process.env.CANOPY_A11Y_TAB_STOPS || 60);

const HELP = {
  'keyboard-focus-not-visible':
    'Nothing on screen changes when this element takes keyboard focus (WCAG 2.4.7)',
  'keyboard-focus-obscured':
    'Other content covers this element entirely while it has focus (WCAG 2.4.11)',
  'keyboard-focus-offscreen':
    'This element takes focus while it is out of sight or has no size (WCAG 2.4.7)',
  'keyboard-trap': 'Tab stops moving focus forward (WCAG 2.1.2)',
};

// The focused element: a short selector, its box, and whether it can be seen.
function readFocus() {
  const element = document.activeElement;
  if (!element || element === document.body || element === document.documentElement) return null;
  const describe = (node) => {
    const id = node.id ? `#${node.id}` : '';
    const classes =
      typeof node.className === 'string' && node.className.trim()
        ? `.${node.className.trim().split(/\s+/).slice(0, 3).join('.')}`
        : '';
    const name = node.getAttribute('aria-label');
    return `${node.tagName.toLowerCase()}${id}${classes}${name ? `[aria-label="${name}"]` : ''}`;
  };
  const rect = element.getBoundingClientRect();
  const style = getComputedStyle(element);
  const offscreen =
    rect.width < 1 ||
    rect.height < 1 ||
    rect.bottom <= 0 ||
    rect.right <= 0 ||
    rect.top >= innerHeight ||
    rect.left >= innerWidth ||
    style.visibility === 'hidden' ||
    Number(style.opacity) === 0;
  let sampled = 0;
  let covered = 0;
  const coveredBy = new Set();
  for (const [fx, fy] of [
    [0.5, 0.5],
    [0.15, 0.2],
    [0.85, 0.2],
    [0.15, 0.8],
    [0.85, 0.8],
  ]) {
    const x = rect.left + rect.width * fx;
    const y = rect.top + rect.height * fy;
    if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) continue;
    sampled += 1;
    const top = document.elementFromPoint(x, y);
    if (top && top !== element && !element.contains(top) && !top.contains(element)) {
      covered += 1;
      coveredBy.add(describe(top));
    }
  }
  return {
    target: describe(element),
    // Its place in the document: two elements alike, such as code blocks one after
    // another, can come to rest at the same spot in the window as each takes focus.
    order: Array.prototype.indexOf.call(document.getElementsByTagName('*'), element),
    html: element.outerHTML.slice(0, 300),
    rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
    offscreen,
    obscured: sampled > 0 && covered === sampled,
    coveredBy: [...coveredBy],
  };
}

function clipFor(rect, viewport) {
  const x = Math.max(0, Math.floor(rect.x - 6));
  const y = Math.max(0, Math.floor(rect.y - 6));
  const width = Math.min(viewport.width - x, Math.ceil(rect.width + 12));
  const height = Math.min(viewport.height - y, Math.ceil(rect.height + 12));
  return width > 0 && height > 0 ? { x, y, width, height } : null;
}

for (const pagePath of KEYBOARD_PAGES) {
  test(`keyboard: ${pagePath}`, async ({ page }, testInfo) => {
    test.skip(!hasKeyboardPage(testInfo.project.name, pagePath), 'Not a page of this site');
    await openPage(page, pagePath);
    await settleMotion(page);
    await page.mouse.move(0, 0);
    const viewport = page.viewportSize();
    const found = Object.fromEntries(Object.keys(HELP).map((rule) => [rule, []]));
    const visited = new Set();
    let previous = '';
    let repeats = 0;

    for (let stop = 0; stop < MAX_STOPS; stop += 1) {
      await page.keyboard.press('Tab');
      const focus = await page.evaluate(readFocus);
      if (!focus) break;
      const key = `${focus.target} #${focus.order}`;
      if (key === previous) {
        repeats += 1;
        if (repeats >= 2) {
          found['keyboard-trap'].push({ target: focus.target, html: focus.html, summary: '' });
          break;
        }
        continue;
      }
      repeats = 0;
      previous = key;
      if (visited.has(key)) break; // Back at the start.
      visited.add(key);

      const node = { target: focus.target, html: focus.html, summary: '' };
      if (focus.offscreen) {
        found['keyboard-focus-offscreen'].push(node);
        continue;
      }
      if (focus.obscured) {
        found['keyboard-focus-obscured'].push({
          ...node,
          summary: `Covered by ${focus.coveredBy.join(', ')}`,
        });
      }
      const clip = clipFor(focus.rect, viewport);
      if (!clip) continue;
      // Compare the element's surroundings focused and not: some change must show.
      const handle = await page.evaluateHandle(() => document.activeElement);
      const focused = await page.screenshot({ clip });
      await handle.evaluate((element) => element.blur());
      const blurred = await page.screenshot({ clip });
      await handle.evaluate((element) =>
        element.focus({ focusVisible: true, preventScroll: true }),
      );
      await handle.dispose();
      if (focused.equals(blurred)) found['keyboard-focus-not-visible'].push(node);
    }

    report(
      testInfo,
      'keyboard',
      pagePath,
      Object.entries(found)
        .filter(([, nodes]) => nodes.length)
        .map(([rule, nodes]) => ({ rule, help: HELP[rule], nodes })),
    );
  });
}
