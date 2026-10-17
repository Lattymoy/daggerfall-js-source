// REL7 (2026-10-03, Mac: "I need you to do this auto") - A PUBLISHED
// RELEASE'S NOTES, READ AGAIN. app-v0.1.5767 went out saying "Fixes and
// improvements.": #547's notes had lived in a PATCH-NOTES file REL6
// deleted, and its description gained them a minute after the publish job
// had read it. A published release is never re-cut (AUDIT INSTALL L3-2),
// but its TEXT can be written again: editing a merged pull request's
// description (or dispatching .github/workflows/release-notes.yml with a
// tag) has `desktopRelease.mjs renotes` read the notes of the pull requests
// between the previous release and that tag again - main's script, the
// tag's history - and put them above GitHub's generated list; the
// release's body is patched, no file of it touched.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, rmSync, chmodSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { renotedBody, composeReleaseNotes, GENERATED_LIST_RE, NO_NOTES_TEXT } from '../../scripts/desktopRelease.mjs';

const require = createRequire(import.meta.url);
const { playerNotes } = require('../../app/lib/launcherState.cjs');
const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

const LIST = "## What's Changed\n* SILVER-WAYS by @o in https://x/pull/547\n\n\n**Full Changelog**: https://x/compare/a...b";

test('REL7: a release\'s body with its notes written again - the new notes above GitHub\'s list, the list kept, the launcher reading exactly the notes', () => {
  const notes = composeReleaseNotes([{ text: '# Patch Notes: Silver\n\n- Raids pay silver.' }]);
  const old = `${NO_NOTES_TEXT}\n\n\n${LIST}`;
  const body = renotedBody(old, notes);
  assert.equal(body, `# Patch Notes: Silver\n\n- Raids pay silver.\n\n\n${LIST}`);
  assert.equal(playerNotes(body), '# Patch Notes: Silver\n\n- Raids pay silver.', 'the news is the notes, never the list');
  assert.equal(renotedBody(old.replace(/\n/g, '\r\n'), notes), body, 'a body GitHub hands back with CRLF');
  assert.equal(renotedBody(`# Patch Notes: Old\n\n- Gone.\n\n${LIST}`, notes), body, 'old notes are replaced, not kept above the new');
  assert.equal(renotedBody('Fixes and improvements.\n', notes), notes, 'a body with no list is replaced whole');
  assert.equal(renotedBody(null, notes), notes);
  assert.equal(renotedBody(`x\n\n**Full Changelog**: https://x`, notes), `${notes}\n\n**Full Changelog**: https://x`, 'a release with no pull requests listed has only the changelog line');
  // the cut is the launcher's own: one place a player's news ends
  const launcher = rd('app/lib/launcherState.cjs');
  const theirs = /const GENERATED_RE = (\/.*\/m);/.exec(launcher)?.[1];
  assert.equal(String(GENERATED_LIST_RE), theirs, 'app/lib/launcherState.cjs GENERATED_RE and this cut must move together');
});

