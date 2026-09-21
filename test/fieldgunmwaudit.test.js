// AUDIT FIELD-GUN-MW (2026-09-21, Mac: "The newly integrated gun on the
// morrowind rig needs proper rigging in 3rd and 1st person, proper
// animations. Just want you to audit it and ensure its perfect").
//
// Four lenses over FIELD-GUN-MW1/2/3. Two defects paid here, both in the
// Morrowind lane and both views:
//   F1 the shot fired at the CLICK under the borrowed crossbow animation -
//      MW-D42's hold gated on `isBow`, and the gun is `ranged` but not a
//      bow, so its hit rode through at the machine's frame 1 while the
//      arm was still winding up; and the bang, kick and flash fired on
//      the machine leaving Idle, the click, not the arm's release.
//   F2 the orb left the EYE - `thunderlockMuzzle` read the classic
//      sprite's record, which the arm's branch of the draw ladder returns
//      before writing; the rig now answers off its posed weapon piece.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createWeaponRig } from '../src/combat/weaponRig.js';
import { EQUIP_SLOTS } from '../src/systems/equip.js';
import { THUNDERLOCK_TEMPLATE, PELLET_TEMPLATE } from '../src/characters/thunderlockIds.js';
import { SFX as TL_SFX } from '../src/systems/thunderlock.js';
import { farthestVertexIndex, posedVertex, viewOffsetOf, worldPointOf } from '../src/combat/rigMuzzle.js';
import { lookAt, trs, multiply } from '../src/world/mat4.js';
import { NIF_TO_PASS } from '../src/combat/fpArm.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(ROOT, p), 'utf8');

const GUN = { templateIndex: THUNDERLOCK_TEMPLATE, group: 'Weapons' };
const PELLETS = { templateIndex: PELLET_TEMPLATE, stackCount: 20 };
const CANVAS = { clientWidth: 1000, clientHeight: 800 };
const rig = (over = {}) => {
  const audio = { played: [], playOneShot(id) { audio.played.push(id); } };
  const entity = { items: [PELLETS], equip: { slots: { [EQUIP_SLOTS.RightHand]: GUN } } };
  const r = createWeaponRig({ renderer: {}, canvas: CANVAS, fetchBytes: () => { throw new Error('no art in tests'); }, palette: null, audio, entity, ...over });
  r._audio = audio; r._entity = entity;
  return r;
};

/** The arm stubbed the way weaponrig.test.js's MW-D42 pin stubs it: on screen, and answering "shoot release" when told. */
async function armOn() {
  const { fpArm } = await import('../src/combat/fpArm.js');
  const saved = {};
  for (const k of ['ready', 'attack', 'active', 'thirdActive', 'takeShootRelease', 'update', 'release', 'setWeapon', 'setSheathed', 'setWorn', 'readySpell', 'setTorch', 'setScreenTransform', 'weaponMuzzle']) saved[k] = fpArm[k];
  const st = { active: true, third: false, released: false, muzzle: null };
  fpArm.ready = () => true;
  fpArm.attack = () => null;
  fpArm.active = () => st.active;
  fpArm.thirdActive = () => st.third;
  fpArm.takeShootRelease = () => { if (!st.released) return false; st.released = false; return true; };
  fpArm.weaponMuzzle = () => st.muzzle;
  for (const k of ['update', 'release', 'setSheathed', 'setWorn', 'readySpell', 'setTorch', 'setScreenTransform']) fpArm[k] = () => {};
  fpArm.setWeapon = () => true;
  return { st, restore: () => { for (const k of Object.keys(saved)) fpArm[k] = saved[k]; } };
}
const shoot = (r, frames) => {
  const evs = [];
  r.attackInput(900, 0, true);
  for (let i = 0; i < frames; i++) { for (const e of r.frame(1 / 60)) evs.push(e); if (i === 0) r.attackInput(900, 0, false); }
  return evs;
};
const fires = (r) => r._audio.played.filter((id) => id === TL_SFX.fire).length;

