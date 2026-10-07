// MW-GUN-FEEL (2026-10-07; bible/05-Combat/Dwarven-Thunderlock.md "MW-GUN-FEEL"; Mac: "overhauling the thunderlock in
// general including the morrowinds gun model and proper animations"). Under the Morrowind arm the gun borrows the
// crossbow's groups, and a crossbow has no kick and loads on its wind-up - so after the bang the hands stood still for
// the whole 1.7s reload, and the breech was heard opening BEFORE the bang. The laws pinned:
//   - THE POSE: the classic spring's displacement as degrees of muzzle climb and centimetres into the shoulder; the
//     reload's share as the pump - down from the shot, back up exactly at the ready, nothing outside it.
//   - THE MATRIX: turned about the shoulder, moved back and down, in the eye's own axes.
//   - THE ARM: the pose laid in front of the lens - the view the pass draws with IS K x the lens, and none is the lens.
//   - THE RIG: the kick on the shot, the pump on the reload, none sheathed; the breech opens after the bang.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ARM_GUN_FEEL, ARM_KICK_REST_PX, armGunPose, reloadDip, armKickMatrix, GUN_FEEL, GUN_COOLDOWN_SECONDS } from '../src/combat/gunFeel.js';
import { createFpArm, fpSkeletonPath, FP_CLIP_PATH } from '../src/combat/fpArm.js';
import { MW_UNITS_PER_METER } from '../src/formats/mwFirstPerson.js';
import { multiply, transformPoint } from '../src/world/mat4.js';
import { createWeaponRig } from '../src/combat/weaponRig.js';
import { EQUIP_SLOTS } from '../src/systems/equip.js';
import { THUNDERLOCK_TEMPLATE, PELLET_TEMPLATE } from '../src/characters/thunderlockIds.js';
import { SFX as TL_SFX } from '../src/systems/thunderlock.js';

const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;
const nearVec = (a, b, eps, what) => a.forEach((v, i) => assert.ok(near(v, b[i], eps), `${what}[${i}]: ${v} vs ${b[i]}`));
const DEG = Math.PI / 180;

test('MW-GUN-FEEL THE POSE: the spring\'s 5px peak is 3 degrees of muzzle climb and 2.5cm into the shoulder; the pump tips the gun 20 degrees down and 12cm lower at its depth - in over the reload\'s first fifth, out over its last quarter, up exactly at the ready and nothing outside the reload (mutants: the kick upside down; the pump never comes back up)', () => {
  assert.deepEqual({ ...ARM_GUN_FEEL, pivot: [...ARM_GUN_FEEL.pivot] }, { kickDegPerPx: 0.6, kickBackPerPx: 0.005, reloadPitchDeg: 20, reloadDropM: 0.12, reloadIn: 0.2, reloadOut: 0.25, pivot: [0, -0.22, -0.32] });
  const kick = armGunPose(GUN_FEEL.kick, null);
  assert.ok(near(kick.pitch, 3 * DEG) && near(kick.back, 0.025) && kick.down === 0, JSON.stringify(kick));
  const deep = armGunPose(0, 0.5);
  assert.ok(near(deep.pitch, -20 * DEG) && deep.back === 0 && near(deep.down, 0.12), JSON.stringify(deep));
  assert.deepEqual(armGunPose(0, null), { pitch: 0, back: 0, down: 0 }, 'at rest: nothing');
  assert.deepEqual(armGunPose(NaN, null), { pitch: 0, back: 0, down: 0 });
  assert.deepEqual(armGunPose(ARM_KICK_REST_PX / 2, null), { pitch: 0, back: 0, down: 0 }, 'the spring\'s endless tail: at rest');
  assert.ok(armGunPose(ARM_KICK_REST_PX * 2, null).pitch > 0);
  for (const s of [null, -0.1, 0, 1, 1.2, NaN]) assert.equal(reloadDip(s), 0, `share ${s}: no pump`);
  assert.ok(near(reloadDip(0.1), 0.5), 'halfway down at half the way in');
  for (const s of [0.2, 0.4, 0.6, 0.75]) assert.equal(reloadDip(s), 1, `share ${s}: held at its depth`);
  assert.ok(near(reloadDip(0.875), 0.5), 'halfway up at half the way out');
  let last = 0;
  for (let s = 0.001; s <= 0.2; s += 0.01) { const d = reloadDip(s); assert.ok(d >= last); last = d; }
  last = 1;
  for (let s = 0.75; s < 1; s += 0.01) { const d = reloadDip(s); assert.ok(d <= last + 1e-12); last = d; }
  assert.ok(reloadDip(0.999) < 1e-4, 'all but up at the ready');
});

