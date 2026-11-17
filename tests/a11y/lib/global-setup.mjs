// Clears the previous run's findings, so summarize.mjs reads this run's alone.

import fs from 'node:fs';
import path from 'node:path';
import { PAGES, RESULTS, SITES } from './sites.mjs';

export default async function globalSetup() {
  fs.rmSync(path.join(RESULTS, 'findings'), { recursive: true, force: true });
  for (const site of SITES) {
    if (!fs.existsSync(site.dir)) {
      throw new Error(
        `[a11y] No built site at ${site.dir}. Run \`npm run test:a11y\` (it builds the fixture), or set CANOPY_A11Y_SITE to a built site.`,
      );
    }
  }
  if (!PAGES.length)
    throw new Error(`[a11y] No pages found in ${SITES.map((site) => site.dir).join(', ')}.`);
}
