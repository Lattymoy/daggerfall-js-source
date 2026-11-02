// The release host: the public repository installed copies of the app read their releases from. It is
// this repository until vars.RELEASE_REPO names another, so this one can go private while every copy
// players hold keeps finding its updates. The steps run here under a stub gh, as the runner runs them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, rmSync, chmodSync, existsSync } from 'node:fs';
import { spawnSync, execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const RELEASE = rd('.github/workflows/release-desktop.yml');
const NOTES = rd('.github/workflows/release-notes.yml');
const COPY = rd('.github/workflows/public-copy.yml');
const HOST_TOKEN = "${{ (vars.RELEASE_REPO == '' || vars.RELEASE_REPO == github.repository) && github.token || secrets.RELEASE_TOKEN }}";

/** A step's text, from its `- name:` line to the next step. */
function stepText(yml, name) {
  const at = yml.indexOf(`- name: ${name}\n`);
  assert.ok(at >= 0, `no step named "${name}"`);
  const next = yml.slice(at + 1).search(/\n {6}- /);
  return next < 0 ? yml.slice(at) : yml.slice(at, at + 1 + next);
}
/** A step's `run: |` block, its indentation taken off, as the runner hands it to bash. */
function runBlock(yml, name) {
  const step = stepText(yml, name);
  const from = step.indexOf('run: |\n') + 'run: |\n'.length;
  const lines = [];
  for (const line of step.slice(from).split('\n')) {
    if (line.trim() && !line.startsWith('          ')) break;
    lines.push(line.slice(10));
  }
  return lines.join('\n');
}

/** A stub gh: every call is logged with the token it carried, and answers from files in its folder. */
function stubGh() {
  const bin = mkdtempSync(join(tmpdir(), 'relhost-bin-'));
  writeFileSync(join(bin, 'gh'), [
    '#!/bin/bash',
    'here=$(dirname "$0")',
    'printf \'%s|%s\\n\' "$GH_TOKEN" "$*" >> "$here/log"',
    'args="$*"',
    'case "$args" in',
    '  *"--jq .default_branch"*) echo trunk ;;',
    '  *"--jq .private"*) cat "$here/private" 2>/dev/null || echo false ;;',
    '  *"actions/permissions --jq .enabled"*) cat "$here/actions" 2>/dev/null || echo false ;;',
    '  *"/git/ref/tags/"*) [ -f "$here/ref" ] && exit 0; [ -f "$here/refErr" ] && { cat "$here/refErr" >&2; exit 1; }; echo "gh: Not Found (HTTP 404)" >&2; exit 1 ;;',
    '  "api repos/o/pub/releases/tags/"*) t=${args##*/tags/}; t=${t%% *}; [ -f "$here/published-$t" ] && exit 0; echo "gh: Not Found (HTTP 404)" >&2; exit 1 ;;',
    '  *"--paginate"*) cat "$here/left" 2>/dev/null ;;',
    '  "api repos/o/priv/releases/tags/"*) echo \'{"name":"Update 0.0.9","body":"# Patch Notes: Boats"}\' ;;',
    '  "release download"*) d=${args##*--dir }; mkdir -p "$d"; echo bytes > "$d/DFO-Online-game.pack" ;;',
    '  "api -X POST repos/o/pub/releases "*) echo 7 ;;',
    '  *) : ;;',
    'esac',
    '',
  ].join('\n'));
  chmodSync(join(bin, 'gh'), 0o755);
  const log = () => (existsSync(join(bin, 'log')) ? readFileSync(join(bin, 'log'), 'utf8').trim().split('\n') : []);
  return { bin, log };
}

/** bash in a scratch folder, with the stub first on the PATH and the environment given. */
function runStep(script, bin, env) {
  const cwd = mkdtempSync(join(tmpdir(), 'relhost-run-'));
  const out = join(cwd, 'out');
  writeFileSync(out, '');
  const r = spawnSync('bash', ['-e', '-c', script], { cwd, env: { PATH: `${bin}:${process.env.PATH}`, GITHUB_OUTPUT: out, ...env }, encoding: 'utf8' });
  const outputs = Object.fromEntries(readFileSync(out, 'utf8').trim().split('\n').filter(Boolean).map((l) => l.split('=')));
  rmSync(cwd, { recursive: true, force: true });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr, outputs };
}

