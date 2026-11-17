// `theme.appearance: auto` (canopy.yml): the page follows the visitor's system from the
// first paint, and the footer's switch (`AppearanceToggle`) is a labeled control that
// changes the appearance and keeps the choice. Runs on sites built `auto` only, whose
// project emulates a dark system (playwright.config.mjs).

import { expect, test } from '@playwright/test';
import { SITES } from '../lib/sites.mjs';

const AUTO = new Set(SITES.filter((site) => site.appearance === 'auto').map((site) => site.name));

const scheme = (page) =>
  page.evaluate(() => getComputedStyle(document.documentElement).colorScheme);
const classes = (page) => page.evaluate(() => document.documentElement.className);

test.beforeEach(({}, testInfo) => {
  test.skip(!AUTO.has(testInfo.project.name), 'Not a site built with appearance: auto');
});

test('appearance: follows a dark system from the first paint', async ({ page }) => {
  await page.goto('/');
  // The appearance script is inline and ahead of the stylesheet, so the class is set
  // before anything is drawn: never light first.
  const order = await page.evaluate(() => {
    const nodes = [...document.head.children];
    const script = nodes.findIndex(
      (node) =>
        node.tagName === 'SCRIPT' && !node.src && node.textContent.includes('canopy-appearance:'),
    );
    const sheet = nodes.findIndex((node) => node.matches('link[rel="stylesheet"]'));
    return { script, sheet };
  });
  expect(order.script).toBeGreaterThan(-1);
  expect(order.script).toBeLessThan(order.sheet);
  expect(await classes(page)).toContain('dark');
  expect(await scheme(page)).toBe('dark');
});

test('appearance: the switch is labeled, starts at System, and keeps a choice', async ({
  page,
}) => {
  await page.goto('/');
  const select = page.getByRole('combobox', { name: 'Appearance' });
  await expect(select).toBeVisible();
  await expect(select).toHaveValue('system');
  await expect(select.locator('option')).toHaveText(['System', 'Light', 'Dark']);

  await select.selectOption('light');
  expect(await classes(page)).toContain('light');
  expect(await scheme(page)).toBe('light');

  // Kept across pages: the next page opens light, under the same dark system.
  await page.reload();
  await expect(page.getByRole('combobox', { name: 'Appearance' })).toHaveValue('light');
  expect(await scheme(page)).toBe('light');

  // Back to System: the system's dark again.
  await page.getByRole('combobox', { name: 'Appearance' }).selectOption('system');
  expect(await scheme(page)).toBe('dark');
  await page.reload();
  await expect(page.getByRole('combobox', { name: 'Appearance' })).toHaveValue('system');
});

test('appearance: without a script the page follows the system, the switch hidden', async ({
  browser,
}, testInfo) => {
  const context = await browser.newContext({
    baseURL: testInfo.project.use.baseURL,
    colorScheme: 'dark',
    javaScriptEnabled: false,
  });
  try {
    const page = await context.newPage();
    await page.goto('/');
    await expect(page.locator('html')).toHaveCSS('color-scheme', 'dark');
    // It would do nothing, so it is not offered.
    await expect(page.locator('[data-canopy-appearance]')).toBeHidden();
  } finally {
    await context.close();
  }
});
