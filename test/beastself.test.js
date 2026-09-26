// BEAST-SELF (2026-09-26, Mac: "You dont see your self transform less your in paperdoll style (morrowind models need
// their vampire/werewolf forms)"): the Morrowind lane has no beast - Morrowind's data holds no Daggerfall lycanthrope -
// so a Morrowind-lane player who transformed stood in their HUMAN arms (the claws resolve to no Morrowind weapon: bare
// fists) and their human body. The arm and the body STAND ASIDE while the curse holds them in the beast: the first
// person is the classic claws (the weapon rig's own draw), the third Eye Of The Beholder's lycanthrope - what a player
// without Morrowind data sees, and what everyone else already sees (BEAST-PEER). The view carries across the edge.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createFpArm, fpArm, fpSkeletonPath, FP_CLIP_PATH } from '../src/combat/fpArm.js';
import { createWeaponRig } from '../src/combat/weaponRig.js';
import { createLycanthropyCurse, morphSelf } from '../src/systems/lycanthropy.js';
import { LYCANTHROPY_TYPES } from '../src/systems/infection.js';
import { mwViewFrame, setEotbBodyReady, setEotbDrawBody } from '../src/player/mwView.js';
import { mwCamera } from '../src/player/mwCamera.js';
import { eotbCamera } from '../src/player/eotbCamera.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const f = (n) => new Uint8Array(readFileSync(new URL(`./fixtures/mw/${n}`, import.meta.url)));

/** test/fparm.test.js's body fixture: the FP rig and, under the third-person names, the same bytes - an arm WITH a body. */
function bodyRec(id, model, race, part) {
  const sub = (name, data) => {
    const b = new Uint8Array(8 + data.length);
    b.set([...name].map((c) => c.charCodeAt(0)), 0);
    new DataView(b.buffer).setUint32(4, data.length, true);
    b.set(data, 8);
    return b;
  };
  const z = (s) => Uint8Array.from([...s].map((c) => c.charCodeAt(0)).concat(0));
  const bydt = new Uint8Array(4);
  bydt[0] = part;
  const subs = [sub('NAME', z(id)), sub('MODL', z(model)), sub('FNAM', z(race)), sub('BYDT', bydt)];
  const size = subs.reduce((a, s) => a + s.length, 0);
  const rec = new Uint8Array(16 + size);
  rec.set([...'BODY'].map((c) => c.charCodeAt(0)), 0);
  new DataView(rec.buffer).setUint32(4, size, true);
  let o = 16;
  for (const s of subs) { rec.set(s, o); o += s.length; }
  return rec;
}
function bodyFixtureDeps() {
  const files = new Map([
    [fpSkeletonPath({}), f('armfp.nif')], [FP_CLIP_PATH, f('armfpidle.kf')],
    ['meshes/fixture/armfphand.nif', f('armfphand.nif')], ['meshes/fixture/armfparm.nif', f('armfparm.nif')],
    ['textures/tx_fixture.dds', f('fixture.dds')],
    ['meshes/xbase_anim.nif', f('armfp.nif')], ['meshes/xbase_anim.kf', f('armfpidle.kf')],
  ]);
  const esm = f('armfp.esm');
  const extra = [bodyRec('b_fprace_m_hand', 'fixture\\armfphand.nif', 'fprace', 5), bodyRec('b_fprace_m_upperarm', 'fixture\\armfparm.nif', 'fprace', 8)];
  const all = new Uint8Array(esm.length + extra.reduce((a, r) => a + r.length, 0));
  all.set(esm, 0);
  let o = esm.length;
  for (const r of extra) { all.set(r, o); o += r.length; }
  return {
    loadMorrowindArchives: async () => [{ has: (p) => files.has(p), get: (p) => files.get(p) }],
    storedMorrowindNames: async () => ['armfp.esm'],
    loadMorrowindFile: async () => all,
  };
}

