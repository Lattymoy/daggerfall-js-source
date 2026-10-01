// REL4 + REL5 (2026-09-29, Mac: "How can we drastically improve the
// install experience? ... I really want to make it AAA grade").
//
// REL4 - THE RELEASE IS PUBLISHED WHOLE, ONCE. Every release on GitHub
// carried its generated notes two or three times over (one copy per OS
// leg, one sometimes lost to a race between legs), and each went live
// when its FIRST leg finished - app-v0.1.4605 was `latest` for eighty-five
// seconds with no Windows installer and no latest.yml. The legs only
// build now; one publish job, gated on every leg, checks the set, writes
// the notes once, stages a draft with every file and publishes it in one
// step.
//
// REL5 - THE DOWNLOADS HAVE NAMES THAT DO NOT MOVE. The build number is
// out of every file name, so releases/latest/download/<name> serves the
// newest copy for ever and the site can link each installer directly.
// The names are a contract (app/lib/downloads.cjs): the build config must
// produce them and the publish job refuses a set without them.
//
// REL6 (2026-10-01, Mac: "Remove patch notes from the codebase and somehow
// refrain from patch notes filling up the codebase") - THE NOTES COME OFF
// THE PULL REQUEST. A release's notes are the `## Patch notes` sections of
// the pull requests merged since the previous release, read off GitHub;
// the PATCH-NOTES-*.md files they used to be read from are gone from the
// tree, and no file there may be one again.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync, chmodSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import {
  EXPECTED_RELEASE_FILES, missingReleaseFiles, composeReleaseNotes, NO_NOTES_TEXT, shouldMarkLatest,
  previousReleaseTag, pullRequestsSince, patchNotesOf, pullRequestNotesSince, githubApi, NOTES_AUTHORS, NOTES_MAX,
  PATCH_NOTES_PATH_RE,
} from '../scripts/desktopRelease.mjs';

const require = createRequire(import.meta.url);
const { DOWNLOAD_FILES, RELEASES_URL, latestDownloadUrl, manualDownloadFile } = require('../app/lib/downloads.cjs');
const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

/** electron-builder's artifactName macros, as the three release runners
 *  resolve them: windows-latest builds x64, macos-latest arm64, and the
 *  AppImage target spells x64 as x86_64. */
const expand = (template, vars) => template.replace(/\$\{(\w+)\}/g, (_, k) => {
  assert.ok(k in vars, `the template uses \${${k}}, which this pin does not resolve - a version, say, back in a name`);
  return vars[k];
});

test('REL5: the build config produces EXACTLY the names the downloads promise - no version in any of them', () => {
  const b = JSON.parse(rd('app/package.json')).build;
  // electron-builder's own precedence (app-builder-lib 25 artifactPatternConfig): the TARGET's options, then the
  // PLATFORM's, then the top level - and the AppImage target's options are the linux block with appImage's over it.
  // AUDIT INSTALL L5-11: this read `b.AppImage` (the key is appImage) and never the platform blocks, so a versioned
  // name under "mac" or "linux" passed.
  const platformOf = { nsis: 'win', portable: 'win', dmg: 'mac', appImage: 'linux' };
  const nameOf = (target) => b[target]?.artifactName || b[platformOf[target]]?.artifactName || b.artifactName;
  assert.equal(expand(nameOf('nsis'), { arch: 'x64', ext: 'exe' }), DOWNLOAD_FILES.winSetup);
  assert.equal(expand(nameOf('portable'), { arch: 'x64', ext: 'exe' }), DOWNLOAD_FILES.winPortable);
  assert.equal(expand(nameOf('dmg'), { os: 'mac', arch: 'arm64', ext: 'dmg' }), DOWNLOAD_FILES.mac);
  assert.equal(expand(nameOf('appImage'), { os: 'linux', arch: 'x86_64', ext: 'AppImage' }), DOWNLOAD_FILES.linux);
  for (const t of ['nsis', 'portable', 'dmg', 'appImage']) assert.doesNotMatch(nameOf(t), /\$\{version\}/, `${t}: a versioned name is a link that dies at the next merge`);
  assert.ok(!('AppImage' in b), 'the AppImage target\'s options live under appImage - a block under any other key is read by nobody');
  assert.deepEqual(b.win.target, ['nsis', 'portable']);
  assert.deepEqual(b.mac.target, ['dmg']);
  assert.deepEqual(b.linux.target, ['AppImage'], 'every target the release carries has a promised name');
  assert.equal(Object.keys(DOWNLOAD_FILES).length, 4);
});

