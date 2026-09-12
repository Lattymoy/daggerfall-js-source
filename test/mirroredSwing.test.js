// MS1 - THE MIRRORED SWING (2026-09-12).
//
// Mac: "classic Daggerfall has a swing animation for left and right
// while Morrowind only has the animation that swings right to left.
// Could we insert a mirrored swing so you're able to swing all
// directions?"
//
// Morrowind's slash is one motion, right to left. The strikes that run
// the other way (StrikeRight, StrikeDownRight) draw the blow MIRRORED:
// the first-person pass through a view reflected in its own x, the
// third-person body reflected about its yaw axis - for the blow's
// phases only, never a shot, never a cast, never the idle between.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MIRRORED_STRIKES, strikeMirrored, DF_STRIKE_TO_MW_ATTACK } from '../src/formats/mwFirstPerson.js';
import { createFpArm, MIRROR_X, UPPER_BODY } from '../src/combat/fpArm.js';
import { multiply, transformPoint, lookAt } from '../src/world/mat4.js';

const f = (n) => new Uint8Array(readFileSync(new URL(`./fixtures/mw/${n}`, import.meta.url)));
const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('MS1: the table - the two strikes that run against Morrowind\'s clip, and only those', () => {
  assert.deepEqual([...MIRRORED_STRIKES], ['StrikeRight', 'StrikeDownRight']);
  for (const s of Object.keys(DF_STRIKE_TO_MW_ATTACK)) {
    assert.equal(strikeMirrored(s), s === 'StrikeRight' || s === 'StrikeDownRight', s);
  }
  assert.equal(strikeMirrored('StrikeLeft'), false, 'StrikeLeft IS Morrowind\'s slash');
  assert.equal(strikeMirrored(undefined), false);
});

test('MS1: MIRROR_X reflects a view\'s x and nothing else - screen-left for screen-right', () => {
  const view = lookAt([0, 1, 0], [0, 1, -1], [0, 1, 0]);
  const p = transformPoint(view, 2, 3, -5);
  const m = transformPoint(multiply(MIRROR_X, view), 2, 3, -5);
  assert.ok(Math.abs(p[0] + m[0]) < 1e-6 && Math.abs(p[1] - m[1]) < 1e-6 && Math.abs(p[2] - m[2]) < 1e-6,
    `(${p}) mirrored is (${m})`);
});

// ── through a real build: the weapon fixture carries slash and chop keys ──
const wpdtRec = (id, model, type) => {
  const A = (x) => [...x].map((c) => c.charCodeAt(0));
  const Z = (x) => [...A(x), 0];
  const U = (n) => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
  const sub = (n, d) => [...A(n), ...U(d.length), ...d];
  const w = new Uint8Array(32);
  new DataView(w.buffer).setInt16(8, type, true);
  const d = [...sub('NAME', Z(id)), ...sub('MODL', Z(model)), ...sub('FNAM', Z('W')), ...sub('WPDT', [...w])];
  return Uint8Array.from([...A('WEAP'), ...U(d.length), ...U(0), ...U(0), ...d]);
};
function deps() {
  const files = new Map([
    ['meshes/xbase_anim.1st.nif', f('armfp.nif')],
    ['meshes/xbase_anim.1st.kf', f('armfpweapon.kf')],
    ['meshes/fixture/armfphand.nif', f('armfphand.nif')],
    ['meshes/fixture/armfparm.nif', f('armfparm.nif')],
    ['meshes/w/blade.nif', f('weapon.nif')],
    ['textures/tx_fixture.dds', f('fixture.dds')],
  ]);
  const weap = wpdtRec('iron longsword', 'w/blade.nif', 1);
  return {
    loadMorrowindArchives: async () => [{ has: (p) => files.has(p), get: (p) => files.get(p) }],
    storedMorrowindNames: async () => ['armfp.esm', 'weap.esm'],
    loadMorrowindFile: async (n) => (n === 'weap.esm' ? weap : f('armfp.esm')),
  };
}
async function drawnArm() {
  const arm = createFpArm();
  arm.attach({
    gl: null,
    createCharacterMesh: () => ({ vao: 1, buffers: [], ranges: [] }),
    updateCharacterMesh: () => {},
    createCharacterTexture: () => 1,
  }, () => ({ pitch: 0 }));
  const res = await arm.build({ race: 'fprace', weapon: { templateIndex: 120 }, deps: deps() });
  assert.ok(res.ok, `${res.stage}: ${res.error}`);
  arm.setSheathed(false);
  for (let i = 0; i < 80 && arm.status().upper !== UPPER_BODY.WeaponEquipped; i++) arm.update(0.05);
  assert.equal(arm.status().upper, UPPER_BODY.WeaponEquipped);
  return arm;
}
const settle = (arm) => { for (let i = 0; i < 200 && arm.status().upper !== UPPER_BODY.WeaponEquipped; i++) arm.update(0.05); };

