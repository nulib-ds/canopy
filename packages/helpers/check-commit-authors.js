#!/usr/bin/env node
'use strict';

// Commits are a person's work (AGENTS.md, "Commit & Pull Request Guidelines"). A commit
// whose message credits an AI tool, or whose author or committer is one, is refused:
// by the commit-msg hook as it is written (`--message-file`), and by the Tests workflow
// for every commit a push or pull request brings (`--range`), which a release waits on.

const {execFileSync} = require('child_process');
const fs = require('fs');

const AI_TOOL = /\b(claude|anthropic|copilot|chatgpt|openai|codex|gemini|cursor ?agent)\b/i;
const AI_EMAIL = /@anthropic\.com|copilot@users\.noreply\.github\.com|@openai\.com/i;

// What in one commit credits an AI tool, as sentences; none for a person's commit.
function findAttribution(commit) {
  const found = [];
  const message = String(commit.message || '');
  for (const line of message.split(/\r?\n/)) {
    if (/^\s*co-authored-by:/i.test(line) && (AI_TOOL.test(line) || AI_EMAIL.test(line))) {
      found.push(`a co-author trailer for an AI tool: "${line.trim()}"`);
    }
    if (/generated (with|by) .*\b(claude|copilot|chatgpt|codex)\b/i.test(line)) {
      found.push(`an AI tool's attribution line: "${line.trim()}"`);
    }
  }
  for (const role of ['author', 'committer']) {
    const name = String(commit[`${role}Name`] || '');
    const email = String(commit[`${role}Email`] || '');
    if (AI_EMAIL.test(email) || (name && AI_TOOL.test(name))) {
      found.push(`an AI tool as its ${role}: ${name} <${email}>`);
    }
  }
  return found;
}

// `git log` with fields split by \x1f and commits by \x1e.
const LOG_FORMAT = '%H%x1f%an%x1f%ae%x1f%cn%x1f%ce%x1f%B%x1e';

function parseLog(text) {
  return String(text || '')
    .split('\x1e')
    .map((entry) => entry.replace(/^\s+/, ''))
    .filter(Boolean)
    .map((entry) => {
      const [sha, authorName, authorEmail, committerName, committerEmail, message] = entry.split('\x1f');
      return {sha, authorName, authorEmail, committerName, committerEmail, message};
    });
}

function main(argv) {
  const at = (flag) => {
    const index = argv.indexOf(flag);
    return index === -1 ? null : argv[index + 1];
  };
  const messageFile = at('--message-file');
  const range = at('--range');
  let commits;
  if (messageFile) {
    commits = [{sha: 'this commit', message: fs.readFileSync(messageFile, 'utf8')}];
  } else if (range) {
    commits = parseLog(execFileSync('git', ['log', `--format=${LOG_FORMAT}`, range], {encoding: 'utf8'}));
  } else {
    console.error('Usage: check-commit-authors.js --message-file <file> | --range <a>..<b>');
    return 2;
  }
  let refused = 0;
  for (const commit of commits) {
    const found = findAttribution(commit);
    if (!found.length) continue;
    refused += 1;
    console.error(`[commit-authors] ${commit.sha.slice(0, 12)} credits an AI tool:`);
    for (const line of found) console.error(`  - ${line}`);
  }
  if (refused) {
    console.error(
      '[commit-authors] Commits are authored by a person, with no AI attribution (AGENTS.md, ' +
        '"Commit & Pull Request Guidelines"). Rewrite the message without it.',
    );
    return 1;
  }
  console.log(`[commit-authors] OK: ${commits.length} commit${commits.length === 1 ? '' : 's'}, each a person's.`);
  return 0;
}

module.exports = {findAttribution, parseLog, LOG_FORMAT};

if (require.main === module) {
  process.exitCode = main(process.argv.slice(2));
}