test('REL5: a download link names the file under releases/latest/download, which GitHub answers with the newest copy', () => {
  assert.equal(RELEASES_URL, 'https://github.com/Lattymoy/daggerfall-js-source/releases');
  assert.equal(latestDownloadUrl(DOWNLOAD_FILES.winSetup),
    'https://github.com/Lattymoy/daggerfall-js-source/releases/latest/download/DaggerfallOnline-win-x64-setup.exe');
  // the copy that updates BY HAND is sent its own file, never a page of eleven
  assert.equal(manualDownloadFile({ platform: 'darwin', portable: false, packaged: true }), DOWNLOAD_FILES.mac);
  assert.equal(manualDownloadFile({ platform: 'win32', portable: true, packaged: true }), DOWNLOAD_FILES.winPortable);
  assert.equal(manualDownloadFile({ platform: 'win32', portable: false, packaged: true }), DOWNLOAD_FILES.winSetup);
  assert.equal(manualDownloadFile({ platform: 'linux', portable: false, packaged: true }), DOWNLOAD_FILES.linux);
  assert.equal(manualDownloadFile({ platform: 'win32', portable: false, packaged: false }), null, 'an unpackaged run has no file to fetch');
  assert.equal(manualDownloadFile({ platform: 'freebsd', portable: false, packaged: true }), null);
});

test('REL4: a release is the four downloads, the three manifests and two blockmaps - one short publishes nothing', () => {
  assert.deepEqual([...EXPECTED_RELEASE_FILES].sort(), [
    'DaggerfallOnline-linux-x86_64.AppImage',
    'DaggerfallOnline-mac-arm64.dmg', 'DaggerfallOnline-mac-arm64.dmg.blockmap',
    'DaggerfallOnline-win-x64-portable.exe',
    'DaggerfallOnline-win-x64-setup.exe', 'DaggerfallOnline-win-x64-setup.exe.blockmap',
    'latest-linux.yml', 'latest-mac.yml', 'latest.yml',
  ]);
  assert.deepEqual(missingReleaseFiles([...EXPECTED_RELEASE_FILES, 'extra.txt']), [], 'a whole set passes');
  // app-v0.1.4605's first eighty-five seconds: the Linux and macOS legs were in, Windows was not
  const early = EXPECTED_RELEASE_FILES.filter((f) => !/win-x64|^latest\.yml$/.test(f));
  assert.deepEqual(missingReleaseFiles(early), [DOWNLOAD_FILES.winSetup, `${DOWNLOAD_FILES.winSetup}.blockmap`, DOWNLOAD_FILES.winPortable, 'latest.yml']);
  // the OLD names do not count - a build that still stamps its version into a name fails the release
  assert.ok(missingReleaseFiles(['DaggerfallOnline-0.1.4684-win-x64-setup.exe']).includes(DOWNLOAD_FILES.winSetup));
});

test('REL4: the notes are the patch notes the release brings, once, and say so plainly when there are none', () => {
  const a = '# Patch Notes: The Sea\n\n- Boats.\n';
  const b = '\n# Patch Notes: The Pause Key\n- Pause.\n\n';
  assert.equal(composeReleaseNotes([{ pr: 2, text: a }, { pr: 1, text: b }]),
    '# Patch Notes: The Sea\n\n- Boats.\n\n# Patch Notes: The Pause Key\n- Pause.\n');
  assert.equal(composeReleaseNotes([]), `${NO_NOTES_TEXT}\n`);
  assert.equal(composeReleaseNotes([{ pr: 3, text: '  \n' }]), `${NO_NOTES_TEXT}\n`, 'empty notes are no note');
  assert.equal(composeReleaseNotes(undefined), `${NO_NOTES_TEXT}\n`);
  assert.equal(previousReleaseTag('app-v0.1.4644', (args) => {
    assert.equal(args.join(' '), 'describe --tags --abbrev=0 --match app-v* --exclude app-v0.1.4644 HEAD', 'the tag being cut is never its own "previous"');
    return 'app-v0.1.4615';
  }), 'app-v0.1.4615');
  assert.equal(previousReleaseTag('app-v0.1.1', () => { throw new Error('no names found'); }), null);
  const never = () => { throw new Error('never asked'); };
  assert.deepEqual(pullRequestNotesSince(null, { run: never, api: never }), [], 'no previous release, no pile of every note ever written');
});