test('AUDIT FIELD-GUN-MW F1: under the arm the gun\'s hit is HELD for the release, and its bang, kick and flash go with it - not at the click', async () => {
  const { st, restore } = await armOn();
  try {
    const r = rig(); r.toggleSheath();
    for (let i = 0; i < 30; i++) r.frame(1 / 60);
    const early = shoot(r, 40);   // 40 frames at 60 Hz - the classic hit is frame 1 at 14 fps, 70 ms in
    assert.ok(!early.includes('hit'), 'the machine\'s frame-1 hit is held while the crossbow winds up');
    assert.equal(fires(r), 0, 'and the bang has not gone off at the click');
    assert.equal(r._entity._thunderlockFlash, 0, 'nor the flash');
    st.released = true;
    const evs = [...r.frame(1 / 60)];
    assert.ok(evs.includes('hit'), 'the arm\'s "shoot release" lets the hit go');
    assert.equal(fires(r), 1, 'and the bang fires on that same frame');
    let glow = 0;
    for (let i = 0; i < 6; i++) { r.frame(1 / 60); glow = Math.max(glow, r._entity._thunderlockFlash); }
    assert.ok(glow > 0, 'the flash lights from the release, on the curve\'s own tick');
    const after = [];
    for (let i = 0; i < 20; i++) for (const e of r.frame(1 / 60)) after.push(e);
    assert.ok(!after.includes('hit'), 'and exactly once');
    assert.equal(fires(r), 1);
  } finally { restore(); }
});

test('AUDIT FIELD-GUN-MW F1: the classic lane is untouched - no arm, the hit and the bang ride the machine\'s click; and third person holds like first (MW-D42c)', async () => {
  const { st, restore } = await armOn();
  try {
    st.active = false;
    const r = rig(); r.toggleSheath();
    for (let i = 0; i < 30; i++) r.frame(1 / 60);
    const classic = shoot(r, 40);
    assert.ok(classic.includes('hit'), 'no arm, no hold');
    assert.equal(fires(r), 1, 'the bang at the click, as the sprite lane always had it');
    st.active = false; st.third = true;
    const r3 = rig(); r3.toggleSheath();
    for (let i = 0; i < 30; i++) r3.frame(1 / 60);
    const held = shoot(r3, 40);
    assert.ok(!held.includes('hit'), 'in third person the body is the thing animating: held');
    assert.equal(fires(r3), 0);
    st.released = true;
    assert.ok([...r3.frame(1 / 60)].includes('hit'));
    assert.equal(fires(r3), 1);
  } finally { restore(); }
});

test('AUDIT FIELD-GUN-MW F1: a silent arm never swallows the shot - the ceiling MW-D42 set still stands for the gun', async () => {
  const { restore } = await armOn();
  try {
    const r = rig(); r.toggleSheath();
    for (let i = 0; i < 30; i++) r.frame(1 / 60);
    const silent = shoot(r, 200);   // 3.3 s, past HELD_HIT_MAX_S
    assert.ok(silent.includes('hit'), 'late rather than never');
    assert.equal(fires(r), 1, 'and the bang with it');
  } finally { restore(); }
});

test('AUDIT FIELD-GUN-MW F2: under the arm the muzzle is the RIG\'s answer, never the classic sprite\'s record', async () => {
  const { st, restore } = await armOn();
  try {
    const r = rig(); r.toggleSheath();
    r.frame(1 / 60);
    st.muzzle = { right: 0.2, up: -0.1, forward: 0.6 };
    assert.deepEqual(r.thunderlockMuzzle(1.2), st.muzzle, 'first person: the arm\'s lens offset');
    st.active = false; st.third = true; st.muzzle = { world: [1, 2, 3] };
    assert.deepEqual(r.thunderlockMuzzle(1.2), st.muzzle, 'third person: the body\'s world point');
    st.active = false; st.third = false;
    assert.equal(r.thunderlockMuzzle(1.2), null, 'no arm and no sprite drawn headlessly: nothing, not a stale rect');
  } finally { restore(); }
});

