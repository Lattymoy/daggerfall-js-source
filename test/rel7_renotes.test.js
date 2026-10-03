// REL7 (2026-10-03, Mac: "I need you to do this auto") - A PUBLISHED
// RELEASE'S NOTES, READ AGAIN. app-v0.1.5767 went out saying "Fixes and
// improvements.": #547's notes had lived in a PATCH-NOTES file REL6
// deleted, and its description gained them a minute after the publish job
// had read it. A published release is never re-cut (AUDIT INSTALL L3-2),
// but its TEXT can be written again: .github/workflows/release-notes.yml
// checks the tag out, `desktopRelease.mjs renotes` reads the pull
// requests' notes again and puts them above GitHub's generated list, and
// the release's body is patched - no file of it touched.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, rmSync, chmodSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { renotedBody, composeReleaseNotes, GENERATED_LIST_RE, NO_NOTES_TEXT } from '../scripts/desktopRelease.mjs';

const require = createRequire(import.meta.url);
const { playerNotes } = require('../app/lib/launcherState.cjs');
const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

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

test('REL7: the renotes command, spawned as release-notes.yml spawns it - HEAD must be the tag, the notes off gh, and a read that fails leaves the release as it is', { skip: process.platform === 'win32' && 'a shell script stands in for gh' }, () => {
  const repo = mkdtempSync(join(tmpdir(), 'rel7-cli-'));
  const bin = mkdtempSync(join(tmpdir(), 'rel7-gh-'));
  const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim();
  const script = fileURLToPath(new URL('../scripts/desktopRelease.mjs', import.meta.url));
  let n = 0;
  const commit = (msg) => { writeFileSync(join(repo, `${n++}.txt`), `${msg}\n`); git('add', '-A'); git('commit', '-q', '-m', msg); };
  try {
    git('init', '-q', '-b', 'main');
    git('config', 'user.email', 'p@example.invalid');
    git('config', 'user.name', 'p');
    git('config', 'commit.gpgsign', 'false');
    commit('one');
    git('tag', 'app-v0.1.1');
    for (const [pr, branch] of [[547, 'silver'], [548, 'rel6']]) {
      git('checkout', '-q', '-b', branch);
      commit(`${branch} work`);
      git('checkout', '-q', 'main');
      git('merge', '--no-ff', '-q', '-m', `Merge pull request #${pr}: ${branch}`, branch);
    }
    git('tag', 'app-v0.1.2');
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
    const current = join(bin, 'current-body.md');
    writeFileSync(current, `${NO_NOTES_TEXT}\n\n\n${LIST}`);
    const env = { ...process.env, PATH: `${bin}:${process.env.PATH}`, GITHUB_REPOSITORY: 'o/r' };
    const renotes = (tag) => spawnSync(process.execPath, [script, 'renotes', tag, current], { cwd: repo, env, encoding: 'utf8' });
    const ok = renotes('app-v0.1.2');
    assert.equal(ok.status, 0, ok.stderr);
    assert.equal(ok.stdout, `# Patch Notes: Silver\n\n## Raids\n- 30 silver.\n\n\n${LIST}`);
    // a checkout that is not the tag would read the wrong pull requests
    commit('later work');
    const moved = renotes('app-v0.1.2');
    assert.equal(moved.status, 1, 'HEAD past the tag: nothing is written');
    assert.equal(moved.stdout, '');
    assert.match(moved.stderr, /the release is left as it is: HEAD is [0-9a-f]{40}, not app-v0\.1\.2/);
    git('checkout', '-q', 'app-v0.1.2');
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

test('REL7: the workflow - run by hand only, the tag checked before anything names it, the tag itself checked out, the body patched and nothing else', () => {
  const wf = rd('.github/workflows/release-notes.yml');
  assert.match(wf, /\non:\n {2}workflow_dispatch:\n {4}inputs:\n {6}tag:\n/, 'dispatched with a tag');
  assert.doesNotMatch(wf, /\n {2}(push|pull_request|pull_request_target|schedule|release):/, 'never on its own');
  assert.match(wf, /\npermissions:\n {2}contents: read\n/, 'the workflow reads; only its job writes');
  assert.match(wf, /\n {4}permissions:\n {6}contents: write {8}# the release's body\n {6}pull-requests: read {4}# /);
  const check = wf.indexOf('- name: The tag is a release tag');
  const checkout = wf.indexOf('- uses: actions/checkout@v4');
  assert.ok(check >= 0 && check < checkout, 'the tag is checked before it is checked out');
  assert.match(wf.slice(checkout), /^ {10}ref: refs\/tags\/\$\{\{ inputs\.tag \}\}\n {10}fetch-depth: 0 .*\n {10}persist-credentials: false /m);
  // the check, run as the runner runs it
  const gate = runBlock(wf, 'The tag is a release tag');
  const run = (TAG) => spawnSync('bash', ['-c', gate], { env: { PATH: process.env.PATH, TAG }, encoding: 'utf8' }).status;
  assert.equal(run('app-v0.1.5767'), 0);
  for (const bad of ['app-v0.1', 'v0.1.5767', 'app-v1.2.3";touch${IFS}x;"', 'app-v1.2.3\nmain', '']) assert.equal(run(bad), 1, JSON.stringify(bad));
  const write = runBlock(wf, 'Write the notes again');
  assert.match(write, /^gh api "repos\/\$GITHUB_REPOSITORY\/releases\/tags\/\$TAG" > release\.json$/m);
  assert.match(write, /^node scripts\/desktopRelease\.mjs renotes "\$TAG" current-body\.md > release-notes\.md$/m);
  assert.match(write, /^gh api -X PATCH "repos\/\$GITHUB_REPOSITORY\/releases\/\$ID" -F body=@release-notes\.md --silent$/m);
  assert.doesNotMatch(write, /assets|upload|DELETE/i, 'only the text: no file of a published release is touched (AUDIT INSTALL L3-2)');
  assert.doesNotMatch(wf, /\$\{\{ inputs\.tag \}\}"|run:.*\$\{\{/, 'the tag reaches a script through the environment only');
});
