// MWNPC3 (2026-10-09, the MW-NPC arc's third slice - bible/04-Characters/Morrowind-NPCs.md section 8): WHAT A BODY
// COSTS TO BUILD AND HOLD, SHARED. Every build copied each mesh's bytes out of its archive and parsed the copy - a
// fresh copy a build, so the parse memo never met a mesh twice; every mesh uploaded its own GL copy of every texture it
// wore; every peer's body swept its first-person reach over every clip it would never be looked out of; and every
// PeerBodies instance stood under the module's eight. A mesh's bytes are copied ONCE per archive now (nifBytes) and
// its parse serves every body; a texture is acquired by the image it uploads and held by every range that wears it;
// a rig never looked out of builds without the sweep; and an instance takes its own limits.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createFpArm, nifBytes, NIF_COPY_CAP, nifParseCount, acquireCharacterTexture, releaseCharacterTexture } from '../src/combat/fpArm.js';
import { PeerBodies, peerBuildOpts, BODIES_MAX } from '../src/net/peerBodies.js';
import { fixtureBodyDeps, countingRenderer } from './fixtures/mw/bodyRig.mjs';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const flush = () => new Promise((r) => setTimeout(r, 0));
const settle = async (n = 8) => { for (let i = 0; i < n; i++) await flush(); };
const cam = () => ({ pos: [0, 0, 0], yaw: 0, pitch: 0, move: { forward: 0, speed: 0, grounded: true } });

/** the deps with ONE set of archive objects, as dataSource.js's loadMorrowindArchives answers a data generation's (its
 *  _mwArchiveCache) - the fixture's own mints a fresh archive object at every ask */
function stableDeps() {
  const d = fixtureBodyDeps();
  let archives = null;
  return { ...d, loadMorrowindArchives: async () => (archives ??= await d.loadMorrowindArchives()) };
}

test('MWNPC3a one parse a mesh: a second body built from the same archives parses nothing - every mesh it wears is the first body\'s parse', async () => {
  const deps = stableDeps();
  const one = createFpArm(); one.attach(countingRenderer(), cam);
  const before = nifParseCount();
  assert.equal((await one.build({ race: 'fprace', deps })).ok, true);
  const first = nifParseCount() - before;
  assert.ok(first >= 3, `the first body parses its meshes (${first})`);
  const two = createFpArm(); two.attach(countingRenderer(), cam);
  const mid = nifParseCount();
  assert.equal((await two.build({ race: 'fprace', deps })).ok, true);
  assert.equal(nifParseCount() - mid, 0, 'the second body parses none - the archives\' copies are the first body\'s, and so are their parses');
  // a build on OTHER archives is other bytes: its own parse
  const three = createFpArm(); three.attach(countingRenderer(), cam);
  const late = nifParseCount();
  assert.equal((await three.build({ race: 'fprace', deps: stableDeps() })).ok, true);
  assert.equal(nifParseCount() - late, first, 'a fresh set of archives is parsed afresh');
});

