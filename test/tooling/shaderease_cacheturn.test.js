// SHADER-EASE CACHE-TURN (app/lib/gpuCacheTurn.cjs): after an update the shell deletes Chromium's GPU caches before
// they open, so a launch does not read the dead programs of the version before. Driven on a temp userData; the
// shell's wiring is pinned by source (it runs in Electron), as GPU-CACHE's is.
//
//   SEC1  the same version keeps every cache        SEC2  a new version clears them all and records it
//   SEC3  no record (first launch) clears once      SEC4  missing folders and an unreadable record are fine
//   SEC5  an rm that throws is logged, never thrown, and leaves the record for the next launch to try again
//   SEC6  main.cjs turns the cache once, by the one instance, before ready, keyed on the shell's and the game's version
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { join, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { CACHE_DIRS, RECORD_NAME, recordedVersion, turnGpuCache } = require('../../app/lib/gpuCacheTurn.cjs');

const roots = [];
afterEach(() => { while (roots.length) fs.rmSync(roots.pop(), { recursive: true, force: true }); });
/** A userData folder holding every cache with a kept program in it, and `recorded` as the last turn's version. */
function userData(recorded) {
  const root = fs.mkdtempSync(join(tmpdir(), 'cacheturn-'));
  roots.push(root);
  for (const d of CACHE_DIRS) { fs.mkdirSync(join(root, d, 'index-dir'), { recursive: true }); fs.writeFileSync(join(root, d, 'data_1'), 'kept'); }
  if (recorded !== undefined) fs.writeFileSync(join(root, RECORD_NAME), JSON.stringify({ version: recorded }));
  return root;
}
const present = (root) => CACHE_DIRS.filter((d) => fs.existsSync(join(root, d)));
const quiet = () => {};

test('SEC0: the caches named are Electron 42\'s three a partition opens and the reserved ones older and newer builds left', () => {
  for (const d of ['GPUCache', 'GrShaderCache', 'ShaderCache', 'DawnWebGPUCache', 'DawnGraphiteCache']) assert.ok(CACHE_DIRS.includes(d), d);
});

test('SEC1: the version recorded is the one played - every cache is kept, the record untouched', () => {
  const root = userData('0.9.0/0.9.2');
  const did = turnGpuCache({ userData: root, version: '0.9.0/0.9.2', log: quiet });
  assert.deepEqual(did, { turned: false, from: '0.9.0/0.9.2', failed: [] });
  assert.deepEqual(present(root), CACHE_DIRS);
  assert.equal(fs.readFileSync(join(root, CACHE_DIRS[0], 'data_1'), 'utf8'), 'kept');
});

test('SEC2: a new version (the game\'s or the shell\'s) clears every cache, then records it - the next launch keeps them', () => {
  const root = userData('0.9.0/0.9.2');
  assert.deepEqual(turnGpuCache({ userData: root, version: '0.9.0/0.9.3', log: quiet }), { turned: true, from: '0.9.0/0.9.2', failed: [] });
  assert.deepEqual(present(root), []);
  assert.equal(recordedVersion(root), '0.9.0/0.9.3');
  assert.deepEqual(fs.readdirSync(root), [RECORD_NAME], 'only the record is left');
  fs.mkdirSync(join(root, 'GPUCache'));
  assert.equal(turnGpuCache({ userData: root, version: '0.9.0/0.9.3', log: quiet }).turned, false);
  assert.ok(fs.existsSync(join(root, 'GPUCache')), 'the new version\'s own programs are kept');
});

test('SEC2b: what else lives in userData is never touched', () => {
  const root = userData('a');
  fs.mkdirSync(join(root, 'Saves', 'SAVE0'), { recursive: true });
  fs.writeFileSync(join(root, 'config.json'), '{}');
  turnGpuCache({ userData: root, version: 'b', log: quiet });
  assert.ok(fs.existsSync(join(root, 'Saves', 'SAVE0')) && fs.existsSync(join(root, 'config.json')));
});

test('SEC3: no record (the first launch with the turn) clears once and records', () => {
  const root = userData();
  assert.deepEqual(turnGpuCache({ userData: root, version: '1/1', log: quiet }), { turned: true, from: null, failed: [] });
  assert.deepEqual(present(root), []);
  assert.equal(recordedVersion(root), '1/1');
});

test('SEC4: missing folders, a userData not made yet, and an unreadable record are all fine', () => {
  const root = fs.mkdtempSync(join(tmpdir(), 'cacheturn-'));
  roots.push(root);
  assert.equal(turnGpuCache({ userData: root, version: 'v', log: quiet }).turned, true);
  const fresh = join(root, 'not-yet');
  assert.equal(turnGpuCache({ userData: fresh, version: 'v', log: quiet }).turned, true);
  assert.equal(recordedVersion(fresh), 'v');
  fs.writeFileSync(join(root, RECORD_NAME), '{not json');
  assert.equal(recordedVersion(root), null);
  fs.writeFileSync(join(root, RECORD_NAME), JSON.stringify({ version: 7 }));
  assert.equal(recordedVersion(root), null);
});

test('SEC5: an rm that throws (a file held open) is logged, never thrown out, and the record is left for the next launch', () => {
  const root = userData('old');
  const logged = [];
  const locked = { ...fs, rmSync: (p, o) => { if (basename(p) === 'GPUCache') throw new Error('EBUSY: resource busy or locked'); return fs.rmSync(p, o); } };
  const did = turnGpuCache({ userData: root, version: 'new', fs: locked, log: (...a) => logged.push(a.join(' ')) });
  assert.deepEqual(did, { turned: false, from: 'old', failed: ['GPUCache'] });
  assert.deepEqual(present(root), ['GPUCache'], 'the others are cleared all the same');
  assert.equal(recordedVersion(root), 'old', 'not recorded: the next launch tries again');
  assert.equal(logged.length, 1);
  assert.match(logged[0], /^\[gpu\] GPUCache could not be cleared.*EBUSY/);
  // and a record that cannot be written is logged too
  const noWrite = { ...fs, writeFileSync: () => { throw new Error('EPERM'); } };
  assert.doesNotThrow(() => turnGpuCache({ userData: root, version: 'new', fs: noWrite, log: (...a) => logged.push(a.join(' ')) }));
  assert.match(logged[1], /^\[gpu\] the cache turn could not be recorded: EPERM/);
});

test('SEC6: main.cjs opens the game store and turns the cache once, by the one instance, before ready - keyed on the shell and the game it plays', () => {
  const main = fs.readFileSync(new URL('../../app/main.cjs', import.meta.url), 'utf8').replace(/^\s*\/\/.*$/gm, '');
  const wire = "\nif (isSingleInstance) { openGame(); turnGpuCache({ userData: app.getPath('userData'), version: `${app.getVersion()}/${gameVersion()}` }); }";
  assert.equal(main.split(wire).length, 2, 'wired once, as written');
  assert.equal([...main.matchAll(/turnGpuCache\(/g)].length, 1);
  const at = main.indexOf(wire);
  assert.ok(at > main.indexOf('\nconst isSingleInstance = app.requestSingleInstanceLock();'), 'after the lock - a second instance never clears under the first');
  assert.ok(at > main.indexOf('\nconst gameVersion = () =>'), 'after the game\'s version can be read');
  assert.ok(at < main.indexOf('\napp.whenReady()'), 'before ready, before Chromium opens the caches');
});
