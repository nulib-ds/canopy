// axe-core against every WCAG 2.0, 2.1 and 2.2 rule at Level A and AA, on the page as it
// stands: the specs that open a state first (a search typed, a panel open) check that
// state with it.

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const AXE = require.resolve('axe-core/axe.min.js');
export const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

export async function runAxe(page) {
  if (!(await page.evaluate(() => Boolean(window.axe)))) await page.addScriptTag({ path: AXE });
  return page.evaluate(async (tags) => {
    const result = await window.axe.run(document, {
      runOnly: { type: 'tag', values: tags },
      resultTypes: ['violations'],
    });
    return result.violations.map((violation) => ({
      rule: violation.id,
      impact: violation.impact,
      help: violation.help,
      helpUrl: violation.helpUrl,
      criteria: violation.tags.filter((tag) => /^wcag\d{3,}$/.test(tag)),
      nodes: violation.nodes.map((node) => ({
        target: node.target.flat(Infinity).join(' '),
        html: node.html.slice(0, 300),
        summary: node.failureSummary || '',
      })),
    }));
  }, TAGS);
}