test('REL7: the renotes command, spawned as release-notes.yml spawns it - from main\'s checkout, the pull requests up to the TAG and no further, the notes off gh; a missing tag or a failed read leaves the release as it is', { skip: process.platform === 'win32' && 'a shell script stands in for gh' }, () => {
  const repo = mkdtempSync(join(tmpdir(), 'rel7-cli-'));
  const bin = mkdtempSync(join(tmpdir(), 'rel7-gh-'));
  const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim();
  const script = fileURLToPath(new URL('../../scripts/desktopRelease.mjs', import.meta.url));
  let n = 0;
  const commit = (msg) => { writeFileSync(join(repo, `${n++}.txt`), `${msg}\n`); git('add', '-A'); git('commit', '-q', '-m', msg); };
  const merge = (pr, branch) => {
    git('checkout', '-q', '-b', branch);
    commit(`${branch} work`);
    git('checkout', '-q', 'main');
    git('merge', '--no-ff', '-q', '-m', `Merge pull request #${pr}: ${branch}`, branch);
  };
  try {
    git('init', '-q', '-b', 'main');
    git('config', 'user.email', 'p@example.invalid');
    git('config', 'user.name', 'p');
    git('config', 'commit.gpgsign', 'false');
    commit('one');
    git('tag', 'app-v0.1.1');
    merge(547, 'silver');
    merge(548, 'rel6');
    git('tag', 'app-v0.1.2');
    merge(549, 'later');   // main has moved on past the release: its merges are the NEXT release's
    writeFileSync(join(bin, 'gh'), [
      '#!/bin/sh',
      'here=$(dirname "$0")',
      '[ -f "$here/fail" ] && { echo "gh: Server Error (HTTP 502)" >&2; exit 1; }',
      'f="$here/$(basename "$2").json"',
      '[ -f "$f" ] || { echo "gh: Not Found (HTTP 404)" >&2; exit 1; }',
      'cat "$f"',
      '',
    ].join('\n'));
    chmodSync(join(bin, 'gh'), 0o755);
    // #547's notes, written on its description after the release was cut; #548 has none for players
    writeFileSync(join(bin, '547.json'), JSON.stringify({ merged_at: 'x', author_association: 'OWNER', body: '## Patch notes: Silver\n\n### Raids\n- 30 silver.\n\n## Summary\n- for reviewers' }));
    writeFileSync(join(bin, '548.json'), JSON.stringify({ merged_at: 'x', author_association: 'OWNER', body: '## Patch notes\n\n<!-- Nothing for players. -->\n\n## What changed\n- the pipeline' }));
    writeFileSync(join(bin, '549.json'), JSON.stringify({ merged_at: 'x', author_association: 'OWNER', body: '## Patch notes: Later\n\n- Not this release.' }));
    const current = join(bin, 'current-body.md');
    writeFileSync(current, `${NO_NOTES_TEXT}\n\n\n${LIST}`);
    const env = { ...process.env, PATH: `${bin}:${process.env.PATH}`, GITHUB_REPOSITORY: 'o/r' };
    const renotes = (tag) => spawnSync(process.execPath, [script, 'renotes', tag, current], { cwd: repo, env, encoding: 'utf8' });
    const ok = renotes('app-v0.1.2');
    assert.equal(ok.status, 0, ok.stderr);
    assert.equal(ok.stdout, `# Patch Notes: Silver\n\n## Raids\n- 30 silver.\n\n\n${LIST}`, 'main checked out, #549 after the tag never reaches it');
    const missing = renotes('app-v0.1.9');
    assert.equal(missing.status, 1, 'a tag this checkout does not have: nothing is written');
    assert.equal(missing.stdout, '');
    assert.match(missing.stderr, /the release is left as it is: no tag app-v0\.1\.9 in this checkout/);
    writeFileSync(join(bin, 'fail'), '');
    const down = renotes('app-v0.1.2');
    assert.equal(down.status, 1, 'GitHub down: the step fails and the release keeps its notes');
    assert.equal(down.stdout, '', 'nothing reaches release-notes.md');
    assert.match(down.stderr, /the notes could not be read - the release is left as it is: gh: Server Error \(HTTP 502\)/);
  } finally {
    rmSync(repo, { recursive: true, force: true });
    rmSync(bin, { recursive: true, force: true });
  }
});

/** A step's `run: |` block, by its name, as the runner hands it to bash. */
function runBlock(yml, stepName) {
  const at = yml.indexOf(`- name: ${stepName}\n`);
  assert.ok(at >= 0, `no step named "${stepName}"`);
  const from = yml.indexOf('run: |\n', at) + 'run: |\n'.length;
  const lines = [];
  for (const line of yml.slice(from).split('\n')) {
    if (line.trim() && !line.startsWith('          ')) break;
    lines.push(line.slice(10));
  }
  return lines.join('\n');
}

