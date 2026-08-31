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