test('MS1: a right slash is drawn mirrored for the blow\'s phases and not a frame longer; a left slash never', async () => {
  const arm = await drawnArm();
  assert.equal(arm.status().attackMirror, false, 'the drawn idle stands in its own hand');
  assert.equal(arm.attack('StrikeRight'), 'slash', 'rule 11: a side slash is Morrowind\'s slash');
  assert.equal(arm.status().attackMirror, true, 'and the RIGHT one is mirrored');
  let phases = 0;
  for (let i = 0; i < 200 && arm.status().upper !== UPPER_BODY.WeaponEquipped; i++) {
    assert.equal(arm.status().attackMirror, true, `mirrored through phase ${arm.status().upperName}`);
    arm.update(0.05); phases++;
  }
  assert.ok(phases > 1, 'the blow ran through its phases');
  assert.equal(arm.status().upper, UPPER_BODY.WeaponEquipped);
  assert.equal(arm.status().attackMirror, false, 'the follow-through over, the hand is its own again');

  assert.equal(arm.attack('StrikeLeft'), 'slash');
  assert.equal(arm.status().attackMirror, false, 'StrikeLeft is the clip\'s own direction');
  settle(arm);
  assert.equal(arm.attack('StrikeDownRight'), 'chop');
  assert.equal(arm.status().attackMirror, true, 'the diagonal chop pairs the same way');
  settle(arm);
  assert.equal(arm.attack('StrikeDownLeft'), 'chop');
  assert.equal(arm.status().attackMirror, false);
  settle(arm);
  assert.equal(arm.attack('StrikeDown'), 'chop');
  assert.equal(arm.status().attackMirror, false, 'an overhead chop has no side');
});

test('MS1: the two draws take the mirror, a shot and a cast never do', () => {
  const src = rd('src/combat/fpArm.js');
  assert.match(src, /const viewM = mirrorNow\(\) \? multiply\(MIRROR_X, view\) : view;\s*\n\s*const tex = renderer\.renderCharacterSprite\(mesh, NIF_TO_PASS, proj, viewM, pw, ph/,
    'the first-person pass draws through the reflected view');
  assert.match(src, /trs\(feet\[0\], feet\[1\], feet\[2\], 0, yawDeg, 0, \(mirrorNow\(\) \? u : -u\) \* rs\.weight, u \* rs\.height, u \* rs\.weight\)/,
    'the third-person body reflects about its yaw axis');
  assert.match(src, /attackMirror = type !== MW_SHOOT_ATTACK && strikeMirrored\(strike\);/, 'a shot is never mirrored');
  assert.match(src, /attackMirror = false;\s*\/\/ MS1: a cast has no side/);
  assert.match(src, /const mirrorNow = \(\) => attackMirror && ATTACK_PHASES\.has\(upper\);/, 'read only while a blow is up');
  assert.match(src, /export const MIRROR_X = trs\(0, 0, 0, 0, 0, 0, -1, 1, 1\);/);
});