test('AUDIT INSTALL L5-10: the script\'s own commands, run - a set one short exits 1, "latest" prints what the publish job reads', () => {
  const script = new URL('../scripts/desktopRelease.mjs', import.meta.url).pathname;
  const node = (...args) => spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });
  const dir = mkdtempSync(join(tmpdir(), 'rel4-set-'));
  try {
    for (const f of EXPECTED_RELEASE_FILES.slice(1)) writeFileSync(join(dir, f), 'x');
    const short = node('check', dir);
    assert.equal(short.status, 1, 'one file short: the publish job stops here');
    assert.match(short.stderr, new RegExp(`missing ${EXPECTED_RELEASE_FILES[0].replace(/\./g, '\\.')} - nothing is published`));
    writeFileSync(join(dir, EXPECTED_RELEASE_FILES[0]), 'x');
    assert.equal(node('check', dir).status, 0, 'whole: it passes');
  } finally { rmSync(dir, { recursive: true, force: true }); }
  const old = node('latest', 'app-v0.1.5', 'app-v0.1.9');
  assert.deepEqual([old.status, old.stdout.trim()], [0, 'false'], 'an old re-cut never takes latest');
  assert.equal(node('latest', 'app-v0.1.10', 'app-v0.1.9').stdout.trim(), 'true');
  assert.equal(node('latest', 'app-v0.1.10', '').stdout.trim(), 'true', 'nothing latest yet');
  assert.equal(node('bogus').status, 2, 'an unknown command is a usage error, never a quiet success');
});

test('REL4: a release takes `latest` unless a newer one holds it - a hand re-cut of an old build must not move every link back', () => {
  assert.equal(shouldMarkLatest('app-v0.1.4685', 'app-v0.1.4684'), true);
  assert.equal(shouldMarkLatest('app-v0.1.4684', 'app-v0.1.4684'), true, 'a re-cut of the current build keeps it');
  assert.equal(shouldMarkLatest('app-v0.1.4600', 'app-v0.1.4684'), false);
  assert.equal(shouldMarkLatest('app-v0.10.0', 'app-v0.9.9'), true, 'numeric, not string');
  assert.equal(shouldMarkLatest('app-v1.0.0', ''), true, 'nothing is latest yet');
  assert.equal(shouldMarkLatest('app-v1.0.0', 'garbage'), true);
  assert.equal(shouldMarkLatest('v1.0.0', 'app-v0.1.1'), false, 'an unparseable tag never takes latest');
});