test('MW-GUN-FEEL THE MATRIX: in the view\'s space (the eye down -Z, +Y up) - the shoulder only moved, a point ahead of it raised by the pitch, `back` toward the eye, `down` down; the rig\'s scale applied (mutants: the turn about the eye; back away from the eye)', () => {
  const u = 70;
  const [, py, pz] = ARM_GUN_FEEL.pivot.map((v) => v * u);
  const K = armKickMatrix({ pitch: 0.1, back: 0.02, down: 0.03 }, u);
  nearVec(transformPoint(K, 0, py, pz), [0, py - 0.03 * u, pz + 0.02 * u], 1e-4, 'the shoulder: moved, not turned');
  const ahead = transformPoint(K, 0, py, pz - 10);
  nearVec(ahead, [0, py + 10 * Math.sin(0.1) - 0.03 * u, pz - 10 * Math.cos(0.1) + 0.02 * u], 1e-4, 'ten units ahead of it: raised by the turn');
  nearVec(transformPoint(armKickMatrix({ back: 0.1 }, u), 1, 2, 3), [1, 2, 3 + 7], 1e-4, 'back is toward the eye (+Z)');
  nearVec(transformPoint(armKickMatrix({ down: 0.1 }, u), 1, 2, 3), [1, 2 - 7, 3], 1e-4, 'down is down');
  nearVec(transformPoint(armKickMatrix({}, u), 1, 2, 3), [1, 2, 3], 1e-6, 'no pose, no move');
});

const f = (n) => new Uint8Array(readFileSync(new URL(`./fixtures/mw/${n}`, import.meta.url)));
const liveRig = () => {
  const files = new Map([
    [fpSkeletonPath({}), f('armfp.nif')],
    [FP_CLIP_PATH, f('armfpidle.kf')],
    ['meshes/fixture/armfphand.nif', f('armfphand.nif')],
    ['meshes/fixture/armfparm.nif', f('armfparm.nif')],
  ]);
  const deps = {
    loadMorrowindArchives: async () => [{ has: (p) => files.has(p), get: (p) => files.get(p) }],
    storedMorrowindNames: async () => ['armfp.esm'],
    loadMorrowindFile: async () => f('armfp.esm'),
  };
  const draws = [];
  const renderer = {
    gl: null,
    createCharacterMesh: () => ({ vao: {}, buffers: [] }),
    updateCharacterMesh: () => {},
    renderCharacterSprite: (mesh, model, proj, view) => { draws.push({ model, proj, view: [...view] }); return { tex: {} }; },
    drawScreenOverlayQuad: () => {},
    createCharacterTexture: (mips) => ({ mips }),
  };
  return { deps, renderer, draws };
};
const canvas = { clientWidth: 800, clientHeight: 600, width: 800, height: 600 };

test('MW-GUN-FEEL THE ARM: the pose is laid in front of the lens - the view the first-person pass draws with is K x the lens, the arms and the gun moving as one; a pose that moves nothing is none, and the lens comes back (mutants: the pose dropped at the draw; laid behind the lens)', async () => {
  const { deps, renderer, draws } = liveRig();
  const arm = createFpArm();
  arm.attach(renderer, () => ({ pos: [0, 1.6, 0], yaw: 0, pitch: 0 }));
  const built = await arm.build({ race: 'fprace', deps });
  assert.equal(built.ok, true, built.ok ? '' : `${built.stage}: ${built.error}`);
  arm.update(1 / 60);
  assert.equal(arm.draw(canvas), true);
  const lens = draws.at(-1).view;
  const pose = { pitch: 0.06, back: 0.02, down: 0.01 };
  arm.setGunFeel(pose);
  assert.deepEqual(arm.gunFeel(), pose);
  assert.equal(arm.draw(canvas), true);
  nearVec(draws.at(-1).view, [...multiply(armKickMatrix(pose, MW_UNITS_PER_METER), new Float32Array(lens))], 1e-4, 'K x lens');
  assert.ok(draws.at(-1).view.some((v, i) => !near(v, lens[i], 1e-3)), 'and it moved');
  arm.setGunFeel({ pitch: 0, back: 0, down: 0 });
  assert.equal(arm.gunFeel(), null, 'a still pose is none');
  arm.draw(canvas);
  nearVec(draws.at(-1).view, lens, 1e-6, 'the lens again');
  arm.setGunFeel(null);
  assert.equal(arm.gunFeel(), null);
});

// ── the rig, under a stubbed arm (fieldgunmwaudit.test.js's way) ─────────────────────────────────────────────────────