test('REL7: the workflow - by hand with a tag, or ON ITS OWN when a merged pull request\'s description is edited; main\'s code only, never the pull request\'s; the first release that brought it; the body patched and nothing else', { skip: process.platform === 'win32' && 'the steps are bash' }, () => {
  const wf = rd('.github/workflows/release-notes.yml');
  assert.match(wf, /\non:\n {2}workflow_dispatch:\n {4}inputs:\n {6}tag:\n[\s\S]*?\n {2}pull_request_target:\n {4}types: \[edited\]\n\n/, 'by hand, and on a description edited');
  assert.doesNotMatch(wf, /\n {2}(push|pull_request|schedule|release):/, 'no other trigger');
  assert.match(wf, /\n {4}if: github\.event_name == 'workflow_dispatch' \|\| \(github\.event\.pull_request\.merged && github\.event\.changes\.body && github\.event\.pull_request\.base\.ref == github\.event\.repository\.default_branch\)\n/,
    'an open pull request, a title edited, a merge into another branch: nothing');
  assert.match(wf, /\npermissions:\n {2}contents: read\n/, 'the workflow reads; only its job writes');
  assert.match(wf, /\n {4}permissions:\n {6}contents: write {8}# the release's body\n {6}pull-requests: read {4}# /);
  assert.match(wf, /- uses: actions\/checkout@v4\n {8}with:\n {10}ref: \$\{\{ github\.event\.repository\.default_branch \}\}\n {10}fetch-depth: 0 .*\n {10}persist-credentials: false /, 'main, every tag, no token left behind');
  assert.doesNotMatch(wf, /pull_request\.head|head_ref|refs\/pull/, 'a pull request\'s code is never checked out under this token');
  for (const step of ['The release to write', 'Write the notes again']) assert.doesNotMatch(runBlock(wf, step), /\$\{\{/, `${step}: nothing from the event is pasted into a script - only the environment carries it`);
  // "The release to write", run as the runner runs it, in a repository with releases
  const pick = runBlock(wf, 'The release to write');
  const repo = mkdtempSync(join(tmpdir(), 'rel7-wf-'));
  const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim();
  try {
    git('init', '-q', '-b', 'main');
    git('config', 'user.email', 'p@example.invalid');
    git('config', 'user.name', 'p');
    git('config', 'commit.gpgsign', 'false');
    const commit = (msg) => { writeFileSync(join(repo, 'f.txt'), `${msg}\n`); git('add', '-A'); git('commit', '-q', '-m', msg); return git('rev-parse', 'HEAD'); };
    commit('start');
    git('tag', 'app-v0.1.8');
    const merged = commit('Merge pull request #547: silver');
    commit('more');
    git('tag', 'app-v0.1.10');   // a version sort, not a text sort: 0.1.9 comes before 0.1.10
    git('tag', 'app-v0.1.9', merged);
    const unreleased = commit('Merge pull request #560: not yet released');
    const run = (env) => {
      const out = join(repo, `out-${Math.random()}`);
      writeFileSync(out, '');
      const r = spawnSync('bash', ['-eo', 'pipefail', '-c', pick], { cwd: repo, env: { PATH: process.env.PATH, GITHUB_OUTPUT: out, INPUT_TAG: '', MERGE_SHA: '', PR: '', ...env }, encoding: 'utf8' });
      return { status: r.status, stdout: r.stdout, out: readFileSync(out, 'utf8') };
    };
    assert.deepEqual(run({ MERGE_SHA: merged, PR: '547' }), { status: 0, stdout: '', out: 'tag=app-v0.1.9\n' }, 'the FIRST release its merge is in');
    const notYet = run({ MERGE_SHA: unreleased, PR: '560' });
    assert.equal(notYet.status, 0, 'no release yet is nothing to do, not a failure');
    assert.equal(notYet.out, '', 'and no tag is written');
    assert.match(notYet.stdout, /no release carries #560 yet/);
    assert.deepEqual(run({ INPUT_TAG: 'app-v0.1.5767' }), { status: 0, stdout: '', out: 'tag=app-v0.1.5767\n' }, 'by hand, the tag given');
    for (const bad of ['app-v0.1', 'v0.1.5767', 'app-v1.2.3";touch${IFS}x;"', 'app-v1.2.3\nmain']) assert.equal(run({ INPUT_TAG: bad }).status, 1, JSON.stringify(bad));
  } finally { rmSync(repo, { recursive: true, force: true }); }
  assert.match(wf, /- name: Write the notes again\n {8}if: steps\.release\.outputs\.tag != ''\n/, 'no release, no write');
  const write = runBlock(wf, 'Write the notes again');
  assert.match(write, /^gh api "repos\/\$GITHUB_REPOSITORY\/releases\/tags\/\$TAG" > release\.json$/m);
  assert.match(write, /^node scripts\/desktopRelease\.mjs renotes "\$TAG" current-body\.md > release-notes\.md$/m);
  assert.match(write, /^gh api -X PATCH "repos\/\$GITHUB_REPOSITORY\/releases\/\$ID" -F body=@release-notes\.md --silent$/m);
  assert.doesNotMatch(write, /assets|upload|DELETE|git checkout/i, 'only the text: no file of a published release is touched (AUDIT INSTALL L3-2), and main\'s script runs');
});