test('REL4: the workflow - one number, legs that only build, one publish gated on every leg, a draft published in one step', () => {
  const wf = rd('.github/workflows/release-desktop.yml');
  const job = (name) => {
    const at = wf.indexOf(`\n  ${name}:\n`);
    assert.ok(at > 0, `a ${name} job`);
    const next = wf.slice(at + 1).search(/\n {2}[a-z][\w-]*:\n/);
    return next < 0 ? wf.slice(at) : wf.slice(at, at + 1 + next);
  };
  const version = job('version'), build = job('build'), publish = job('publish');
  assert.equal((wf.match(/- name: Resolve release version/g) ?? []).length, 1, 'the number is resolved once');
  assert.match(version, /- name: Resolve release version/);
  assert.match(build, /needs: \[version, gate\]/, 'no leg packages before the suite passed');
  assert.doesNotMatch(build, /action-gh-release|gh release|releases\//, 'a leg publishes NOTHING');
  assert.match(build, /uses: actions\/upload-artifact@v4[\s\S]*name: desktop-\$\{\{ matrix\.os \}\}/, 'it hands its files on');
  assert.match(publish, /needs: \[version, build\]/, 'publish waits for the WHOLE matrix');
  assert.match(publish, /if: needs\.version\.outputs\.tag != ''/, 'and only when there is a release to cut (no always(): a failed leg skips it)');
  assert.doesNotMatch(publish, /always\(\)|failure\(\)|cancelled\(\)/);
  assert.match(publish, /uses: actions\/download-artifact@v4[\s\S]*pattern: desktop-\*[\s\S]*merge-multiple: true/);
  const check = publish.indexOf('desktopRelease.mjs check release'), stage = publish.indexOf('uses: softprops/action-gh-release@');
  assert.ok(check > 0 && stage > check, 'the set is checked before anything is staged');
  assert.match(publish, /draft: true/, 'staged as a draft - invisible while the files upload');
  assert.match(publish, /body_path: release-notes\.md/);
  assert.equal((wf.match(/generate_release_notes: true/g) ?? []).length, 1, 'GitHub\'s list is generated ONCE');
  assert.match(publish, /-F draft=false -f make_latest="\$MAKE_LATEST"/, 'and published in one step');
  assert.match(publish, /MAKE_LATEST=\$\(node scripts\/desktopRelease\.mjs latest "\$TAG" "\$CURRENT"\)/);
  assert.match(publish, /RELEASE_ID: \$\{\{ steps\.release\.outputs\.id \}\}/, 'the draft it staged, by id - a draft has no tag to look up');
  assert.match(publish, /permissions:\n\s+contents: write/, 'only the publish job writes');
  assert.match(wf, /^permissions:\n {2}contents: read$/m, 'everything else reads');
  assert.match(publish, /target_commitish: \$\{\{ github\.sha \}\}/, 'AUDIT 68: the tag lands on the commit the files were built from');
  // REL6: the notes are read off the merged pull requests, with the job's own token
  assert.match(publish, /permissions:\n\s+contents: write\n\s+pull-requests: read\b/, 'REL6: the publish job may read pull requests');
  const notesStep = publish.slice(publish.indexOf('- name: Write the notes'), publish.indexOf('desktopRelease.mjs notes'));
  assert.match(notesStep, /\n {10}GH_TOKEN: \$\{\{ github\.token \}\}\n/, 'REL6: and the notes step hands gh that token');
});

test('REL5: the site links each installer by the name the release promises - the door\'s Install lands on them, one click each', () => {
  const landing = rd('index.html');
  const entry = landing.slice(landing.indexOf('<dt id="desktop">'), landing.indexOf('</dd>', landing.indexOf('<dt id="desktop">')));
  const hrefs = [...entry.matchAll(/href="(https:\/\/github\.com\/[^"]*\/releases\/latest\/download\/[^"]*)"/g)].map((m) => m[1]);
  assert.deepEqual(hrefs.sort(), Object.values(DOWNLOAD_FILES).map(latestDownloadUrl).sort(),
    'the four downloads, exactly - a name the release does not carry is a dead link on the front page');
  const row = entry.match(/<span class="dl">([\s\S]*?)<\/span>/)?.[1] ?? '';
  assert.deepEqual([...row.matchAll(/>([^<]+)<\/a>/g)].map((m) => m[1]), ['Windows', 'macOS', 'Linux'], 'one link per platform, in the page\'s own link style');
  assert.match(landing, /<a class="plaque" href="#desktop">Install<\/a>/, 'and the door\'s Install lands on them');
  assert.doesNotMatch(landing.replace(/href="https:\/\/github\.com\/Lattymoy\/daggerfall-js-source\/releases\/latest"[^>]*>Every file</, ''), /href="https:\/\/github\.com\/[^"]*\/releases\/latest"/,
    'the release PAGE is linked once, as "Every file" - never as the way to install');
});