test('AUDIT FIELD-GUN-MW F2: the muzzle vertex is the one farthest from the grip, and the two answers are the two frames the draws compose with', () => {
  // a gun: origin at the grip, barrel along +Y (the bake's frame), a butt behind
  const source = new Float32Array([0, -5, 0, 1, 40, 0, -1, 47, 1, 0, 3, 2]);
  assert.equal(farthestVertexIndex(source), 2, 'the muzzle, 47 ahead - not the butt, not the first vertex');
  assert.equal(farthestVertexIndex(new Float32Array(0)), -1);
  const posed = new Float32Array(12); posed.set(source);
  assert.deepEqual(posedVertex(posed, 2), [-1, 47, 1]);
  // first person: rig Z-up into the pass's Y-up, then the lens - a point straight ahead of the eye lands on -Z
  const eye = [0, 0, 0];
  const view = lookAt(eye, [0, 0, -1], [0, 1, 0]);
  const u = 70;
  const ahead = viewOffsetOf([0, 70, 0], NIF_TO_PASS, view, u);   // MW +Y is the pass's -Z: ahead
  assert.ok(Math.abs(ahead.forward - 1) < 1e-6 && Math.abs(ahead.right) < 1e-6 && Math.abs(ahead.up) < 1e-6, JSON.stringify(ahead));
  const right = viewOffsetOf([70, 0, 0], NIF_TO_PASS, view, u);
  assert.ok(Math.abs(right.right - 1) < 1e-6 && Math.abs(right.forward) < 1e-6, JSON.stringify(right));
  const up = viewOffsetOf([0, 0, 70], NIF_TO_PASS, view, u);   // MW +Z is the pass's +Y: up
  assert.ok(Math.abs(up.up - 1) < 1e-6 && Math.abs(up.forward) < 1e-6, JSON.stringify(up));
  // third person: the body's model matrix carries feet, yaw and the metre scale
  const model = multiply(trs(10, 0, 20, 0, 180, 0, -1 / u, 1 / u, -1 / u), NIF_TO_PASS);   // drawThird's own composition
  const w = worldPointOf([0, 70, 0], model);
  const d = Math.hypot(w[0] - 10, w[1], w[2] - 20);
  assert.ok(Math.abs(d - 1) < 1e-6 && Math.abs(w[1]) < 1e-6, `one metre from the feet, on the body's floor - the metre scale and the basis both carried: ${w}`);
  const w2 = worldPointOf([0, 0, 70], model);
  assert.ok(Math.abs(w2[1] - 1) < 1e-6, `MW +Z is the world's up, a metre over the feet: ${w2}`);
});

test('AUDIT FIELD-GUN-MW by source: the gate reads `ranged`; the voice is told the hold; the arm keeps its third-person frame; the flight takes a world muzzle; every host still asks the one door', () => {
  const rig = rd('src/combat/weaponRig.js');
  assert.match(rig, /const armShoots = \(fpArm\.active\(\) \|\| fpArm\.thirdActive\(\)\) && !!playerWeapon\.machine\.ranged;/, 'ranged, not isBow');
  assert.match(rig, /const held = holdShotForArm\(evs, dt, armShoots\);\n\s*thunderlockVoice\(dt, \{ armShoots, fired: held\.fired \}\);/, 'the hold first, the voice told');
  assert.match(rig, /const trigger = armShoots \? fired : \(m\.state !== 'Idle' && _tlState === 'Idle'\);/, 'the trigger under the arm is the release; classic keeps the click');
  assert.match(rig, /\(armShoots \? flashFromClock\(dt\) : muzzleGlow\(m\.state !== 'Idle', m\.frame\)\)/, 'the flash counts from the release under the arm');
  assert.match(rig, /if \(fpArm\.active\(\) \|\| fpArm\.thirdActive\(\)\) return fpArm\.weaponMuzzle\(\);\n\s*return muzzleRay\(_tlDrawn, fovRad, forward\);/, 'the arm answers for its own muzzle');
  assert.doesNotMatch(rig, /playerWeapon\.machine\.isBow\) \{\n\s*\/\/ The classic sprite path is untouched/, 'the bow-only gate is gone');
  const arm = rd('src/combat/fpArm.js');
  assert.match(arm, /lastThirdModel = model;/, 'drawThird keeps its frame for the muzzle');
  assert.match(arm, /weaponMuzzle\(\) \{\n\s*if \(viewMode === 'third'\) \{[\s\S]*?return \{ world: worldPointOf\([\s\S]*?\}\n[\s\S]*?return viewOffsetOf\(/, 'third answers a world point, first a lens offset');
  const cast = rd('src/systems/spellcast.js');
  assert.match(cast, /export function playerShotOrigin\(eye, lookDir, muzzle\) \{\n\s*if \(muzzle\?\.world\) return \[\.\.\.muzzle\.world\];/, 'a world muzzle is the origin itself, at the ONE fork');
  for (const f of ['src/combat/arrowFlight.js', 'src/scenes/dungeonContext.js']) {
    const s = rd(f);
    assert.match(s, /playerShotOrigin\(from, dir, (?:meta\.)?muzzle\)/, `${f} spawns through the one fork`);
    assert.doesNotMatch(s, /muzzle \? playerMuzzleOrigin/, `${f} restates no fork of its own`);
  }
  // GENERATIVE: every host that fires the player's shot passes the one door's answer, so the fix reaches all of them
  let doors = 0;
  for (const h of ['world', 'exterior', 'dungeonContext', 'worldModes', 'dungeon']) {
    const s = rd(`src/scenes/${h}.js`);
    const n = (s.match(/weaponRig\.thunderlockMuzzle\(fieldOfView\(\)\)/g) ?? []).length;
    doors += n;
  }
  assert.ok(doors >= 3, `the hosts that fire the shot ask the rig (${doors})`);
});
