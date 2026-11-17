// Browser checks for WCAG 2.2 AA (packages/app/DESIGN.md §0). `npm run test:a11y`
// builds the fixture site in light and dark, then runs these against both.

import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';
import { HERE, RESULTS, SITES, baseUrlFor } from './lib/sites.mjs';

export default defineConfig({
  testDir: path.join(HERE, 'specs'),
  testMatch: '**/*.spec.mjs',
  outputDir: path.join(RESULTS, 'artifacts'),
  globalSetup: path.join(HERE, 'lib/global-setup.mjs'),
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['list'], ['github']] : [['list']],
  timeout: 90_000,
  use: {
    ...devices['Desktop Chrome'],
    trace: 'off',
    screenshot: 'off',
  },
  webServer: SITES.map((site) => ({
    command: `node "${path.join(HERE, 'lib/serve.mjs')}" "${site.dir}" ${site.port}`,
    url: `${baseUrlFor(site.port)}/`,
    reuseExistingServer: false,
    stdout: 'ignore',
    stderr: 'pipe',
  })),
  projects: SITES.map((site) => ({
    name: site.name,
    use: {
      baseURL: baseUrlFor(site.port),
      // `auto` follows the system: checked under a dark one, the path its tokens add.
      colorScheme: site.appearance === 'light' ? 'light' : 'dark',
    },
  })),
});