test('REL6: a description\'s patch notes, as the release prints them - its "Patch notes" sections lifted to `# Patch Notes:`, and nothing else', () => {
  const description = [
    '## Why', 'From the field.', '',
    '## Patch notes: Boats on the compass', '<!-- the template\'s guidance -->', '### Boats',
    '- **Your boats are marked on the compass.** Follow the mark.', '  - Even across the bay.', '',
    '```', '## a heading in a fence is text', '```', '',
    '## Verification', '- `npm test`', '',
    '### Patch notes', 'None - tooling only.', '',
    '## Patch Notes', '- A second part.', '',
    '🤖 Generated with [Claude Code](https://claude.com/claude-code)', '', 'https://claude.ai/code/session_x',
  ].join('\r\n');
  assert.equal(patchNotesOf(description), [
    '# Patch Notes: Boats on the compass', '', '## Boats',
    '- **Your boats are marked on the compass.** Follow the mark.', '  - Even across the bay.', '',
    '```', '## a heading in a fence is text', '```', '',
    '# Patch Notes', '', '- A second part.',
  ].join('\n'), 'each section lifted a level, a "None" none, the footer never notes, a fenced heading text, CRLF read');
  assert.equal(patchNotesOf('## What changed\n- code\n'), '', 'no section, no notes');
  assert.equal(patchNotesOf('## Patch notes\n\n<!-- leave it empty -->\n\n## What changed\n- code'), '', 'the template left as it is says nothing');
  assert.equal(patchNotesOf('## Patch notes\n### Fixes\n\n## Next'), '', 'headings alone say nothing');
  for (const none of ['None.', 'N/A', '_None_', 'Nothing - internal.', 'None (tooling only)']) {
    assert.equal(patchNotesOf(`## Patch notes\n${none}`), '', `"${none}" is no notes`);
  }
  assert.equal(patchNotesOf('## Patch notes\nNone of your saves are lost any more.'), '# Patch Notes\n\nNone of your saves are lost any more.',
    'a note that opens with "None" is a note');
  assert.equal(patchNotesOf('# Patch notes - Big\n## A\n- a\n---\n_footer_'), '# Patch Notes: Big\n\n## A\n- a', 'a level-1 section, titled after a dash; a rule ends it');
  assert.equal(patchNotesOf('## Patch notes: T\n- a <!-- an aside -->\n- b\n<!-- unclosed\n- c'), '# Patch Notes: T\n\n- a \n- b',
    'comments are not notes - an unclosed one, to the end');
  assert.equal(patchNotesOf('## Docs\n### Patch notes: Deep\n#### Fixes\n- d\n### Next\n- e'), '# Patch Notes: Deep\n\n## Fixes\n- d',
    'a section at any level ends at its level and lifts its own headings');
  assert.equal(patchNotesOf(null), '');
});

test('REL6: the pull requests a release brings - every merge on the first-parent line since the last release, newest first, once', () => {
  const repo = mkdtempSync(join(tmpdir(), 'rel6-prs-'));
  const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8', maxBuffer: 1 << 24 }).trim();
  let n = 0;
  const commit = (msg) => { writeFileSync(join(repo, `${n++}.txt`), `${msg}\n`); git('add', '-A'); git('commit', '-q', '-m', msg); };
  try {
    git('init', '-q', '-b', 'main');
    git('config', 'user.email', 'probe@example.invalid');
    git('config', 'user.name', 'probe');
    git('config', 'commit.gpgsign', 'false');
    commit('start');
    git('tag', 'app-v0.1.1');
    // a branch that merged another pull request into ITSELF - that merge is the branch's, never main's
    git('checkout', '-q', '-b', 'side');
    commit('side work');
    git('checkout', '-q', '-b', 'a', 'main');
    commit('a work');
    git('merge', '--no-ff', '-q', '-m', 'Merge pull request #77: into the branch, not main', 'side');
    git('checkout', '-q', 'main');
    git('merge', '--no-ff', '-q', '-m', 'Merge pull request #12 from owner/a', 'a');
    commit('Fix the boat (#14)');   // a squash
    commit('tweak the docs');       // pushed straight to main: no pull request
    git('checkout', '-q', '-b', 'b');
    commit('b work');
    git('checkout', '-q', 'main');
    git('merge', '--no-ff', '-q', '-m', 'Merge pull request #13: Boats on the compass', 'b');
    commit('Revert "Fix the boat (#14)" (#15)');
    git('checkout', '-q', '-b', 'c');
    commit('c work');
    git('checkout', '-q', 'main');
    git('merge', '--no-ff', '-q', '-m', 'Merge pull request #13 again, by hand', 'c');   // a number twice is one pull request
    const run = (args) => git(...args);
    assert.deepEqual(pullRequestsSince('app-v0.1.1', run), [13, 15, 14, 12]);
    assert.deepEqual(pullRequestsSince(null, () => { throw new Error('never asked'); }), []);
    git('tag', 'app-v0.1.2');
    assert.deepEqual(pullRequestsSince('app-v0.1.2', run), [], 'nothing since the release that is HEAD');
  } finally { rmSync(repo, { recursive: true, force: true }); }
});