test('MWNPC3b the copies: one per archive and path, the same object every ask, a missing path undefined, and the oldest let go past the cap (an ask refreshes)', () => {
  const made = new Map();
  const arc = { get: (p) => (p.startsWith('missing') ? undefined : (made.has(p) ? made.get(p) : made.set(p, Uint8Array.from([1, 2, 3])).get(p))) };
  const a = nifBytes(arc, 'meshes/a.nif');
  assert.equal(nifBytes(arc, 'meshes/a.nif'), a, 'the same copy');
  assert.notEqual(a, arc.get('meshes/a.nif'), 'a copy, never the archive\'s own bytes');
  assert.deepEqual([...a], [1, 2, 3]);
  assert.equal(nifBytes(arc, 'missing.nif'), undefined);
  assert.equal(nifBytes(null, 'meshes/a.nif'), undefined);
  const other = { get: arc.get };
  assert.notEqual(nifBytes(other, 'meshes/a.nif'), a, 'another archive, another copy');
  for (let i = 0; i < NIF_COPY_CAP; i++) {
    nifBytes(arc, `meshes/fill${i}.nif`);
    if (i === NIF_COPY_CAP - 10) assert.equal(nifBytes(arc, 'meshes/a.nif'), a, 'asked again before the cap: refreshed');
  }
  assert.equal(nifBytes(arc, 'meshes/a.nif'), a, 'the refreshed one is kept');
  const firstFill = nifBytes(arc, 'meshes/fill0.nif');
  const again = nifBytes(arc, 'meshes/fill0.nif');
  assert.equal(firstFill, again);
  nifBytes(arc, 'meshes/fill1.nif');   // one of the oldest, let go when fill0 came back in its place
  const fresh = (() => { for (let i = 0; i < NIF_COPY_CAP + 2; i++) nifBytes(arc, `meshes/more${i}.nif`); return nifBytes(arc, 'meshes/a.nif'); })();
  assert.notEqual(fresh, a, 'past the cap the oldest copy is let go - a later ask copies again');
});

