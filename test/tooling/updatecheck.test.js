// DA6: the update notice. The compare is pure (app/lib/updateCheck.cjs)
// and its laws are pinned here; the shell's wiring is source-pinned so
// the notice cannot quietly become a nag (wrong-newer), a phantom
// (string compare), or a probe that hits the network.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { parseReleaseTag, parseVersion, isNewerRelease } = require('../../app/lib/updateCheck.cjs');
const root = path.join(path.dirname(new URL(import.meta.url).pathname), '..', '..');

test('DA6/REL1/REL3: the release\'s number is ONE variable - the tag and the stamp both read it, and the committed version is only the base', () => {
  // THE NAG THIS FILE EXISTS TO PREVENT: app-v0.1.3 was cut from a
  // marker bumped alone, named for one version and stamped with the
  // last, so every fresh install announced an update it already had.
  // REL1 gated the two files together. REL3 (Mac: "auto push a release
  // on each merge") removed the second file: the version is DERIVED in
  // the workflow - MAJOR.MINOR from app/package.json's committed base,
  // PATCH from the commit count on main - into one shell variable, and
  // both the release tag and the `npm version` stamp electron-builder
  // bakes in read that variable. There is no second number to drift.
  const wf = fs.readFileSync(path.join(root, '.github/workflows/release-desktop.yml'), 'utf8');
  assert.match(wf, /TAG="app-v\$\{BASE\}\.\$\(git rev-list --count HEAD\)"/, 'a main push derives the tag from the base and the commit count');
  assert.match(wf, /BASE=\$\(node -p "require\('\.\/app\/package\.json'\)\.version\.split\('\.'\)\.slice\(0,2\)\.join\('\.'\)"\)/, 'the base is the committed MAJOR.MINOR');
  // AUDIT INSTALL L1-5: the tag is app-v<n>.<n>.<n> EXACTLY or the run fails - a tag name can carry quotes and `$`
  assert.ok(wf.includes('if [ -n "$TAG" ] && ! [[ "$TAG" =~ ^app-v[0-9]+\\.[0-9]+\\.[0-9]+$ ]]; then'), 'the tag is held to its shape before anything reads it');
  assert.ok(wf.includes('VERSION="${TAG#app-v}"'), 'the version IS the tag, less its prefix');
  // REL4: resolved ONCE, by the `version` job, whose outputs ARE the step's - every leg and the publish job read them
  assert.match(wf, /\n  version:\n[\s\S]*?outputs:\n\s+tag: \$\{\{ steps\.reltag\.outputs\.tag \}\}\n\s+version: \$\{\{ steps\.reltag\.outputs\.version \}\}/, 'the version job hands the one number on');
  // AUDIT INSTALL R2-B1: and in bash - on the Windows leg a step with no shell is PowerShell, where "$VERSION" is unset
  assert.match(wf, /shell: bash\n\s+env:\n\s+VERSION: \$\{\{ needs\.version\.outputs\.version \}\}\n\s+run: npm version "\$VERSION" --no-git-tag-version --allow-same-version/,
    'the stamp reads the same output - from the environment, never pasted into the script, in a shell that reads it on every leg');
  assert.match(wf, /tag_name: \$\{\{ needs\.version\.outputs\.tag \}\}/, 'the release is cut at the same output');
  // REL4: in the job that COUNTS - the publish job's own full checkout (for the notes' diff) must not stand in for it
  const versionJob = wf.slice(wf.indexOf('\n  version:\n'), wf.indexOf('\n  gate:\n'));
  assert.match(versionJob, /fetch-depth: 0   # REL3: the version is the commit count, which needs the whole history/, 'the count needs the whole history');
  assert.ok(!fs.existsSync(path.join(root, '.github/DESKTOP_RELEASE')), 'the marker file is retired - a second number is a drift waiting to happen');
  assert.doesNotMatch(wf, /DESKTOP_RELEASE/, 'and nothing reads it');
  // the committed version is the BASE: CI owns the patch, so it is 0 here
  const appVersion = JSON.parse(fs.readFileSync(path.join(root, 'app/package.json'), 'utf8')).version;
  assert.match(appVersion, /^\d+\.\d+\.0$/, `app/package.json carries the base MAJOR.MINOR.0, not a hand-bumped patch (${appVersion})`);
  // ...and the derived shape is one this file's own parser takes, newer than anything hand-cut
  const derived = `app-v${appVersion.split('.').slice(0, 2).join('.')}.960`;
  assert.deepEqual(parseReleaseTag(derived), [0, 1, 960]);
  assert.equal(isNewerRelease('0.1.5', derived), true, 'a commit-count patch outranks every hand-cut release');
  assert.equal(isNewerRelease('0.1.960', derived), false, 'a build of this very release must not nag');
  // every main push is a release: no paths filter narrows the door, and runs queue rather than cancel
  const on = wf.slice(wf.indexOf('\non:'), wf.indexOf('\npermissions:'));
  assert.match(on, /branches:\n\s+- main\n/, 'main pushes cut releases');
  assert.doesNotMatch(on, /paths:/, 'every merge, not a marker');
  // a release half uploaded is worse than one late - and AUDIT INSTALL L3-6: main pushes share one group (the newest
  // waiting merge is cut next), while a manual door is a group of its own that no merge cancels
  assert.match(wf, /concurrency:\n  group: \$\{\{ github\.event_name == 'push' && github\.ref == 'refs\/heads\/main' && 'release-desktop-main' \|\| format\('release-desktop-\{0\}', github\.run_id\) \}\}\n  cancel-in-progress: false/,
    'a release half uploaded is worse than one late');
});

test('DA6: only the app-v shape release-desktop cuts parses as a release tag', () => {
  assert.deepEqual(parseReleaseTag('app-v0.1.0'), [0, 1, 0]);
  assert.deepEqual(parseReleaseTag(' app-v12.34.56 '), [12, 34, 56]);
  // A site tag, a bare semver, a prerelease, garbage, nothing - none
  // of these may ever read as an update.
  for (const bad of ['v0.2.0', '0.2.0', 'app-v0.2', 'app-v0.2.0-rc1', 'app-v0.2.0.1', '', null, undefined, 'app-vX.Y.Z']) {
    assert.equal(parseReleaseTag(bad), null, `${bad} must not parse`);
  }
  assert.deepEqual(parseVersion('0.1.0'), [0, 1, 0]);
  assert.equal(parseVersion('0.1'), null);
});

test('DA6: newer is a NUMERIC per-part compare - 0.10.0 beats 0.9.9', () => {
  assert.equal(isNewerRelease('0.1.0', 'app-v0.1.1'), true);
  assert.equal(isNewerRelease('0.1.0', 'app-v0.2.0'), true);
  assert.equal(isNewerRelease('0.1.0', 'app-v1.0.0'), true);
  assert.equal(isNewerRelease('0.9.9', 'app-v0.10.0'), true, 'the string-compare trap');
  assert.equal(isNewerRelease('0.10.0', 'app-v0.9.9'), false);
  assert.equal(isNewerRelease('1.0.0', 'app-v0.9.9'), false, 'a major behind loses whatever the tail says');
});

test('DA6: equal and unparseable are NOT newer - the failure direction is silence', () => {
  assert.equal(isNewerRelease('0.1.0', 'app-v0.1.0'), false, 'equal never nags');
  assert.equal(isNewerRelease('0.1.0', 'garbage'), false);
  assert.equal(isNewerRelease('garbage', 'app-v9.9.9'), false);
  assert.equal(isNewerRelease(undefined, undefined), false);
});

test('DA6: the wiring pins - one API, two gates, and probes never touch the network', () => {
  const main = fs.readFileSync(path.join(root, 'app', 'main.cjs'), 'utf8');
  // ONE read-only API, the repo's own - the app's only network use of
  // its own, and the landing page's honesty line depends on it staying
  // that. DA8 added the same API's recent-release LIST - since DA10 asked
  // at every launch, beside the check and behind its two gates, for the
  // launcher's news panel; still read-only, still the repo's releases,
  // still nothing else.
  assert.ok(main.includes("'https://api.github.com/repos/Lattymoy/daggerfall-js-source/releases/latest'"),
    'the check asks the releases API');
  const apis = [...main.matchAll(/'(https:\/\/api\.github\.com\/[^']*)'/g)].map((m) => m[1]).sort();
  assert.deepEqual(apis, [
    'https://api.github.com/repos/Lattymoy/daggerfall-js-source/releases/latest',
    'https://api.github.com/repos/Lattymoy/daggerfall-js-source/releases?per_page=20',
  ], 'and nothing else');
  assert.equal((main.match(/net\.fetch\(RELEASES_LATEST_API/g) ?? []).length, 1);
  assert.equal((main.match(/net\.fetch\(RELEASES_LIST_API/g) ?? []).length, 1);
  const fetches = [...main.matchAll(/net\.fetch\(([^,]+),/g)].map((m) => m[1].trim()).sort();
  // PIN MOVED: DA13 - and the game's own channel: a release's game manifest and ranges of its pack, through ONE door
  // that takes nothing but this repository's own release downloads (gameFetch's `url`)
  assert.deepEqual(fetches, ['RELEASES_LATEST_API', 'RELEASES_LIST_API', 'pathToFileURL(p).toString()', 'url'], 'every fetch the shell makes is one of those, or a file on disk');
  const door = main.slice(main.indexOf('function gameFetch(url, init) {'), main.indexOf('async function fetchPackRange('));
  assert.match(door, /if \(typeof url !== 'string' \|\| !url\.startsWith\(`\$\{RELEASES_URL\}\/download\/`\)\) return Promise\.reject\(/, 'the release\'s own download links, and nothing else');
  assert.match(door, /return net\.fetch\(url, init\);/);
  assert.equal((main.match(/net\.fetch\(url, init\)/g) ?? []).length, 1, 'the one door');
  assert.equal(require('../../app/lib/downloads.cjs').RELEASES_URL, 'https://github.com/Lattymoy/daggerfall-js-source/releases');
  // The two gates on the launch check: the config checkbox (default
  // ON, off is `updateCheck: false`) and the probe env.
  assert.match(main, /loadConfig\(\)\.updateCheck !== false && !process\.env\.DAGGER_NO_UPDATE_CHECK/,
    'launch check honours the checkbox and the probe env');
  // DA8: the launch check is the LAUNCHER's, and silent - an error is "offline" (AUDIT INSTALL L2-1: or, under a
  // download, "failed") and the player plays on
  // AUDIT INSTALL R2-A2: the CHECK's own promise says it - the error event cannot tell a check's failure from a download's
  assert.match(main, /askUpdater\(\)\s*\.then\(\(r\) => \{ if \(!r\) launcherDispatch\(\{ type: 'check-failed' \}\); \}\)\s*\.catch\(\(\) => launcherDispatch\(\{ type: 'check-failed' \}\)\);/, 'and the launch check is the silent one');
  // The probe sets the env, so a green probe never depended on GitHub.
  const probe = fs.readFileSync(path.join(root, 'tools', 'appShellProbe.mjs'), 'utf8');
  assert.match(probe, /DAGGER_NO_UPDATE_CHECK: '1'/, 'the shell probe opts out of the check');
  // Download opens the BROWSER - no download or code application here.
  assert.match(main, /if \(response === 0\) shell\.openExternal\(latest\.download\);/,
    'the notice hands the player their browser, never bytes');
});