test('REL6: only a merged pull request the repository\'s own people opened brings notes, capped; a 404 is none, any other failure stops the notes', () => {
  const subjects = ['Merge pull request #5: outside', 'Merge pull request #4: big', 'Merge pull request #3: open', 'Merge pull request #2: gone', 'Merge pull request #1: ours'].join('\n');
  const run = (args) => {
    assert.deepEqual(args, ['log', '--first-parent', '--format=%s', 'app-v0.1.1..HEAD']);
    return subjects;
  };
  const notes = (title, line) => `## Patch notes: ${title}\n\n- ${line}\n\n## Verification\n- tests`;
  const big = `## Patch notes: Big\n\n${Array.from({ length: 4000 }, (_, i) => `- Line ${i} of a very long list of changes.`).join('\n')}`;
  const prs = {
    5: { merged_at: '2026-10-01T10:00:00Z', author_association: 'CONTRIBUTOR', user: { login: 'someone' }, body: notes('Theirs', 'a stranger\'s words') },
    4: { merged_at: '2026-10-01T09:00:00Z', author_association: 'COLLABORATOR', body: big },
    3: { merged_at: null, author_association: 'OWNER', body: notes('Open', 'never merged') },
    1: { merged_at: '2026-10-01T08:00:00Z', author_association: 'OWNER', body: notes('Ours', 'the owner\'s words') },
  };
  const asked = [], said = [];
  const api = (path) => { asked.push(path); return prs[path.split('/').pop()] ?? null; };
  const got = pullRequestNotesSince('app-v0.1.1', { run, api, repo: 'o/r', log: (line) => said.push(line) });
  assert.deepEqual(asked, ['repos/o/r/pulls/5', 'repos/o/r/pulls/4', 'repos/o/r/pulls/3', 'repos/o/r/pulls/2', 'repos/o/r/pulls/1']);
  assert.deepEqual(got.map((x) => x.pr), [4, 1], 'newest first; the outsider\'s, the unmerged and the missing bring none');
  assert.ok(got[0].text.startsWith('# Patch Notes: Big\n\n- Line 0 ') && got[0].text.length <= NOTES_MAX && got[0].text.length > NOTES_MAX - 100,
    `capped at NOTES_MAX (${got[0].text.length} of ${big.length})`);
  assert.match(got[0].text.trimEnd().split('\n').pop(), /^- Line \d+ of a very long list of changes\.$/, 'cut at a line');
  assert.equal(got[1].text, '# Patch Notes: Ours\n\n- the owner\'s words');
  assert.deepEqual(NOTES_AUTHORS, ['OWNER', 'MEMBER', 'COLLABORATOR']);
  assert.equal(said.length, 3, 'the log says why each of the others brought none');
  assert.match(said.join('\n'), /#5 was opened by someone \(CONTRIBUTOR\)/);
  assert.match(said.join('\n'), /#3 is no merged pull request in o\/r/);
  assert.match(said.join('\n'), /#2 is no merged pull request in o\/r/);
  // gh api: a 404 is no such pull request; anything else is thrown - never read as "no notes"
  const failing = (stderr) => () => { const e = new Error('Command failed'); e.stderr = stderr; throw e; };
  assert.equal(githubApi('repos/o/r/pulls/9', failing('gh: Not Found (HTTP 404)\n')), null);
  assert.throws(() => githubApi('repos/o/r/pulls/9', failing('gh: Server Error (HTTP 502)\n')), /Command failed/);
  let call;
  assert.deepEqual(githubApi('repos/o/r/pulls/1', (cmd, args) => { call = [cmd, ...args]; return '{"number":1}'; }), { number: 1 });
  assert.deepEqual(call, ['gh', 'api', 'repos/o/r/pulls/1']);
});

test('REL6: the notes command, spawned as the publish job spawns it - the pull requests\' notes off gh, newest first; a read that fails publishes nothing', { skip: process.platform === 'win32' && 'a shell script stands in for gh' }, () => {
  const repo = mkdtempSync(join(tmpdir(), 'rel6-cli-'));
  const bin = mkdtempSync(join(tmpdir(), 'rel6-gh-'));
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
    for (const [pr, branch] of [[7, 'sea'], [8, 'pause']]) {
      git('checkout', '-q', '-b', branch);
      commit(`${branch} work`);
      git('checkout', '-q', 'main');
      git('merge', '--no-ff', '-q', '-m', `Merge pull request #${pr} from o/${branch}`, branch);
    }
    git('tag', 'app-v0.1.2');   // the tag being cut is HEAD's own - never its own "previous"
    // gh as the runner has it: `gh api repos/o/r/pulls/<n>` answered from <n>.json beside it
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
    writeFileSync(join(bin, '7.json'), JSON.stringify({ merged_at: 'x', author_association: 'OWNER', body: '## Patch notes: The Sea\r\n\r\n- Boats.\r\n' }));
    writeFileSync(join(bin, '8.json'), JSON.stringify({ merged_at: 'x', author_association: 'MEMBER', body: '## Patch notes: The Pause Key\n\n- Pause.\n\n## Verification\n- ok' }));
    const env = { ...process.env, PATH: `${bin}:${process.env.PATH}`, GITHUB_REPOSITORY: 'o/r' };
    const notes = () => spawnSync(process.execPath, [script, 'notes', 'app-v0.1.2'], { cwd: repo, env, encoding: 'utf8' });
    const ok = notes();
    assert.equal(ok.status, 0, ok.stderr);
    assert.equal(ok.stdout, '# Patch Notes: The Pause Key\n\n- Pause.\n\n# Patch Notes: The Sea\n\n- Boats.\n');
    writeFileSync(join(bin, 'fail'), '');
    const down = notes();
    assert.equal(down.status, 1, 'GitHub down: the step fails, and the release waits for a re-run');
    assert.equal(down.stdout, '', 'nothing reaches release-notes.md');
    assert.match(down.stderr, /the notes could not be read - nothing is published: gh: Server Error \(HTTP 502\)/);
  } finally {
    rmSync(repo, { recursive: true, force: true });
    rmSync(bin, { recursive: true, force: true });
  }
});

test('REL6: patch notes live on the pull request - no file in the tree is one, and the template asks for them where the release reads them', () => {
  for (const p of ['PATCH-NOTES-Boats-on-the-Compass.md', 'docs/patch-notes/v1.md', 'PatchNotes.md', 'notes/patch_notes.txt', 'Release Patch Notes 1.2.md']) {
    assert.match(p, PATCH_NOTES_PATH_RE, `${p} is patch notes`);
  }
  for (const p of ['test/rel4_release.test.js', 'app/launcher/launcher.js', 'src/ui/patchNotesPanel.js', 'dispatch-notes.md', 'test/fixtures/notes/sea.md']) {
    assert.doesNotMatch(p, PATCH_NOTES_PATH_RE, `${p} is not`);
  }
  // the index AND what is on disk but not yet added: a notes file written and not yet `git add`ed fails here, not first in CI
  const root = fileURLToPath(new URL('..', import.meta.url));
  const files = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 26 })
    .split('\0').filter(Boolean);
  assert.ok(files.length > 1000, `the sweep read the tree (${files.length} files)`);
  assert.deepEqual(files.filter((p) => PATCH_NOTES_PATH_RE.test(p)), [],
    'patch notes go in the pull request\'s description, under "## Patch notes" (.github/pull_request_template.md) - the release reads them there, and the tree keeps none');
  const template = rd('.github/pull_request_template.md');
  assert.equal(patchNotesOf(template), '', 'the template as it stands is no notes - its guidance is a comment');
  assert.equal(patchNotesOf(template.replace(/^## Patch notes$/m, '## Patch notes: The Sea\n\n- Boats.')), '# Patch Notes: The Sea\n\n- Boats.',
    'filled in, its section is the notes, and the template\'s next section ends them');
});
