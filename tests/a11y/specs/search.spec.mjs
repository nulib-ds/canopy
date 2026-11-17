// Search as a visitor uses it, by keyboard, through the header's field (WCAG 2.2 AA;
// ACCESSIBILITY.md R5, C39, C40 and C41):
// - On the search page the field drives the results. The type tabs follow WAI-ARIA APG's
//   tabs pattern (one tab stop; the arrows, Home and End; the selection follows focus),
//   the results are the selected tab's panel, and what the search found is a status
//   message (4.1.3).
// - Elsewhere it suggests. Nothing of search loads until the field is used; the
//   suggestions come in groups named by type, their count is a status message, the down
//   arrow goes in and Escape comes back.
// - The works' filters are a modal dialog named for what it is: focus moves in, Tab
//   stays inside, a filter narrows the works, "Clear all" keeps focus, and Escape gives
//   focus back to the Filters button (2.4.3; C41).
// axe checks each state, in the page's language on a site with two.

import { expect, test } from '@playwright/test';
import { runAxe } from '../lib/axe.mjs';
import { openPage, report } from '../lib/findings.mjs';
import { IS_EXTERNAL, hasPage } from '../lib/sites.mjs';

test.use({ viewport: { width: 1280, height: 900 } });

const WORDS = {
  en: { works: 'Works', one: 'suggestion', many: 'suggestions', none: 'No suggestions', filters: 'Filters' },
  es: { works: 'Obras', one: 'sugerencia', many: 'sugerencias', none: 'Sin sugerencias', filters: 'Filtros' },
};
const SEARCH_PAGES = ['/search/', '/es/buscar/'];
const HOMES = ['/', '/es/'];
// The fixture's works include "A map of the coast"; a word is found by its beginning. On
// a site of your own (CANOPY_A11Y_SITE), any work found will do.
const QUERY = 'ma';
const FOUND = IS_EXTERNAL ? /\S/ : /A map of the coast/;

async function headerField(page) {
  const fields = page.locator('[data-canopy-search-form-input]');
  for (let i = 0; i < (await fields.count()); i += 1) {
    if (await fields.nth(i).isVisible()) return fields.nth(i);
  }
  return null;
}

async function wordsFor(page) {
  const lang = await page.evaluate(() => document.documentElement.lang || 'en');
  return WORDS[lang.slice(0, 2)] || WORDS.en;
}

const tabState = (page) =>
  page.evaluate(() => {
    const tabs = [...document.querySelectorAll('[role="tablist"] [role="tab"]')];
    const panel = document.getElementById('search-results');
    return {
      ids: tabs.map((tab) => tab.id),
      selected: tabs.filter((tab) => tab.getAttribute('aria-selected') === 'true').map((tab) => tab.id),
      stops: tabs.filter((tab) => tab.tabIndex === 0).map((tab) => tab.id),
      controls: [...new Set(tabs.map((tab) => tab.getAttribute('aria-controls')))],
      focused: document.activeElement ? document.activeElement.id : '',
      panelRole: panel ? panel.getAttribute('role') : null,
      labelledBy: panel ? panel.getAttribute('aria-labelledby') : null,
    };
  });