test('release host: unset, it is this repository; both workflows read the one setting', () => {
  for (const [name, yml] of [['release-desktop.yml', RELEASE], ['release-notes.yml', NOTES]]) {
    assert.match(yml, /\n {4}env:\n(?: {6}#[^\n]*\n)* {6}RELEASE_REPO: \$\{\{ vars\.RELEASE_REPO \|\| github\.repository \}\}\n/, `${name}: one setting, this repository when unset`);
  }
});

test('release host: every release call names the host and carries its token; the pull requests stay here', () => {
  const steps = (yml) => yml.split(/\n(?= {6}- )/).filter((s) => /^ {6}- /.test(s));
  let calls = 0;
  for (const step of [...steps(RELEASE), ...steps(NOTES)]) {
    assert.doesNotMatch(step, /\$GITHUB_REPOSITORY\/releases|--repo "\$GITHUB_REPOSITORY"/, 'no release is read or written here by name');
    const lines = step.split('\n').filter((l) => /\$RELEASE_REPO/.test(l) && /\bgh\b/.test(l));
    if (!lines.length) continue;
    calls += lines.length;
    const direct = step.includes(`\n          GH_TOKEN: ${HOST_TOKEN}\n`);
    const viaHost = step.includes(`\n          HOST_TOKEN: ${HOST_TOKEN}\n`);
    assert.ok(direct || viaHost, `the host's token: ${step.split('\n')[0]}`);
    if (!direct) for (const l of lines) assert.match(l, /^\s*GH_TOKEN="\$HOST_TOKEN" gh /, `each call takes it: ${l.trim()}`);
  }
  assert.ok(calls >= 9, `the release calls were found (${calls})`);
  // the notes are read off this repository's merged pull requests, with its own token
  assert.match(stepText(RELEASE, 'Write the notes'), /\n {10}GH_TOKEN: \$\{\{ github\.token \}\}\n/);
  assert.match(stepText(NOTES, 'Write the notes again'), /\n {10}GH_TOKEN: \$\{\{ github\.token \}\}\n/);
  // the staging action is told the host, its token and the commit the host step named
  const stage = RELEASE.slice(RELEASE.indexOf('- name: Stage the release as a draft, every file attached'), RELEASE.indexOf('- name: Publish it whole'));
  assert.match(stage, /\n {10}target_commitish: \$\{\{ steps\.host\.outputs\.target \}\}\n {10}repository: \$\{\{ env\.RELEASE_REPO \}\}\n/);
  assert.ok(stage.includes(`\n          token: ${HOST_TOKEN}\n`));
  const host = RELEASE.indexOf('- name: The release host\n'), first = RELEASE.indexOf('$RELEASE_REPO/releases');
  assert.ok(host > 0 && host < first, 'the host is settled before anything is read from it');
});

test('release host: here, the tag is cut at the built commit; elsewhere, at its default branch, and never without a token', () => {
  const script = runBlock(RELEASE, 'The release host');
  const sha = 'a'.repeat(40);
  const { bin, log } = stubGh();
  try {
    for (const repo of ['o/priv', 'O/Priv']) {
      const here = runStep(script, bin, { RELEASE_REPO: repo, GITHUB_REPOSITORY: 'o/priv', GITHUB_SHA: sha, GH_TOKEN: 'mine' });
      assert.equal(here.status, 0, here.stderr);
      assert.deepEqual(here.outputs, { target: sha }, `${repo}: the commit the files were built from`);
    }
    assert.deepEqual(log(), [], 'here, nothing is asked');
    const away = runStep(script, bin, { RELEASE_REPO: 'o/pub', GITHUB_REPOSITORY: 'o/priv', GITHUB_SHA: sha, GH_TOKEN: 'pat' });
    assert.equal(away.status, 0, away.stderr);
    assert.deepEqual(away.outputs, { target: 'trunk', elsewhere: 'true' }, 'the host\'s own default branch: this commit is not there');
    assert.deepEqual(log(), ['pat|api repos/o/pub --jq .default_branch']);
    const bare = runStep(script, bin, { RELEASE_REPO: 'o/pub', GITHUB_REPOSITORY: 'o/priv', GITHUB_SHA: sha, GH_TOKEN: '' });
    assert.equal(bare.status, 1);
    assert.match(bare.stdout, /secrets\.RELEASE_TOKEN is not set/);
    for (const bad of ['pub', 'o/pub/x', 'o/pub";x', '']) {
      assert.equal(runStep(script, bin, { RELEASE_REPO: bad, GITHUB_REPOSITORY: 'o/priv', GITHUB_SHA: sha, GH_TOKEN: 'pat' }).status, 1, JSON.stringify(bad));
    }
  } finally { rmSync(bin, { recursive: true, force: true }); }
});

test('release host: a release published elsewhere leaves its tag here, at the built commit, once', () => {
  const step = stepText(RELEASE, 'The tag here too, when the release went elsewhere');
  assert.match(step, /\n {8}if: steps\.host\.outputs\.elsewhere == 'true'\n/, 'only when the release went elsewhere');
  assert.match(step, /\n {10}GH_TOKEN: \$\{\{ github\.token \}\}\n/, 'this repository\'s own token');
  const publish = RELEASE.indexOf('- name: Publish it whole'), tagHere = RELEASE.indexOf('- name: The tag here too');
  assert.ok(tagHere > publish, 'after the release is out');
  const script = runBlock(RELEASE, 'The tag here too, when the release went elsewhere');
  const env = { GITHUB_REPOSITORY: 'o/priv', GITHUB_SHA: 'b'.repeat(40), TAG: 'app-v0.1.9', GH_TOKEN: 'mine' };
  const { bin, log } = stubGh();
  try {
    const cut = runStep(script, bin, env);
    assert.equal(cut.status, 0, cut.stderr);
    assert.deepEqual(log(), [
      'mine|api repos/o/priv/git/ref/tags/app-v0.1.9 --silent',
      `mine|api -X POST repos/o/priv/git/refs -f ref=refs/tags/app-v0.1.9 -f sha=${'b'.repeat(40)} --silent`,
    ]);
    writeFileSync(join(bin, 'ref'), '');
    const kept = runStep(script, bin, env);
    assert.equal(kept.status, 0, kept.stderr);
    assert.match(kept.stdout, /already tagged here/);
    assert.equal(log().filter((l) => l.includes('-X POST')).length, 1, 'a tag already here is kept as it is');
    rmSync(join(bin, 'ref'));
    writeFileSync(join(bin, 'refErr'), 'gh: Server Error (HTTP 502)\n');
    assert.equal(runStep(script, bin, env).status, 1, 'GitHub down: the step fails rather than guess');
  } finally { rmSync(bin, { recursive: true, force: true }); }
});

test('public copy: by hand only, its inputs read as data, and nothing is written to a private repository or one whose Actions run', () => {
  assert.match(COPY, /\non:\n {2}workflow_dispatch:\n/);
  assert.doesNotMatch(COPY, /\n {2}(push|pull_request|pull_request_target|schedule):/, 'by hand only');
  assert.match(COPY, /^permissions:\n {2}contents: read$/m);
  for (const line of COPY.split('\n').filter((l) => l.includes('${{ inputs.'))) {
    assert.match(line, /^\s+(TO|TAGS): \$\{\{ inputs\.(to|tags) \}\}$|^\s+if: inputs\./, `an input is an environment value or a condition, never script: ${line.trim()}`);
  }
  const script = runBlock(COPY, 'The copy can be made');
  const { bin, log } = stubGh();
  const env = { TO: 'o/pub', TAGS: 'app-v0.1.14487 app-v0.1.14513', GITHUB_REPOSITORY: 'o/priv', GH_TOKEN: 'pat' };
  try {
    const ok = runStep(script, bin, env);
    assert.equal(ok.status, 0, ok.stderr);
    assert.deepEqual(log(), ['pat|api repos/o/pub --jq .private', 'pat|api repos/o/pub/actions/permissions --jq .enabled']);
    for (const [why, over] of [
      ['this repository', { TO: 'O/Priv' }], ['not owner/name', { TO: 'pub' }], ['a bad tag', { TAGS: 'app-v1.2' }],
      ['a quoted tag', { TAGS: 'app-v1.2.3";x;"' }], ['no token', { GH_TOKEN: '' }],
    ]) assert.equal(runStep(script, bin, { ...env, ...over }).status, 1, why);
    writeFileSync(join(bin, 'private'), 'true\n');
    assert.equal(runStep(script, bin, env).status, 1, 'a private repository is no public copy');
    rmSync(join(bin, 'private'));
    writeFileSync(join(bin, 'actions'), 'true\n');
    const live = runStep(script, bin, env);
    assert.equal(live.status, 1, 'its own workflows would start on what arrives');
    assert.match(live.stdout, /turn Actions off on o\/pub first/);
  } finally { rmSync(bin, { recursive: true, force: true }); }
});

test('public copy: each release goes over whole as a draft, published in one step, and only the newest takes latest', () => {
  const step = stepText(COPY, 'Copy the releases');
  assert.match(step, /\n {10}GH_TOKEN: \$\{\{ secrets\.RELEASE_TOKEN \}\}\n {10}HERE_TOKEN: \$\{\{ github\.token \}\}\n/);
  const script = runBlock(COPY, 'Copy the releases');
  const { bin, log } = stubGh();
  try {
    writeFileSync(join(bin, 'published-app-v0.1.14400'), '');
    writeFileSync(join(bin, 'left'), '5\n');
    const r = runStep(script, bin, { TO: 'o/pub', TAGS: 'app-v0.1.14513 app-v0.1.14487 app-v0.1.14400', GITHUB_REPOSITORY: 'o/priv', GH_TOKEN: 'pat', HERE_TOKEN: 'mine' });
    assert.equal(r.status, 0, r.stderr);
    const calls = log();
    for (const c of calls) {
      const [token, args] = c.split('|');
      assert.equal(token, /repos\/o\/priv|--repo o\/priv/.test(args) ? 'mine' : 'pat', `each side its own token: ${c}`);
    }
    const patches = calls.filter((c) => c.includes('-X PATCH')).map((c) => c.split('|')[1]);
    assert.deepEqual(patches, [
      'api -X PATCH repos/o/pub/releases/7 -F draft=false -f make_latest=true --silent',
      'api -X PATCH repos/o/pub/releases/7 -F draft=false -f make_latest=false --silent',
    ], 'the newest by number takes latest, whatever order it was named in');
    assert.ok(calls.some((c) => c.endsWith('api -X POST repos/o/pub/releases -f tag_name=app-v0.1.14513 -f name=Update 0.0.9 -F body=@body.md -F draft=true --jq .id')),
      'staged as a draft, under the release\'s own name and text');
    assert.equal(calls.filter((c) => c.includes('-X DELETE repos/o/pub/releases/5')).length, 2, 'a draft a failed run left is deleted before each staging');
    assert.ok(calls.some((c) => /release upload app-v0\.1\.14487 files\/DFO-Online-game\.pack --repo o\/pub$/.test(c)), 'every file');
    assert.ok(!calls.some((c) => c.includes('tag_name=app-v0.1.14400')), 'a release already published there is left alone');
    assert.match(r.stdout, /app-v0\.1\.14400 is already published on o\/pub/);
  } finally { rmSync(bin, { recursive: true, force: true }); }
});

test('public copy: the seed is main\'s tree as one commit with no history, the internal docs left out and the credits kept', () => {
  const step = stepText(COPY, 'Seed it with main as one commit, the internal docs left out');
  assert.match(step, /\n {8}if: inputs\.seed\n/);
  assert.match(COPY, /- uses: actions\/checkout@v4\n {8}if: inputs\.seed\n {8}with:\n {10}persist-credentials: false/, 'no token of this repository left in .git/config');
  const script = runBlock(COPY, 'Seed it with main as one commit, the internal docs left out');
  assert.doesNotMatch(script, /x-access-token:[^%]|@github\.com|refs\/tags|--force|\+\$COMMIT/, 'the token is never in a URL, no tag goes, and nothing is forced');
  const src = mkdtempSync(join(tmpdir(), 'relhost-src-'));
  const far = mkdtempSync(join(tmpdir(), 'relhost-far-'));
  const runnerTemp = mkdtempSync(join(tmpdir(), 'relhost-tmp-'));
  try {
    const gitEnv = { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t', GIT_COMMITTER_DATE: '2026-11-02T12:00:00Z' };
    const git = (cwd, ...a) => execFileSync('git', a, { cwd, encoding: 'utf8', env: gitEnv });
    git(src, 'init', '-q', '-b', 'main');
    git(far, 'init', '-q', '--bare', '-b', 'main');
    const files = {
      'src/a.js': 'export const a = 1;\n', LICENSE: 'MIT\n', 'README.md': 'the old readme\n',
      'CLAUDE.md': 'rules\n', 'src/scenes/CLAUDE.md': 'rules\n', '.claude/skills/x/SKILL.md': 'skill\n', 'bible/Home.md': 'docs\n',
      'bible/01-Overview/notes.txt': 'not markdown, still the bible\n', 'WORLD_2.0.md': 'plan\n', 'tools/l10n/BRIEF.md': 'brief\n',
      'vendor/mod/README.md': 'permission record\n', 'public/sfx/SOURCES.md': 'credits\n', 'SECURITY.md': 'policy\n', 'SUPPORT.md': 'support\n',
      '.github/public-copy/README.md': '# Open edition\n\nAs it stood on {{DAY}}.\n',
    };
    for (const [f, text] of Object.entries(files)) {
      execFileSync('mkdir', ['-p', join(src, f, '..')]);
      writeFileSync(join(src, f), text);
    }
    git(src, 'add', '-A');
    git(src, 'commit', '-q', '-m', 'one');
    writeFileSync(join(src, 'src/a.js'), 'export const a = 2;\n');
    git(src, 'commit', '-q', '-am', 'two');
    git(src, 'tag', 'app-v0.1.2');
    /** A bare repository standing in for the copy, made empty or with GitHub's creation commit holding `files`. */
    const farRepo = (files = null) => {
      const dir = mkdtempSync(join(tmpdir(), 'relhost-far-'));
      git(dir, 'init', '-q', '--bare', '-b', 'main');
      if (files) {
        const work = mkdtempSync(join(tmpdir(), 'relhost-made-'));
        git(work, 'init', '-q', '-b', 'main');
        for (const [f, text] of Object.entries(files)) writeFileSync(join(work, f), text);
        git(work, 'add', '-A');
        git(work, 'commit', '-q', '-m', 'Initial commit');
        git(work, 'push', '-q', dir, 'main');
        rmSync(work, { recursive: true, force: true });
      }
      return dir;
    };
    const seed = (into) => spawnSync('bash', ['-e', '-c', script], {
      cwd: src, encoding: 'utf8',
      env: {
        PATH: process.env.PATH, HOME: runnerTemp, RUNNER_TEMP: runnerTemp, TO: 'o/pub', GH_TOKEN: 'pat', OWNER: 'Lattymoy', OWNER_ID: '98724681',
        GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: `url.file://${into}.insteadOf`, GIT_CONFIG_VALUE_0: 'https://github.com/o/pub.git',
      },
    });
    const KEPT = ['LICENSE', 'README.md', 'SECURITY.md', 'SUPPORT.md', 'public/sfx/SOURCES.md', 'src/a.js', 'vendor/mod/README.md'];
    const r = seed(far);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /::add-mask::/, 'the encoded token is masked before it is used');
    assert.equal(git(far, 'rev-list', '--count', 'main').trim(), '1', 'one commit');
    assert.equal(git(far, 'log', '-1', '--format=%P', 'main').trim(), '', 'with no parent: nothing left out is in an older commit');
    assert.equal(git(far, 'log', '-1', '--format=%an <%ae>', 'main').trim(), 'Lattymoy <98724681+Lattymoy@users.noreply.github.com>');
    assert.equal(git(far, 'tag', '-l').trim(), '', 'no tag: each names a commit of the private history');
    assert.deepEqual(git(far, 'ls-tree', '-r', '--name-only', 'main').trim().split('\n').sort(), KEPT,
      'the code, the licence, the credits and the policies - no bible, no CLAUDE.md, no .claude, no internal Markdown');
    assert.equal(git(far, 'show', 'main:src/a.js'), 'export const a = 2;\n', 'main as it is now');
    assert.equal(git(far, 'show', 'main:README.md'), '# Open edition\n\nAs it stood on 2026-11-02.\n', 'the open edition\'s README, dated');
    assert.equal(readFileSync(join(src, 'README.md'), 'utf8'), 'the old readme\n', 'the checkout\'s own files are untouched');
    assert.ok(existsSync(join(src, 'bible/Home.md')));

    // a repository made with GitHub's licence: the copy goes on top of that one commit, and its own LICENSE wins
    const licensed = farRepo({ LICENSE: 'MIT License\n\nCopyright (c) 2026 Lattymoy\n' });
    const made = git(licensed, 'rev-parse', 'main').trim();
    git(src, 'reset', '-q', '--hard');
    const onTop = seed(licensed);
    assert.equal(onTop.status, 0, onTop.stderr);
    assert.equal(git(licensed, 'rev-list', '--count', 'main').trim(), '2', 'the creation commit and the copy');
    assert.equal(git(licensed, 'log', '-1', '--format=%P', 'main').trim(), made, 'on top of the creation commit, nothing else');
    assert.deepEqual(git(licensed, 'ls-tree', '-r', '--name-only', 'main').trim().split('\n').sort(), KEPT);
    assert.equal(git(licensed, 'show', 'main:LICENSE'), 'MIT\n', 'the project\'s own licence, with its notices');
    rmSync(licensed, { recursive: true, force: true });

    // anything more than GitHub's creation files is not a fresh copy: refused, and left as it was
    const busy = farRepo({ LICENSE: 'MIT\n', 'x.js': 'other work\n' });
    const busyHead = git(busy, 'rev-parse', 'main').trim();
    git(src, 'reset', '-q', '--hard');
    const refusedBusy = seed(busy);
    assert.equal(refusedBusy.status, 1);
    assert.match(refusedBusy.stdout, /holds more than GitHub's creation commit/);
    assert.equal(git(busy, 'rev-parse', 'main').trim(), busyHead);
    rmSync(busy, { recursive: true, force: true });

    // a copy already seeded: a later main is refused, and nothing forces it
    git(src, 'reset', '-q', '--hard');
    writeFileSync(join(src, 'src/a.js'), 'export const a = 3;\n');
    git(src, 'commit', '-q', '-am', 'three');
    const again = seed(far);
    assert.equal(again.status, 1, 'a second seed is refused: a copy is seeded once');
    assert.match(again.stdout, /holds more than GitHub's creation commit/);
    assert.equal(git(far, 'show', 'main:src/a.js'), 'export const a = 2;\n', 'and the copy is as the first seed left it');
  } finally {
    rmSync(src, { recursive: true, force: true });
    rmSync(far, { recursive: true, force: true });
    rmSync(runnerTemp, { recursive: true, force: true });
  }
});
