// The header's compact dialogs (search and navigation, `aria-modal`): opening one by
// keyboard moves focus into it, Tab and Shift+Tab stay inside while it is open, and
// Escape closes it and returns focus to the button that opened it (WCAG 2.4.3,
// ACCESSIBILITY.md C28). Checked below the header's desktop breakpoint, where the
// dialogs replace the header's inline search and links.

import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 800, height: 900 } });

// Each is named for what it is, in the words of its own open and close buttons (2.4.6).
const NAMES = { search: 'Search', nav: 'Primary navigation' };

const focusInside = (page, type) =>
  page.evaluate((name) => {
    const modal = document.querySelector(`[data-canopy-modal="${name}"]`);
    return Boolean(modal && modal.contains(document.activeElement));
  }, type);

for (const type of ['search', 'nav']) {
  test(`dialogs: the header's ${type} dialog takes focus, keeps it and gives it back`, async ({
    page,
  }) => {
    await page.goto('/');
    const toggle = page.locator(`.canopy-header [data-canopy-header-toggle="${type}"]`).first();
    test.skip(!(await toggle.isVisible()), 'No compact header toggle on this site');

    await toggle.focus();
    await page.keyboard.press('Enter');
    await expect.poll(() => focusInside(page, type)).toBe(true);
    await expect(page.locator(`[data-canopy-modal="${type}"]`)).toHaveAttribute('aria-label', NAMES[type]);

    for (const key of [
      'Tab',
      'Tab',
      'Tab',
      'Tab',
      'Tab',
      'Tab',
      'Tab',
      'Tab',
      'Shift+Tab',
      'Shift+Tab',
    ]) {
      await page.keyboard.press(key);
      expect([key, await focusInside(page, type)]).toEqual([key, true]);
    }

    await page.keyboard.press('Escape');
    await expect(toggle).toBeFocused();
  });
}