for (const pagePath of SEARCH_PAGES) {
  test(`search page ${pagePath}: the field drives the results, through tabs a keyboard can use`, async ({
    page,
  }, testInfo) => {
    test.skip(!hasPage(testInfo.project.name, pagePath), 'Not a page of this site');
    await openPage(page, pagePath);
    const field = await headerField(page);
    test.skip(!field, 'No search field shows at this width');
    expect(await page.evaluate(() => window.CanopySearchPage)).toBe(true);
    await field.click();
    await page.keyboard.type(QUERY);

    // What was found, said once typing pauses; the field's suggestions stay shut here.
    const status = page.locator('[data-canopy-search-summary] [role="status"]');
    await expect(status).toContainText(`"${QUERY}"`);
    await expect(page.locator('[data-canopy-search-form-panel]:visible')).toHaveCount(0);

    let state = await tabState(page);
    expect(state.ids.length).toBeGreaterThan(0);
    expect(state.selected).toHaveLength(1);
    expect(state.stops).toEqual(state.selected);
    expect(state.controls).toEqual(['search-results']);
    expect(state.panelRole).toBe('tabpanel');
    expect(state.labelledBy).toBe(state.selected[0]);

    // The works tab finds the work by the beginning of a word in its title.
    await page.locator('#canopy-search-tab-work').click();
    await expect(page.locator('#search-results').getByText(FOUND).first()).toBeVisible();
    report(testInfo, 'search', pagePath, await runAxe(page));

    if (state.ids.length > 1) {
      const order = state.ids;
      await page.locator('#canopy-search-tab-work').focus();
      const start = order.indexOf('canopy-search-tab-work');
      await page.keyboard.press('ArrowRight');
      state = await tabState(page);
      const next = order[(start + 1) % order.length];
      expect(state.focused).toBe(next);
      expect(state.selected).toEqual([next]);
      expect(state.stops).toEqual([next]);
      expect(state.labelledBy).toBe(next);
      await page.keyboard.press('End');
      expect((await tabState(page)).selected).toEqual([order[order.length - 1]]);
      await page.keyboard.press('Home');
      expect((await tabState(page)).selected).toEqual([order[0]]);
      await page.keyboard.press('ArrowLeft');
      expect((await tabState(page)).selected).toEqual([order[order.length - 1]]);
      // Tab leaves the tabs.
      await page.keyboard.press('Tab');
      expect(await page.evaluate(() => document.activeElement.getAttribute('role'))).not.toBe('tab');
      report(testInfo, 'search-tabs', pagePath, await runAxe(page));
    }
  });
}

for (const pagePath of HOMES) {
  test(`suggestions on ${pagePath}: loaded when used, grouped, counted, reached by the arrows`, async ({
    page,
  }, testInfo) => {
    test.skip(!hasPage(testInfo.project.name, pagePath), 'Not a page of this site');
    const fetched = [];
    page.on('request', (request) => {
      if (/\/api\/search-(index|records)\.json|canopy-search-engine\.js/.test(request.url())) {
        fetched.push(request.url());
      }
    });
    await openPage(page, pagePath);
    expect(fetched, 'Nothing of search loads before the field is used').toEqual([]);
    const field = await headerField(page);
    test.skip(!field, 'No search field shows at this width');
    const words = await wordsFor(page);
    const host = field.locator('xpath=ancestor::*[@data-canopy-search-form][1]');
    const panel = host.locator('[data-canopy-search-form-panel]');
    const status = host.locator('[data-canopy-search-form-status]');
    const items = panel.locator('[data-canopy-item]');

    await field.click();
    await page.keyboard.type(QUERY);
    await expect(panel).toBeVisible();
    await expect(
      panel.getByRole('group', { name: words.works }).getByRole('link', { name: FOUND }).first(),
    ).toBeVisible();
    const count = await items.count();
    await expect(status).toHaveText(`${count} ${count === 1 ? words.one : words.many}`);

    await page.keyboard.press('ArrowDown');
    await expect(items.first()).toBeFocused();
    report(testInfo, 'search-suggestions', pagePath, await runAxe(page));

    await page.keyboard.press('Escape');
    await expect(field).toBeFocused();
    await expect(panel).toBeHidden();
    // The arrows open them again, for the same query.
    await page.keyboard.press('ArrowDown');
    await expect(panel).toBeVisible();
    await expect(items.first()).toBeFocused();

    // Nothing found: the panel shuts, and the status says so.
    await field.fill('xyzzy');
    await expect(panel).toBeHidden();
    await expect(status).toHaveText(words.none);
  });
}

const focusInDialog = (page) =>
  page.evaluate(() => {
    const modal = document.getElementById('canopy-modal-filters');
    return Boolean(modal && modal.contains(document.activeElement));
  });