const GUN = { templateIndex: THUNDERLOCK_TEMPLATE, group: 'Weapons' };
const CANVAS = { clientWidth: 1000, clientHeight: 800 };
const rig = () => {
  const audio = { played: [], playOneShot(id) { audio.played.push(id); } };
  const entity = { items: [{ templateIndex: PELLET_TEMPLATE, stackCount: 20 }], equip: { slots: { [EQUIP_SLOTS.RightHand]: GUN } } };
  const r = createWeaponRig({ renderer: {}, canvas: CANVAS, fetchBytes: () => { throw new Error('no art in tests'); }, palette: null, audio, entity });
  r._audio = audio; r._entity = entity;
  return r;
};
async function armOn() {
  const { fpArm } = await import('../src/combat/fpArm.js');
  const saved = {};
  const keys = ['ready', 'attack', 'active', 'thirdActive', 'takeShootRelease', 'update', 'release', 'setWeapon', 'setSheathed', 'setWorn', 'readySpell', 'setTorch', 'setScreenTransform', 'weaponMuzzle'];
  for (const k of keys) saved[k] = fpArm[k];
  const st = { active: true, released: false };
  fpArm.ready = () => true;
  fpArm.attack = () => null;
  fpArm.active = () => st.active;
  fpArm.thirdActive = () => false;
  fpArm.takeShootRelease = () => { if (!st.released) return false; st.released = false; return true; };
  fpArm.weaponMuzzle = () => null;
  for (const k of ['update', 'release', 'setSheathed', 'setWorn', 'readySpell', 'setTorch', 'setScreenTransform']) fpArm[k] = () => {};
  fpArm.setWeapon = () => true;
  return { fpArm, st, restore: () => { for (const k of keys) fpArm[k] = saved[k]; fpArm.setGunFeel(null); } };
}
const order = (r) => r._audio.played.filter((id) => id === TL_SFX.fire || id === TL_SFX.open || id === TL_SFX.close);

test('MW-GUN-FEEL THE RIG: under the arm the breech opens AFTER the bang - never in the wait for the crossbow\'s release, though the machine\'s cooldown has begun; the kick rides the shot, the pump the reload from the shot to the ready, and the arm is still once the gun can fire (mutants: the open on the machine\'s clock; the kick never handed over; the reload\'s share from the click)', async () => {
  const { fpArm, st, restore } = await armOn();
  try {
    const r = rig(); r.toggleSheath();
    for (let i = 0; i < 30; i++) r.frame(1 / 60);
    r._audio.played.length = 0;   // the draw's own clack (the breech coming home, weaponRig.js's equip sound) is not the reload's
    r.attackInput(900, 0, true);
    for (let i = 0; i < 48; i++) { r.frame(1 / 60); if (i === 0) r.attackInput(900, 0, false); }   // 0.8s of wind-up: past the machine's six frames
    assert.deepEqual(order(r), [], 'no bang yet - and no breech opening before it');
    assert.equal(fpArm.gunFeel(), null, 'nothing moves before the shot');
    st.released = true;
    r.frame(1 / 60);
    assert.deepEqual(order(r), [TL_SFX.fire], 'the bang on the release');
    r.frame(1 / 60);
    const kick = fpArm.gunFeel();
    assert.ok(kick && kick.pitch > 0 && kick.back > 0, `the kick: the muzzle up, into the shoulder (${JSON.stringify(kick)})`);
    for (let i = 0; i < 18; i++) r.frame(1 / 60);   // 0.3s after the bang: the smoke still clearing
    assert.deepEqual(order(r), [TL_SFX.fire], 'not on the bang\'s own frame - the machine\'s five frames after its hit first, as the classic lane');
    for (let i = 0; i < 6; i++) r.frame(1 / 60);
    assert.deepEqual(order(r), [TL_SFX.fire, TL_SFX.open], 'then the breech opens');
    for (let i = 0; i < 40; i++) r.frame(1 / 60);   // ~0.7s on: the spring long settled, the pump at its depth
    const pump = fpArm.gunFeel();
    assert.ok(pump && pump.pitch < 0 && pump.down > 0.1, `the pump (${JSON.stringify(pump)})`);
    for (let i = 0; i < 90; i++) r.frame(1 / 60);   // past the ready
    assert.deepEqual(order(r), [TL_SFX.fire, TL_SFX.open, TL_SFX.close], 'and closes before the ready');
    assert.equal(fpArm.gunFeel(), null, 'still once it can fire again');
    assert.ok(GUN_COOLDOWN_SECONDS > 1, 'the reload being the gun\'s 1.7s');
  } finally { restore(); }
});

test('MW-GUN-FEEL THE RIG: the classic lane hears what it did - the bang at the click, the breech at the cooldown; and a sheathed gun hands the arm no pose (mutants: the classic open withheld)', async () => {
  const { fpArm, st, restore } = await armOn();
  try {
    st.active = false;
    const r = rig(); r.toggleSheath();
    for (let i = 0; i < 30; i++) r.frame(1 / 60);
    r._audio.played.length = 0;
    r.attackInput(900, 0, true);
    for (let i = 0; i < 40; i++) { r.frame(1 / 60); if (i === 0) r.attackInput(900, 0, false); }
    assert.deepEqual(order(r), [TL_SFX.fire, TL_SFX.open], 'the bang at the click, the breech as the cooldown begins');
    for (let i = 0; i < 120; i++) r.frame(1 / 60);
    assert.deepEqual(order(r), [TL_SFX.fire, TL_SFX.open, TL_SFX.close]);
    st.active = true;
    r.toggleSheath();
    for (let i = 0; i < 10; i++) r.frame(1 / 60);
    assert.equal(fpArm.gunFeel(), null, 'sheathed: no pose');
  } finally { restore(); }
});
