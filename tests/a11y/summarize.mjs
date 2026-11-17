// Summarizes the last `npm run test:a11y` run by rule: how many pages, which
// elements, and whether ACCESSIBILITY.md already knows it.
//
//   node tests/a11y/summarize.mjs           print the summary
//   node tests/a11y/summarize.mjs --check   also fail if a known failure matched nothing

import fs from 'node:fs';
import path from 'node:path';
import { KNOWN } from './known-failures.mjs';
import { knownEntryForNode, matchesKnown } from './lib/known.mjs';
import { IS_EXTERNAL, RESULTS } from './lib/sites.mjs';

function readFindings(dir) {
  const found = [];
  if (!fs.existsSync(dir)) return found;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...readFindings(full));
    else if (entry.name.endsWith('.json')) found.push(...JSON.parse(fs.readFileSync(full, 'utf8')));
  }
  return found;
}

const findings = readFindings(path.join(RESULTS, 'findings'));
const byRule = new Map();
for (const finding of findings) {
  const key = `${finding.check}:${finding.rule}`;
  if (!byRule.has(key)) {
    byRule.set(key, {
      check: finding.check,
      rule: finding.rule,
      impact: finding.impact || '',
      help: finding.help || '',
      criteria: finding.criteria || [],
      pages: new Set(),
      projects: new Set(),
      targets: new Map(),
      known: new Set(),
    });
  }
  const row = byRule.get(key);
  row.pages.add(finding.page);
  row.projects.add(finding.project);
  for (const node of finding.nodes) {
    const entry = knownEntryForNode(finding, node);
    row.known.add(entry ? entry.id : 'new');
    row.targets.set(node.target, (row.targets.get(node.target) || 0) + 1);
  }
}

const rows = [...byRule.values()].sort((a, b) => b.pages.size - a.pages.size);
const lines = [
  `| Rule | Check | Criteria | Impact | Pages | Projects | Known | Most common elements |`,
  `| --- | --- | --- | --- | --- | --- | --- | --- |`,
  ...rows.map((row) => {
    const targets = [...row.targets.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([target, count]) => `\`${target.replace(/\|/g, '\\|').slice(0, 80)}\` ×${count}`)
      .join('<br>');
    return `| ${row.rule} | ${row.check} | ${row.criteria.join(' ')} | ${row.impact} | ${row.pages.size} | ${[...row.projects].join(', ')} | ${[...row.known].join(', ')} | ${targets} |`;
  }),
];
const markdown = rows.length ? lines.join('\n') : 'No findings.';
fs.mkdirSync(RESULTS, { recursive: true });
fs.writeFileSync(path.join(RESULTS, 'summary.md'), `${markdown}\n`);
fs.writeFileSync(
  path.join(RESULTS, 'summary.json'),
  JSON.stringify(
    rows.map((row) => ({
      ...row,
      pages: [...row.pages].sort(),
      projects: [...row.projects],
      targets: Object.fromEntries(row.targets),
      known: [...row.known],
    })),
    null,
    2,
  ),
);
console.log(markdown);
console.log(
  `\n${findings.length} findings across ${new Set(findings.map((f) => f.page)).size} pages.`,
);

if (process.argv.includes('--check') && !IS_EXTERNAL) {
  const stale = KNOWN.filter((entry) => !findings.some((finding) => matchesKnown(entry, finding)));
  if (stale.length) {
    console.error(
      `\nThese known failures no longer occur. Remove them from tests/a11y/known-failures.mjs and ACCESSIBILITY.md:\n${stale
        .map((entry) => `  ${entry.id} ${entry.rule}${entry.pages ? ` ${entry.pages}` : ''}`)
        .join('\n')}`,
    );
    process.exit(1);
  }
}