for (const pagePath of SEARCH_PAGES) {
  test(`search page ${pagePath}: the filters dialog, by keyboard`, async ({ page }, testInfo) => {
    test.skip(!hasPage(testInfo.project.name, pagePath), 'Not a page of this site');
    await openPage(page, `${pagePath}?type=work`);
    const words = await wordsFor(page);
    const button = page.locator('.canopy-search-tabs__filters-button');
    test.skip(!(await button.isVisible()), 'No filters on this site');
    const shown = () => page.locator('#search-results [href]').count();
    const before = await shown();

    await button.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: words.filters });
    await expect(dialog).toBeVisible();
    await expect.poll(() => focusInDialog(page)).toBe(true);
    for (const key of ['Tab', 'Tab', 'Tab', 'Tab', 'Tab', 'Tab', 'Shift+Tab', 'Shift+Tab', 'Shift+Tab']) {
      await page.keyboard.press(key);
      expect([key, await focusInDialog(page)]).toEqual([key, true]);
    }
    report(testInfo, 'search-filters', pagePath, await runAxe(page));

    // A value of the first facet narrows the works.
    await dialog.locator('summary').first().focus();
    await page.keyboard.press('Enter');
    const box = dialog.locator('input[type="checkbox"]').first();
    await box.focus();
    await page.keyboard.press('Space');
    await expect(box).toBeChecked();
    await expect.poll(shown).toBeLessThan(before);
    // Clearing them all leaves focus where it was.
    const clear = dialog.locator('.canopy-search-filters__button--secondary');
    await clear.focus();
    await page.keyboard.press('Enter');
    await expect(box).not.toBeChecked();
    await expect(clear).toBeFocused();
    await expect(clear).toHaveAttribute('aria-disabled', 'true');

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(button).toBeFocused();
  });
}

// A page's front matter in its result: the fixture's Prose page gives a description and an
// image, and its Content state page a searchSummary.
test('search page /search/: a page result shows its summary or description, and its image', async ({
  page,
}, testInfo) => {
  test.skip(IS_EXTERNAL, "Reads the fixture's own pages");
  test.skip(!hasPage(testInfo.project.name, '/search/'), 'Not a page of this site');
  await openPage(page, '/search/?type=page');
  const card = (title) =>
    page
      .locator('#search-results .canopy-article-card')
      .filter({ has: page.locator('.canopy-article-card__title', { hasText: new RegExp(`^${title}$`) }) });
  const prose = card('Prose');
  await expect(prose.locator('.canopy-article-card__snippet')).toHaveText(
    'Markdown as authors write it, for the accessibility checks.',
  );
  await expect(prose.locator('img.canopy-article-card__thumb')).toHaveAttribute('alt', '');
  await expect(card('Content state').locator('.canopy-article-card__snippet')).toHaveText(
    'A viewer opened at part of a work, from a link.',
  );
  report(testInfo, 'search-front-matter', '/search/', await runAxe(page));
});

// The search page's outline (DESIGN.md §0, "Headings follow the page"; ACCESSIBILITY.md R7
// and C42): one `h1`, its title in the page's language, no level skipped, the results one
// level below it.
const TITLES = { en: 'Search', es: 'Buscar' };

for (const pagePath of SEARCH_PAGES) {
  test(`search page ${pagePath}: one h1 in the page's language, the results below it`, async ({
    page,
  }, testInfo) => {
    test.skip(!hasPage(testInfo.project.name, pagePath), 'Not a page of this site');
    await openPage(page, `${pagePath}?type=page`);
    await expect(page.locator('#search-results .canopy-article-card__title').first()).toBeVisible();
    const outline = await page.evaluate(() =>
      [...document.querySelectorAll('h1, h2, h3, h4, h5, h6')]
        .filter((h) => h.getClientRects().length && !h.closest('[aria-hidden="true"], [hidden], [inert]'))
        .map((h) => ({ level: Number(h.tagName.slice(1)), text: h.textContent.trim() })),
    );
    expect(outline[0].level).toBe(1);
    expect(outline.filter((h) => h.level === 1)).toHaveLength(1);
    outline.slice(1).forEach((heading, index) => {
      const before = outline[index];
      expect([heading.text, heading.level <= before.level + 1]).toEqual([heading.text, true]);
    });
    expect(
      await page.locator('#search-results .canopy-article-card__title').first().evaluate((h) => h.tagName),
    ).toBe('H2');
    if (!IS_EXTERNAL) {
      const lang = (await page.evaluate(() => document.documentElement.lang || 'en')).slice(0, 2);
      expect(outline[0].text).toBe(TITLES[lang]);
      expect(await page.title()).toMatch(new RegExp(`^${TITLES[lang]} \\|`));
    }
  });
}