test('BEAST-SELF: an arm standing aside has no body to cross into - the wheel is refused without a word on the card - and has it again at once', async () => {
  const arm = createFpArm();
  arm.attach({}, () => ({ pos: [0, 0, 0], yaw: 0, pitch: 0 }));
  assert.equal((await arm.build({ race: 'fprace', deps: bodyFixtureDeps() })).ok, true);
  assert.equal(arm.canThirdPerson(), true, 'a built body');
  assert.equal(arm.setStandIn(true), true, 'the edge is answered');
  assert.equal(arm.standingIn(), true);
  assert.equal(arm.canThirdPerson(), false, 'no Morrowind beast to show');
  const notes = [...(arm.status().clipNotes ?? [])];
  assert.equal(arm.setViewMode('third'), false, 'the wheel has nowhere to go');
  assert.deepEqual(arm.status().clipNotes ?? [], notes, 'and it is no body\'s refusal - nothing on the card');
  assert.equal(arm.status().viewMode, 'first');
  assert.equal(arm.active(), false);
  assert.equal(arm.thirdActive(), false);
  assert.equal(arm.setStandIn(true), false, 'no edge twice');
  assert.equal(arm.setStandIn(false), true);
  assert.equal(arm.canThirdPerson(), true, 'the body is there again, not rebuilt');
  assert.equal(arm.setViewMode('third'), true);
  assert.equal(arm.ready(), true, 'ready() was never touched - the rig kept stepping it');
  const src = rd('src/combat/fpArm.js');
  assert.match(src, /const thirdActive = \(\) => !standIn && !!\(/, 'the third-person draw stands aside too');
});

test('BEAST-SELF: the weapon rig stands the arm aside from the curse itself - transformed, and not', () => {
  const was = fpArm.standingIn();
  try {
    const human = { items: [], stats: { speed: 50 }, activeEffects: [], equip: { slots: {} } };
    createWeaponRig({ renderer: null, canvas: null, entity: human }).frame(1 / 60);
    assert.equal(fpArm.standingIn(), false, 'a person');
    const wolf = { isPlayer: true, level: 5, items: [], spells: [], stats: { speed: 50 }, activeEffects: [], equip: { slots: {} }, health: 60, maxHealth: 60, skills: {} };
    createLycanthropyCurse(wolf, LYCANTHROPY_TYPES.Werewolf, { now: 0 });
    const rig = createWeaponRig({ renderer: null, canvas: null, entity: wolf });
    rig.frame(1 / 60);
    assert.equal(fpArm.standingIn(), false, 'cursed but not changed: the person still');
    morphSelf(wolf, { force: true, nowMinutes: 10 });
    rig.frame(1 / 60);
    assert.equal(fpArm.standingIn(), true, 'the beast: the arm stands aside');
    morphSelf(wolf, { nowMinutes: 2000 });
    rig.frame(1 / 60);
    assert.equal(fpArm.standingIn(), false, 'and back');
  } finally { fpArm.setStandIn(was); }
});

test('BEAST-SELF: at the edge the view carries over - the sprite camera takes the Morrowind camera\'s person and pulls out from the head, not from wherever it last stood; and back', () => {
  const real = { standingIn: fpArm.standingIn, canThirdPerson: fpArm.canThirdPerson, setViewMode: fpArm.setViewMode };
  let beast = false;
  fpArm.standingIn = () => beast;
  fpArm.canThirdPerson = () => !beast;   // the Morrowind body while a person
  fpArm.setViewMode = (m) => m !== 'third' || !beast;   // ...which takes the third person while a person
  setEotbBodyReady(() => true);
  setEotbDrawBody(null);
  const at = (x) => ({ fpEye: [x, 1.6, 0], feet: [x, 0, 0], yaw: 0, pitch: 0, dt: 0.016 });
  try {
    // a stale sprite camera: third person, its eye out at x = 100 from a stretch long ago
    eotbCamera.toggleOffset(true);
    eotbCamera.eye(at(100));
    mwCamera.restore({ firstPerson: false, baseDistance: mwCamera.baseDistance() });   // the player stands in third person
    mwViewFrame(at(0));                                   // a person: the Morrowind lane
    beast = true;
    const out = mwViewFrame(at(0));                       // the change
    assert.equal(eotbCamera.thirdPerson(), true, 'the person carried');
    assert.ok(Math.hypot(out.eye[0], out.eye[2]) < 2, `pulled out from the head (${out.eye.map((v) => v.toFixed(2))}), not flown in from x 100`);
    // the player turns the sprite camera into the head while a beast; turning back, Morrowind's takes it
    eotbCamera.toggleOffset(false);
    mwViewFrame(at(0));
    beast = false;
    mwViewFrame(at(0));
    assert.equal(mwCamera.thirdPerson(), false, 'the person carried back');
    // a first-person player changes into the first person
    beast = true;
    mwViewFrame(at(0));
    assert.equal(eotbCamera.thirdPerson(), false, 'in the head, the claws');
  } finally {
    Object.assign(fpArm, real);
    setEotbBodyReady(null);
    eotbCamera.toggleOffset(false);
    mwCamera.restore({ firstPerson: true, baseDistance: mwCamera.baseDistance() });
  }
});
