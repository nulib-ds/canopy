// Matches findings against known-failures.mjs, element by element: a page can fail
// one rule for two known reasons and one new one, and only the new one should fail
// the run. No Playwright here, so the summary script can use it outside the runner.

import { KNOWN } from '../known-failures.mjs';

export function entryMatchesNode(entry, finding, node) {
  if (entry.rule !== finding.rule) return false;
  if (entry.projects && !entry.projects.includes(finding.project)) return false;
  if (entry.pages && !entry.pages.test(finding.page)) return false;
  if (!entry.targets) return true;
  return entry.targets.some((target) => node.target.includes(target) || node.html.includes(target));
}

export function knownEntryForNode(finding, node) {
  return KNOWN.find((entry) => entryMatchesNode(entry, finding, node)) || null;
}

// What no known entry explains: the finding narrowed to its unmatched elements, or
// null when every element is known.
export function unknownPart(finding) {
  const nodes = finding.nodes.filter((node) => !knownEntryForNode(finding, node));
  return nodes.length ? { ...finding, nodes } : null;
}

// Whether an entry explains any element of a finding (for stale-entry checks).
export function matchesKnown(entry, finding) {
  return finding.nodes.some((node) => entryMatchesNode(entry, finding, node));
}
