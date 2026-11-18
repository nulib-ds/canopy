// Renders the docs' diagram (`canopy-diagram.html`) to `assets/canopy-diagram.webp`, at
// twice its size, with the Chromium the accessibility checks use (Playwright):
//
//   node packages/helpers/docs/diagram/render-diagram.mjs
//
// It needs the network for its IIIF images and `cwebp` (libwebp) for the WebP. The page's
// handwriting is a macOS face (Bradley Hand); elsewhere the page falls back to a cursive.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../../../..');
const PAGE = path.join(HERE, 'canopy-diagram.html');
const OUT = path.join(REPO, 'assets/canopy-diagram.webp');

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1056 }, deviceScaleFactor: 2 });
  await page.goto(pathToFileURL(PAGE).href, { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      [...document.images].map((img) => (img.complete ? null : new Promise((done) => img.addEventListener('load', done, { once: true })))),
    );
  });
  const missing = await page.evaluate(() => [...document.images].filter((img) => !img.naturalWidth).map((img) => img.src));
  if (missing.length) throw new Error(`Images that did not load: ${missing.join(', ')}`);
  const png = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'canopy-diagram-')), 'diagram.png');
  await page.screenshot({ path: png, omitBackground: true });
  execFileSync('cwebp', ['-quiet', '-q', '84', '-alpha_q', '100', png, '-o', OUT]);
  console.log(`[diagram] wrote ${path.relative(REPO, OUT)} (${Math.round(fs.statSync(OUT).size / 1024)} KB)`);
} finally {
  await browser.close();
}