test('MWNPC3c one GL texture a picture: the first range makes it, every later range holds it, a different wrap is its own, and the last hold deletes it', () => {
  const deleted = [];
  let made = 0;
  const renderer = { gl: { deleteTexture: (t) => deleted.push(t) }, createCharacterTexture: (mips, wrap) => ({ mips, wrap, n: ++made }) };
  const mips = [{ width: 1, height: 1, rgba: new Uint8Array(4) }];
  const clamp = { wrapS: 0x812f, wrapT: 0x812f }, repeat = { wrapS: 0x2901, wrapT: 0x2901 };
  const a = acquireCharacterTexture(renderer, mips, clamp);
  const b = acquireCharacterTexture(renderer, mips, { ...clamp });
  assert.equal(a, b, 'the same picture under the same wrap: one texture');
  assert.equal(made, 1);
  const c = acquireCharacterTexture(renderer, mips, repeat);
  assert.notEqual(c, a, 'another wrap is another texture');
  const d = acquireCharacterTexture(renderer, [{ ...mips[0] }], clamp);
  assert.notEqual(d, a, 'another picture is another texture');
  const other = { ...renderer, createCharacterTexture: renderer.createCharacterTexture };
  assert.notEqual(acquireCharacterTexture(other, mips, clamp), a, 'and another renderer its own');
  assert.equal(releaseCharacterTexture(renderer, a), false, 'one hold let go: still held');
  assert.deepEqual(deleted, []);
  assert.equal(releaseCharacterTexture(renderer, b), true, 'the last hold: deleted');
  assert.deepEqual(deleted, [a]);
  assert.equal(releaseCharacterTexture(renderer, a), true, 'a texture no longer held is not ours: deleted as before');
  const e = acquireCharacterTexture(renderer, mips, clamp);
  assert.notEqual(e, a, 'asked again after the last hold went: made again');
  // the rig hangs and lets go through these two, and nothing else makes or deletes a range's texture
  const arm = rd('src/combat/fpArm.js');
  assert.ok(arm.includes('r.tex = acquireCharacterTexture(renderer,'), 'hangRangeTextures acquires');
  assert.ok(arm.includes('for (const r of m.ranges || []) if (r.tex) { releaseCharacterTexture(renderer, r.tex); r.tex = null; }'), 'releaseGpu lets go');
  assert.equal((arm.match(/renderer\.createCharacterTexture\(/g) || []).length, 2, 'the acquire and the particle effect\'s own (MAC-Q) make textures - no range texture is made past the acquire');
});

test('MWNPC3d a rig never looked out of builds without the reach sweep - the peers, the family and the card table; the player\'s arm still sweeps', async () => {
  assert.equal(peerBuildOpts({ race: 'Breton' }).reachSweep, false, 'every peer-lane build');
  const swept = createFpArm(); swept.attach(countingRenderer(), cam);
  const plain = createFpArm(); plain.attach(countingRenderer(), cam);
  assert.equal((await swept.build({ race: 'fprace', deps: fixtureBodyDeps() })).ok, true);
  assert.equal((await plain.build({ race: 'fprace', deps: fixtureBodyDeps(), reachSweep: false })).ok, true);
  const rs = swept.status(), rp = plain.status();
  assert.ok(rs.reach > 0 && rp.reach > 0, 'both have a reach');
  assert.equal(rp.reach, rp.idleReach, 'no sweep: the far plane takes the idle\'s reach');
  assert.notEqual(rs.reach, rs.idleReach, 'the player\'s arm still sweeps every clip (the fixture\'s sweep and idle differ)');
  assert.equal(rp.idleReach, rs.idleReach, 'and the idle\'s reach is the same either way');
  assert.equal(plain.status().third.ok, true, 'and the body stands');
});

/** a rig that records its steps (peercadence.test.js's) */
const recording = (rigs) => () => {
  const r = { mode: 'first', steps: [], skinned: false,
    attach() {}, async build(opts) { r.opts = opts; await flush(); return { ok: true }; },
    canThirdPerson: () => true, raceHeightScale: () => 1, setViewMode(m) { r.mode = m; return true; },
    thirdActive: () => r.mode === 'third' && r.skinned,
    update(dt, opts) { r.steps.push({ dt, ...(opts ?? {}) }); if (opts?.pose !== false) r.skinned = true; },
    drawThird() { return r.thirdActive(); }, unload() {} };
  rigs.push(r);
  return r;
};
const peer = (id, z) => ({ id, name: id, told: true, look: { race: id, gender: 'male', faceIndex: 0, items: [] }, shown: { x: 0, y: 0, z, yaw: 0, pitch: 0, mv: 0, wd: 0, an: 0, as: 0, cn: 0 } });
const toScene = (p) => [p.x, p.y, p.z];

test('MWNPC3e an instance takes its own limits - the most bodies, the range, the skins a frame - and an instance given none keeps the module\'s', async () => {
  const rigs = [];
  const pb = new PeerBodies({ renderer: {}, createRig: recording(rigs), buildOpts: (look) => ({ race: look.race }), now: () => 1000, limits: { max: 3, range: 20, skinBudget: 1, spareMax: 0 } });
  const crowd = Array.from({ length: 6 }, (_, i) => peer(`p${i}`, -2 - i));
  for (let i = 0; i < 12; i++) { pb.sync(crowd, toScene, 1 / 60, [0, 0, 0]); await settle(); }
  assert.equal(rigs.length, 3, 'three bodies, not eight');
  assert.deepEqual(crowd.filter((p) => pb.has(p.id)).map((p) => p.id), ['p0', 'p1', 'p2'], 'the nearest three');
  for (const r of rigs) r.steps.length = 0;
  pb.sync(crowd, toScene, 1 / 60, [0, 0, 0]);
  const posed = rigs.filter((r) => r.steps.some((s) => s.pose !== false)).length;
  assert.equal(posed, 1, 'one skin a frame');
  // the range: a body past 20 sleeps
  const far = crowd.map((p, i) => (i === 0 ? { ...p, shown: { ...p.shown, z: -25 } } : p));
  pb.sync(far, toScene, 1 / 60, [0, 0, 0]);
  assert.equal(pb.has('p0'), false, 'past its range the body sleeps');
  // and a plain instance stands the module's eight
  const rigs2 = [];
  const plain = new PeerBodies({ renderer: {}, createRig: recording(rigs2), buildOpts: (look) => ({ race: look.race }), now: () => 1000 });
  const ten = Array.from({ length: 10 }, (_, i) => peer(`q${i}`, -2 - i));
  for (let i = 0; i < 20; i++) { plain.sync(ten, toScene, 1 / 60, [0, 0, 0]); await settle(); }
  assert.equal(rigs2.length, BODIES_MAX);
});
