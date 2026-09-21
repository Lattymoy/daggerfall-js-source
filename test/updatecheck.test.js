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
const { parseReleaseTag, parseVersion, isNewerRelease } = require('../app/lib/updateCheck.cjs');
const root = path.join(path.dirname(new URL(import.meta.url).pathname), '..');

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
  assert.match(wf, /case "\$TAG" in app-v\*\) VERSION="\$\{TAG#app-v\}" ;;/, 'the version IS the tag, less its prefix');
  assert.match(wf, /npm version "\$\{\{ steps\.reltag\.outputs\.version \}\}" --no-git-tag-version --allow-same-version/, 'the stamp reads the same output');
  assert.match(wf, /tag_name: \$\{\{ steps\.reltag\.outputs\.tag \}\}/, 'the release is cut at the same output');
  assert.match(wf, /fetch-depth: 0/, 'the count needs the whole history');
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
  assert.match(wf, /concurrency:\n  group: release-desktop\n  cancel-in-progress: false/, 'a release half uploaded is worse than one late');
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
  // ONE read-only endpoint, the repo's own - the app's single network
  // call of its own, and the landing page's honesty line depends on it
  // staying single.
  assert.ok(main.includes("'https://api.github.com/repos/Lattymoy/daggerfall-js-source/releases/latest'"),
    'the check asks the releases API and nothing else');
  assert.equal((main.match(/net\.fetch\(RELEASES_LATEST_API/g) ?? []).length, 1);
  // The two gates on the launch check: the config checkbox (default
  // ON, off is `updateCheck: false`) and the probe env.
  assert.match(main, /loadConfig\(\)\.updateCheck !== false && !process\.env\.DAGGER_NO_UPDATE_CHECK/,
    'launch check honours the checkbox and the probe env');
  assert.match(main, /checkForUpdates\(\{ silent: true \}\)/, 'and the launch check is the silent one');
  // The probe sets the env, so a green probe never depended on GitHub.
  const probe = fs.readFileSync(path.join(root, 'tools', 'appShellProbe.mjs'), 'utf8');
  assert.match(probe, /DAGGER_NO_UPDATE_CHECK: '1'/, 'the shell probe opts out of the check');
  // Download opens the BROWSER - no download or code application here.
  assert.match(main, /if \(response === 0\) shell\.openExternal\(latest\.url\);/,
    'the notice hands the player their browser, never bytes');
});
