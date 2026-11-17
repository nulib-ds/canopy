// Commits are a person's work (AGENTS.md, "Commit & Pull Request Guidelines"):
// `packages/helpers/check-commit-authors.js` refuses one that credits an AI tool, in the
// commit-msg hook and in the Tests workflow that a release waits on.

const fs = require('fs');
const os = require('os');
const path = require('path');
const {spawnSync} = require('child_process');
const {findAttribution, parseLog} = require('../../../packages/helpers/check-commit-authors');

const SCRIPT = path.resolve(__dirname, '../../../packages/helpers/check-commit-authors.js');
const person = {authorName: 'Mat Jordan', authorEmail: 'mat@example.org', committerName: 'Mat Jordan', committerEmail: 'mat@example.org'};

test('a person’s short commit passes, even one that mentions a tool in its words', () => {
  expect(findAttribution({...person, message: 'Release Canopy 2.0.0 as @nulib/canopy.\n'})).toEqual([]);
  expect(findAttribution({...person, message: 'Document how Copilot users import Canopy.\n'})).toEqual([]);
  expect(findAttribution({...person, message: 'Fix the slider.\n\nCo-authored-by: Ana Ruiz <ana@example.org>\n'})).toEqual([]);
});

test('a co-author trailer or an attribution line for an AI tool is refused', () => {
  const claude = findAttribution({
    ...person,
    message: 'feat!: Canopy 2.0\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\n',
  });
  expect(claude).toHaveLength(1);
  expect(claude[0]).toMatch(/co-author trailer for an AI tool/);
  for (const message of [
    'Fix a link.\n\nco-authored-by: Copilot <198982749+Copilot@users.noreply.github.com>\n',
    'Fix a link.\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)\n',
    'Fix a link.\n\nCo-authored-by: someone <bot@anthropic.com>\n',
  ]) {
    expect([message, findAttribution({...person, message}).length > 0]).toEqual([message, true]);
  }
});

test('an AI tool as author or committer is refused', () => {
  expect(findAttribution({...person, authorName: 'Claude', authorEmail: 'noreply@anthropic.com', message: 'x\n'})).toHaveLength(1);
  expect(findAttribution({...person, committerName: 'Copilot', committerEmail: 'x@users.noreply.github.com', message: 'x\n'})).toHaveLength(1);
});

test('git log’s output is read commit by commit', () => {
  const log = [
    ['aaa', 'Mat Jordan', 'mat@example.org', 'Mat Jordan', 'mat@example.org', 'One.\n'].join('\x1f'),
    ['bbb', 'Mat Jordan', 'mat@example.org', 'Mat Jordan', 'mat@example.org', 'Two.\n\nCo-Authored-By: Claude <noreply@anthropic.com>\n'].join('\x1f'),
  ].join('\x1e\n') + '\x1e\n';
  const commits = parseLog(log);
  expect(commits.map((commit) => commit.sha)).toEqual(['aaa', 'bbb']);
  expect(commits.map((commit) => findAttribution(commit).length)).toEqual([0, 1]);
});

test('the commit-msg hook’s command refuses a message with the trailer and passes one without', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'canopy-commit-msg-'));
  try {
    const run = (message) => {
      const file = path.join(dir, 'COMMIT_EDITMSG');
      fs.writeFileSync(file, message);
      return spawnSync(process.execPath, [SCRIPT, '--message-file', file], {encoding: 'utf8'});
    };
    const refused = run('Release Canopy 2.0.0.\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\n');
    expect(refused.status).toBe(1);
    expect(refused.stderr).toMatch(/Commits are authored by a person/);
    expect(run('Release Canopy 2.0.0 as @nulib/canopy.\n').status).toBe(0);
  } finally {
    fs.rmSync(dir, {recursive: true, force: true});
  }
});

test('the hook and the Tests workflow both run the check', () => {
  const REPO = path.resolve(__dirname, '../../..');
  expect(fs.readFileSync(path.join(REPO, '.husky/commit-msg'), 'utf8')).toMatch(
    /node packages\/helpers\/check-commit-authors\.js --message-file "\$1"/,
  );
  const workflow = require('js-yaml').load(fs.readFileSync(path.join(REPO, '.github/workflows/test.yml'), 'utf8'));
  const steps = workflow.jobs.authors.steps;
  expect(steps.find((step) => step.uses === 'actions/checkout@v4').with['fetch-depth']).toBe(0);
  expect(steps.some((step) => /check-commit-authors\.js --range/.test(step.run || ''))).toBe(true);
});
