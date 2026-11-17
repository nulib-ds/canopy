// Shared by the specs: open a page the way a visitor meets it, record what a check
// finds, and fail on anything not already in known-failures.mjs.

import fs from 'node:fs';
import path from 'node:path';
import { expect } from '@playwright/test';
import { unknownPart } from './known.mjs';
import { IS_EXTERNAL, REPORT_ONLY, RESULTS } from './sites.mjs';

const LOCAL = /^http:\/\/127\.0\.0\.1(?::\d+)?\//;

// Opens `pagePath` and waits for Canopy's runtimes to mount. The fixture is offline:
// requests off this machine are refused, so a check never waits on the network.
export async function openPage(page, pagePath) {
  if (!IS_EXTERNAL) {
    await page.route('**/*', (route) =>
      LOCAL.test(route.request().url()) ? route.continue() : route.abort(),
    );
  }
  await page.goto(pagePath, { waitUntil: 'load' });
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
  // Scroll through once, as a reader would, so components that mount when they come
  // into view (maps, sliders, viewers) are there to be checked; then back to the top.
  await page.evaluate(async () => {
    const step = Math.max(200, Math.floor(window.innerHeight * 0.8));
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 60));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(300);
}

// Turns transitions and animations off, so what a screenshot shows has settled.
export async function settleMotion(page) {
  await page.addStyleTag({
    content:
      '*,*::before,*::after{transition:none!important;animation:none!important;caret-color:transparent!important}',
  });
}

function slug(value) {
  return (
    value
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase() || 'home'
  );
}

function describe(findings) {
  return findings
    .map((finding) => {
      const nodes = finding.nodes
        .slice(0, 5)
        .map(
          (node) =>
            `      ${node.target}${node.summary ? `\n        ${node.summary.split('\n').join('\n        ')}` : ''}`,
        )
        .join('\n');
      const more = finding.nodes.length > 5 ? `\n      …and ${finding.nodes.length - 5} more` : '';
      return `  ${finding.rule} (${finding.check}${finding.impact ? `, ${finding.impact}` : ''}) on ${finding.page} [${finding.project}]: ${finding.help || ''}\n${nodes}${more}`;
    })
    .join('\n');
}

// Writes the findings where summarize.mjs reads them, then fails on new ones.
export function report(testInfo, check, pagePath, findings) {
  const project = testInfo.project.name;
  const full = findings.map((finding) => ({ check, page: pagePath, project, ...finding }));
  const dir = path.join(RESULTS, 'findings', project);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, `${check}-${slug(pagePath)}.json`),
    JSON.stringify(full, null, 2),
  );
  if (REPORT_ONLY) return;
  const unknown = full.map(unknownPart).filter(Boolean);
  expect(
    unknown,
    `New accessibility failures (WCAG 2.2 AA). Fix them; a failure that predates this change goes into ACCESSIBILITY.md and known-failures.mjs with a plan.\n${describe(unknown)}`,
  ).toEqual([]);
}
