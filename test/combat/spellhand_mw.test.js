// SPELL-HAND and MIXED-PAIR on THE MORROWIND ARM (bible/05-Combat/Two-Hands.md "The spell hand", "A blade and a gun";
// combat/twoHands/spellHandArm.js, combat/twoHands/mixedArm.js, wired by combat/fpArm.js). The fixture arm (mwcast1's: the
// longsword arm whose clips carry the spellcast group and IdleSpell), with the thrown weapons' group appended for the
// Pistolet (its `animateAs` MarksmanThrown - PISTOL-STANCE) and the shipped pistol bound on the left hand:
//   - the spell hand keeps the WEAPON's stance - the weapon in its hand, its left arm the Spell idle's; the cast plays the
//     spellcast group with the weapon still in hand, its right arm the weapon's idle; the stance it latched lets go after;
//   - a blade-and-gun pair's left blow plays in the LEFT weapon's group (a shot's "shoot"), and the arm's own after it; its
//     left arm at rest is its own weapon's idle in the mirror;
//   - the pistol stance's one hand (`only`) - a mixed pair's gun, or one gun beside a spell.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createFpArm, fpSkeletonPath, FP_CLIP_PATH, UPPER_BODY, resolveWeaponParts, resolveOffWeaponParts, archiveHas } from '../../src/combat/fpArm.js';
import { MW_WEAPON_TYPE } from '../../src/formats/morrowind/mwFirstPerson.js';
import { parseNif } from '../../src/formats/morrowind/mwNifFile.js';
import { writeNif } from '../../tools/nifWrite.mjs';
import { CAST_KEYS } from '../fixtures/mw/castClip.mjs';
import { createHeldClips, spellHandLimbs, SPELL_HAND_ARM, spellHandStanceStep, drawsIntoSpellHand } from '../../src/combat/twoHands/spellHandArm.js';
import { rifleStanceStep } from '../../src/combat/gun/rifleStance.js';
import { gunArmOf, blowTypeOf, gunHoldOf, offStanceTypeOf, gunAimShooting, blowWeaponOf, muzzlePieceOf } from '../../src/combat/twoHands/mixedArm.js';
import { pistolStanceRequest } from '../../src/combat/gun/pistolStance.js';
import { OWN_MW_MODELS } from '../../src/characters/ownModels/ownWeaponModels.js';
import { PISTOLET_TEMPLATE } from '../../src/characters/thunderlockIds.js';
import { assembleFirstPersonArm, poseAssembly } from '../../src/formats/morrowind/mwFirstPerson.js';
import { composeWornArmor } from '../../src/formats/morrowind/mwItemMap.js';
import { retailSkeleton } from '../fixtures/mw/retailRig.mjs';
import { retailBodyDeps, shippedArchive, countingRenderer } from '../fixtures/mw/bodyRig.mjs';

const f = (n) => new Uint8Array(readFileSync(new URL(`../fixtures/mw/${n}`, import.meta.url)));
const onDisk = (p) => new Uint8Array(readFileSync(new URL(`../../${p}`, import.meta.url)));
const GUN = Object.freeze({ templateIndex: PISTOLET_TEMPLATE, group: 'Weapons', material: 4 });

/** The thrown weapons' group and its idle - the Pistolet's borrowed stance - appended past CAST_KEYS. */
const THROW_KEYS = Object.freeze([
  [10.6, 'ThrowWeapon: Equip Start'], [10.7, 'ThrowWeapon: Equip Attach'], [10.8, 'ThrowWeapon: Equip Stop'],
  [10.9, 'ThrowWeapon: Unequip Start'], [11.0, 'ThrowWeapon: Unequip Detach'], [11.1, 'ThrowWeapon: Unequip Stop'],
  [11.2, 'ThrowWeapon: Shoot Start'], [11.3, 'ThrowWeapon: Shoot Min Attack'], [11.4, 'ThrowWeapon: Shoot Max Attack'],
  [11.5, 'ThrowWeapon: Shoot Release'], [11.6, 'ThrowWeapon: Shoot Follow Start'], [11.7, 'ThrowWeapon: Shoot Follow Stop'],
  [11.8, 'Idle1t: Start'], [11.9, 'Idle1t: Stop'],
]);
function armClip({ drop = null } = {}) {
  const nif = parseNif(f('armfpweapon.kf'));
  const records = nif.records.map((r) => ({ ...r }));
  const tk = records.find((r) => r.type === 'NiTextKeyExtraData');
  tk.keys = [...tk.keys, ...[...CAST_KEYS, ...THROW_KEYS].filter(([, k]) => !(drop && drop.test(k))).map(([time, text]) => ({ time, text }))];
  return writeNif(records, nif.roots);
}
const wpdtRec = (id, model, type, speed = 1) => {
  const A = (x) => [...x].map((c) => c.charCodeAt(0));
  const Z = (x) => [...A(x), 0];
  const U = (n) => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
  const sub = (n, d) => [...A(n), ...U(d.length), ...d];
  const w = new Uint8Array(32);
  const dv = new DataView(w.buffer);
  dv.setInt16(8, type, true);
  dv.setFloat32(12, speed, true);
  const d = [...sub('NAME', Z(id)), ...sub('MODL', Z(model)), ...sub('FNAM', Z('W')), ...sub('WPDT', [...w])];
  return Uint8Array.from([...A('WEAP'), ...U(d.length), ...U(0), ...U(0), ...d]);
};
const fakeRenderer = () => ({ gl: null, createCharacterMesh: () => ({ vao: 1, buffers: [], ranges: [] }), updateCharacterMesh: () => {}, createCharacterTexture: () => 1 });

/** The longsword arm, its clips carrying the spellcast and thrown groups, the shipped pistol in its archive; drawn. */
async function arm({ speed = 1, drop = null } = {}) {
  const files = new Map([
    [fpSkeletonPath({}), f('armfp.nif')],
    [FP_CLIP_PATH, new Uint8Array(armClip({ drop }))],
    ['meshes/fixture/armfphand.nif', f('armfphand.nif')],
    ['meshes/fixture/armfparm.nif', f('armfparm.nif')],
    ['meshes/w/blade.nif', f('weapon.nif')],
    ['textures/tx_fixture.dds', f('fixture.dds')],
    [`meshes/${OWN_MW_MODELS[PISTOLET_TEMPLATE].model}`, onDisk('src/assets/mw/meshes/pistolet.nif')],
  ]);
  const weap = wpdtRec('iron longsword', 'w/blade.nif', MW_WEAPON_TYPE.LongBladeOneHand, speed);   // AUDIT MIXED-PAIR L3-8: the blade's record pace, asked
  const a = createFpArm();
  a.attach(fakeRenderer(), () => ({ pitch: 0 }));
  const deps = {
    loadMorrowindArchives: async () => [{ has: (p) => files.has(p), get: (p) => files.get(p) }],
    storedMorrowindNames: async () => ['armfp.esm', 'weap.esm'],
    loadMorrowindFile: async (n) => (n === 'weap.esm' ? weap : f('armfp.esm')),
  };
  const res = await a.build({ race: 'fprace', weapon: { templateIndex: 120 }, deps });
  assert.ok(res.ok, `build: ${res.stage} ${res.error}`);
  a.setSheathed(false);
  for (let i = 0; i < 400 && a.status().upper !== UPPER_BODY.WeaponEquipped; i++) a.update(0.05);
  assert.equal(a.status().upper, UPPER_BODY.WeaponEquipped);
  return { a, deps };
}
const run = (a, s, each = null) => { for (let t = 0; t < s; t += 0.05) { each?.(); a.update(0.05); } };

test('SPELL-HAND THE ARM\'S LIMBS (spellHandArm.js): the cast lends the RIGHT arm the weapon\'s idle, a readied spell the LEFT arm the Spell idle - each its own side, copied; nothing to compose without its clip; the held clip loops on its own clock (mutants: the arms swapped; an arm mirrored; the clock frozen)', () => {
  const w = { tracks: 'w' }, sp = { tracks: 's' };
  assert.deepEqual(SPELL_HAND_ARM, { spell: 'L', weapon: 'R' });
  assert.deepEqual(spellHandLimbs({ casting: true, ready: true, weaponIdle: w, spellIdle: sp }), { limbs: { R: { clip: w, side: 'R', mirror: false } }, key: 'spellhand:cast' });
  assert.deepEqual(spellHandLimbs({ ready: true, weaponIdle: w, spellIdle: sp }), { limbs: { L: { clip: sp, side: 'L', mirror: false } }, key: 'spellhand:ready' });
  assert.equal(spellHandLimbs({ casting: true, weaponIdle: null }), null);
  assert.equal(spellHandLimbs({ ready: true, spellIdle: null }), null);
  assert.equal(spellHandLimbs({}), null);
  const stepped = [];
  const held = createHeldClips({ pick: (r, g) => (g === 'none' ? null : { state: { time: 1 }, source: { keys: [], trackMap: `${g}-tracks` } }), step: (s, k, dt) => { s.time += dt; stepped.push(dt); }, sampleTrack: 'S' });
  const r = { sources: [] };
  assert.deepEqual(held.clip(r, 'idlespell', 0), { tracks: 'idlespell-tracks', sampleTrack: 'S', time: 1 });
  assert.equal(held.clip(r, 'idlespell', 0.25).time, 1.25, 'advanced on its own clock');
  assert.equal(held.clip(r, 'none', 0.1), null, 'a rig without the group: nothing');
  assert.equal(held.clip({ sources: [] }, 'idlespell', 0).time, 1, 'a new rig its own clock');
});

test('SPELL-HAND THE LIVE ARM: with the spell in the free hand the arm keeps the WEAPON\'s stance - the weapon in hand, its group the weapon\'s, its left arm the Spell idle - and still swings; the cast plays the spellcast group with the weapon in hand, its right arm the weapon\'s idle; the stance the cast latched lets go when it ends; without the spell hand Morrowind\'s own Spell stance (mutants: readySpell\'s spell-hand door; weaponInHand\'s; the cast\'s latch kept; the compositions\' keys; the body never told)', async () => {
  const { a } = await arm();
  a.setSpellHand(true);
  a.readySpell(true);
  run(a, 0.3);
  let s = a.status();
  assert.equal(s.spellReady, false, 'the weapon\'s stance stands');
  assert.equal(s.weaponInHand, true, 'the weapon in its hand');
  assert.equal(s.weaponGroup, 'weapononehand');
  assert.equal(a.handsState().composed, 'spellhand:ready', 'the left arm the Spell idle\'s');
  // AUDIT SPELL-HAND L3-5: and the arm tells the body so - its layer leaves the left arm to the clip, the right its own
  const carried = a.status().motion.arms;
  assert.ok(carried.L < 0.1 && carried.R > 0.5, `the body's left arm the clip's, its right the layer's (${carried.L.toFixed(3)}, ${carried.R.toFixed(3)})`);
  assert.ok(a.attack('StrikeDown'), 'the weapon still swings with the spell readied');
  run(a, 2);
  assert.equal(a.status().upper, UPPER_BODY.WeaponEquipped);
  assert.equal(a.castSpell(2), true, 'the cast');
  run(a, 0.1, () => { a.setSpellHand(true); a.readySpell(true); });
  s = a.status();
  assert.equal(s.casting, true);
  assert.equal(s.weaponInHand, true, 'the weapon stays in hand through the cast');
  assert.equal(a.handsState().composed, 'spellhand:cast', 'the right arm the weapon\'s idle');
  // the spell goes at its release (Daggerfall clears the ready) - the cast plays out, and the stance it latched lets go IN
  // THE STEP the cast ends (never a frame of the Spell stance between)
  let ended = null;
  for (let t = 0; t < 3 && !ended; t += 0.05) { a.setSpellHand(true); a.readySpell(false); a.update(0.05); if (!a.status().casting) ended = a.status(); }
  assert.ok(ended, 'the cast ended');
  assert.equal(ended.spellReady, false, 'the cast\'s latch let go as it ended');
  assert.equal(ended.weaponGroup, 'weapononehand');
  // without the spell hand: Morrowind's own Spell stance, the weapon out of the hand
  a.setSpellHand(false);
  a.readySpell(true);
  run(a, 0.3);
  s = a.status();
  assert.equal(s.spellReady, true);
  assert.equal(s.weaponInHand, false, 'MW-CAST1: the casting hands are empty');
  // ...and the spell hand coming up over that stance (the weapon drawn with a spell readied) takes the weapon's back
  a.setSpellHand(true);
  a.readySpell(true);
  s = a.status();
  assert.equal(s.spellReady, false, 'the Spell stance let go for the spell hand');
  assert.equal(s.weaponGroup, 'weapononehand');
  assert.equal(s.weaponInHand, true);
  a.unload();
});

test('MIXED-PAIR THE ARM\'S LAW (mixedArm.js): gunArmOf names the gun\'s arm beside a blade - never two blades, two guns, one weapon or a single hand; a left blow of the other kind plays the left weapon\'s type; the gun stance holds the gun\'s hand alone in a mixed pair, both hands in a gun pair, and one gun with its free hand placed - or left to a spell (mutants: each arm of gunHoldOf; blowTypeOf for the right hand)', () => {
  const blade = { holdAs: null, type: MW_WEAPON_TYPE.LongBladeOneHand }, gun = { holdAs: 'pistol', type: MW_WEAPON_TYPE.MarksmanThrown };
  assert.equal(gunArmOf({ dual: true, weapon: blade, offWeapon: gun }), 'L');
  assert.equal(gunArmOf({ dual: true, weapon: gun, offWeapon: blade }), 'R');
  assert.equal(gunArmOf({ dual: true, weapon: blade, offWeapon: { ...blade } }), null);
  assert.equal(gunArmOf({ dual: true, weapon: gun, offWeapon: { ...gun } }), null);
  assert.equal(gunArmOf({ dual: false, weapon: blade, offWeapon: gun }), null, 'one hand in use');
  assert.equal(gunArmOf({ dual: true, weapon: blade, offWeapon: null }), null);
  assert.equal(blowTypeOf({ gunArm: 'L', hand: 'L', offType: gun.type }), gun.type);
  assert.equal(blowTypeOf({ gunArm: 'R', hand: 'L', offType: blade.type }), blade.type);
  assert.equal(blowTypeOf({ gunArm: 'L', hand: 'R', offType: gun.type }), null, 'the right hand\'s blow is the arm\'s own');
  assert.equal(blowTypeOf({ gunArm: null, hand: 'L', offType: gun.type }), null, 'a blade pair keeps the mirror of the right\'s');
  assert.deepEqual(gunHoldOf({ weapon: blade, offWeapon: gun, dual: true, offShown: true }), { row: gun, pair: false, only: 'L', lone: false });
  assert.deepEqual(gunHoldOf({ weapon: gun, offWeapon: blade, dual: true, offShown: true }), { row: gun, pair: false, only: 'R', lone: false });
  assert.deepEqual(gunHoldOf({ weapon: gun, offWeapon: { ...gun }, dual: true, offShown: true }), { row: gun, pair: true, only: null, lone: false });
  assert.deepEqual(gunHoldOf({ weapon: gun }), { row: gun, pair: false, only: null, lone: true }, 'one gun: its free hand placed (AUDIT SPELL-HAND L3-10: `lone` - at the hold\'s eased weight)');
  assert.deepEqual(gunHoldOf({ weapon: gun, spellHand: true }), { row: gun, pair: false, only: 'R', lone: true }, 'beside a spell: the free hand the spell\'s');
  assert.equal(gunHoldOf({ weapon: blade }), null);
  assert.equal(gunHoldOf({ weapon: blade, offWeapon: gun, dual: true, offShown: false }), null, 'the left gun not shown: no hold');
});

test('MIXED-PAIR THE PISTOL STANCE\'S ONE HAND (`only`): the gun hand alone - the right on Weapon Bone, the left on Weapon Bone Left in the single stance\'s mirror - the other hand left to what holds it; the default keeps the pair\'s two and the single\'s free hand (mutants: `only` unread; the left gun on the right\'s bone; the free hand\'s weight unread)', async () => {
  // retail's bones in the steel plate, a pistol in each hand (pistolstance.test.js's own assembly), posed at rest
  const skeletonBytes = retailSkeleton();
  const files = new Map([[`meshes/${OWN_MW_MODELS[PISTOLET_TEMPLATE].model}`, onDisk('src/assets/mw/meshes/pistolet.nif')]]);
  const arc = { has: (p) => files.has(p), get: (p) => files.get(p) };
  const find = (p) => (arc.has(p) ? arc : null), has = archiveHas([arc]);
  const res = resolveWeaponParts({ weapon: GUN, hasAmmo: true, allWeapons: [], find, skeletonBytes, has });
  const off = resolveOffWeaponParts({ weapon: GUN, allWeapons: [], find, skeletonBytes, has, hasBone: () => true });
  const worn = composeWornArmor({ pieces: [102, 103, 104, 105, 106, 107, 108].map((t) => ({ templateIndex: t, material: 0x201 })), armors: [], bodyPool: [] });
  const parts = [...worn.adds.map((x) => ({ slot: x.slot, partName: x.partName, bones: x.bones, bytes: onDisk(`src/assets/mw/meshes/${x.model}`) })), ...res.parts, ...off.parts];
  const asm = await assembleFirstPersonArm({ skeletonBytes, parts, offWeaponBone: true });
  assert.ok(asm.ok, asm.error);
  poseAssembly(asm, {});
  const mats = asm.mats;
  const keys = (req) => Object.keys(req?.hands ?? {}).sort().join('');
  assert.equal(keys(pistolStanceRequest(asm.skeleton, mats, {})), 'LR', 'one gun: the gun hand and the free hand');
  assert.equal(keys(pistolStanceRequest(asm.skeleton, mats, { pair: true })), 'LR', 'a pair: both on their guns');
  assert.equal(keys(pistolStanceRequest(asm.skeleton, mats, { only: 'R' })), 'R', 'the right gun alone');
  assert.equal(keys(pistolStanceRequest(asm.skeleton, mats, { only: 'L' })), 'L', 'the left gun alone');
  // AUDIT SPELL-HAND L3-10: a lone gun's free hand at the weight the hold hands it (`free`), easing out under a spell -
  // placed while it has any, left to the spell at none
  assert.equal(pistolStanceRequest(asm.skeleton, mats, { only: 'R', free: 0.4 })?.hands.L?.w, 0.4, 'the free hand at its weight');
  assert.equal(keys(pistolStanceRequest(asm.skeleton, mats, { only: 'R', free: 0 })), 'R', 'at none: the spell\'s');
  assert.equal(pistolStanceRequest(asm.skeleton, mats, {})?.hands.L?.w, 1, 'unasked: whole');
  const both = pistolStanceRequest(asm.skeleton, mats, { pair: false }), left = pistolStanceRequest(asm.skeleton, mats, { only: 'L' });
  assert.notDeepEqual(left.hands.L.at, both.hands.L.at, 'the left gun\'s hand is on its gun, not the free hand\'s place');
});

test('MIXED-PAIR THE LIVE ARM, A BLADE AND THE PISTOLET: the left hand\'s blow plays in ITS weapon\'s group - a shot\'s "shoot" in the thrown group - and the arm\'s own group is the blade\'s again after it; at rest the left arm holds its own weapon\'s idle in the mirror (mutants: the blow in the right\'s group; the group kept after the blow; the left arm the right weapon\'s mirror, at rest and under the blade\'s blow; the aim raised by the blade)', async () => {
  const { a } = await arm();
  a.setHands({ mode: 'dual', lead: 'R' });
  assert.equal(await a.setOffWeapon(GUN), true, 'the pistol on the left hand');
  run(a, 0.3);
  assert.equal(a.handsState().composed, 'dual:mixed', 'the left arm its own weapon\'s idle');
  assert.equal(a.attack('StrikeDown', { hand: 'L' }), 'shoot', 'the left hand shoots');
  assert.equal(a.status().weaponGroup, 'throwweapon', 'in the thrown group');
  run(a, 3);
  assert.equal(a.status().upper, UPPER_BODY.WeaponEquipped);
  assert.equal(a.status().weaponGroup, 'weapononehand', 'the blade\'s group again');
  // AUDIT MIXED-PAIR L5-7: under the right blade's blow the gun's aim stays down (it comes up for its own hand's shot alone)
  // and the left arm keeps its OWN weapon's idle - never the blade's mirrored (the guard's dip lowers it; it never swings out)
  run(a, 6);
  const rest = a.handsState().wrists.L;
  assert.ok(a.rifleState().ready < 0.05, `at rest, past the hold: the aim down (${a.rifleState().ready})`);
  assert.notEqual(a.attack('StrikeDown', { hand: 'R' }), 'shoot', 'the right hand swings its blade');
  for (let i = 0; i < 4; i++) a.update(0.05);
  assert.equal(a.handsState().composed, 'dual:R');
  assert.ok(a.rifleState().ready < 0.05, `the blade's blow: no aim (${a.rifleState().ready})`);
  assert.ok(Math.abs(a.handsState().wrists.L[0] - rest[0]) < 0.02, `the left arm its own weapon's idle under the blade's blow (x ${rest[0].toFixed(3)} -> ${a.handsState().wrists.L[0].toFixed(3)})`);
  assert.equal(a.status().weaponGroup, 'weapononehand');
  a.unload();
});

test('MIXED-PAIR A BLOW CUT SHORT HANDS THE ARM ITS OWN GROUP BACK: the left hand\'s shot put away mid wind-up unequips in the blade\'s group, a death mid-shot leaves the blade\'s, and a weapon swapped into the hand mid-shot re-resolves without it - never the struck hand\'s group left standing (mutants: the sheathe, the death, the swap blind to the blow\'s group)', async () => {
  const sheathe = (await arm()).a;
  sheathe.setHands({ mode: 'dual', lead: 'R' });
  await sheathe.setOffWeapon(GUN);
  run(sheathe, 0.3);
  assert.equal(sheathe.attack('StrikeDown', { hand: 'L' }), 'shoot');
  assert.equal(sheathe.status().weaponGroup, 'throwweapon');
  assert.equal(sheathe.status().upper, UPPER_BODY.AttackWindUp, 'mid wind-up');
  assert.equal(sheathe.setSheathed(true), true, 'put away');
  assert.equal(sheathe.status().weaponGroup, 'weapononehand', 'the unequip plays in the blade\'s group');
  run(sheathe, 3);
  sheathe.setSheathed(false);
  run(sheathe, 3);
  assert.equal(sheathe.status().weaponGroup, 'weapononehand', 'and drawn again, the blade\'s');
  sheathe.unload();
  const death = (await arm()).a;
  death.setHands({ mode: 'dual', lead: 'R' });
  await death.setOffWeapon(GUN);
  run(death, 0.3);
  death.attack('StrikeDown', { hand: 'L' });
  death.die();
  assert.equal(death.status().weaponGroup, 'weapononehand', 'a death mid-shot');
  death.unload();
  const swap = (await arm()).a;
  swap.setHands({ mode: 'dual', lead: 'R' });
  await swap.setOffWeapon(GUN);
  run(swap, 0.3);
  swap.attack('StrikeDown', { hand: 'L' });
  await swap.setWeapon(null);
  swap.setSheathed(false);
  run(swap, 3);
  assert.notEqual(swap.status().weaponGroup, 'throwweapon', `the hand swapped mid-shot (${swap.status().weaponGroup})`);
  swap.unload();
});

test('MIXED-PAIR THE BODY ON RETAIL\'S BONES (third person): a longsword in the right hand and the Pistolet in the left - the gun\'s hold comes on for the LEFT hand alone, on its own pistol, and the right arm is left to its blade (never solved onto a gun); sheathed, the hold goes (mutants: the hold for a gun in the right only; the stance\'s one hand not handed on)', async () => {
  const kf = new Uint8Array(armClip());
  const weap = wpdtRec('iron longsword', 'w/blade.nif', MW_WEAPON_TYPE.LongBladeOneHand);
  const deps = retailBodyDeps({ records: [weap], files: [[FP_CLIP_PATH, kf], ['meshes/xbase_anim.kf', kf], ['meshes/w/blade.nif', f('weapon.nif')]], before: [shippedArchive(['meshes/pistolet.nif', 'textures/pistolet.dds'])] });
  const renderer = countingRenderer();
  renderer.updateParticleEffect = () => {};
  renderer.renderCharacterSpriteImage = () => ({});
  const a = createFpArm();
  const cam = { pos: [0, 1.6, 0], yaw: 0, move: { forward: 0, strafe: 0, speed: 0, running: false } };
  a.attach(renderer, () => cam);
  const built = await a.build({ race: 'fprace', weapon: { templateIndex: 120 }, deps });
  assert.equal(built.ok, true, built.ok ? '' : `${built.stage}: ${built.error}`);
  assert.equal(built.third?.ok, true, 'the body stands');
  assert.equal(a.setViewMode('third'), true);
  a.setSheathed(false);
  a.setHands({ mode: 'dual', lead: 'R' });
  assert.equal(await a.setOffWeapon(GUN), true, 'the pistol on the left hand');
  for (let i = 0; i < 90; i++) a.update(1 / 30);
  assert.ok(a.rifleState().w > 0.99, `the left gun held (${a.rifleState().w})`);
  const t = a.built().third.arm;
  assert.ok(t.holdFit && t.holdFit.reach.L < 0.05, `the left hand on its pistol (${t.holdFit?.reach?.L})`);
  assert.equal(t.holdFit.reach.R, null, 'the right arm left to its blade');
  a.setSheathed(true);
  for (let i = 0; i < 60; i++) a.update(1 / 30);
  assert.equal(a.rifleState().w, 0, 'sheathed: the hold off');
  a.unload();
});

// ---- AUDIT MIXED-PAIR / SPELL-HAND on the arm (bible/01-Overview/audits/Audit-Mixed-Pair-Spell-Hand.md) ----------------

test('AUDIT L3-11 THE ARM\'S LAWS IN THEIR MODULES (HOST-SPLIT): the spell hand\'s stance step (wait under an equip or an unequip, finish a cast, let a Spell stance go, keep), the draw into the spell hand, the off arm\'s own stance type, the gun\'s aim for its own shot alone, the striking weapon, the shot\'s piece (mutants: each answer of each law)', () => {
  const U = UPPER_BODY;
  assert.equal(spellHandStanceStep({ upper: U.Equipping, spellReady: true }, U), 'wait');
  assert.equal(spellHandStanceStep({ upper: U.Unequipping, spellReady: true }, U), 'wait');
  assert.equal(spellHandStanceStep({ upper: U.Casting, spellReady: true }, U), 'afterCast');
  assert.equal(spellHandStanceStep({ upper: U.WeaponEquipped, spellReady: true }, U), 'drop');
  assert.equal(spellHandStanceStep({ upper: U.WeaponEquipped, spellReady: false }, U), 'keep', 'L5-7: a repeat asks nothing of the stance');
  assert.equal(drawsIntoSpellHand({ spellHand: true, spellReady: true }), true);
  assert.equal(drawsIntoSpellHand({ spellHand: true, spellReady: true, casting: true }), false);
  assert.equal(drawsIntoSpellHand({ spellHand: false, spellReady: true }), false);
  const blade = { type: MW_WEAPON_TYPE.LongBladeOneHand }, gun = { type: MW_WEAPON_TYPE.MarksmanThrown, holdAs: 'pistol' };
  assert.equal(offStanceTypeOf({ weapon: blade, offWeapon: gun }), gun.type, 'a gun beside a blade: its own stance');
  assert.equal(offStanceTypeOf({ weapon: blade, offWeapon: { ...blade } }), null, 'two blades: the right\'s mirror');
  const hold = { only: 'L' };
  assert.equal(gunAimShooting({ attacking: true, hold, dual: true, hand: 'L' }), true, 'the gun\'s own shot');
  assert.equal(gunAimShooting({ attacking: true, hold, dual: true, hand: 'R' }), false, 'L5-7: never the blade\'s blow');
  assert.equal(gunAimShooting({ attacking: false, hold, dual: true, hand: 'L' }), false);
  assert.equal(blowWeaponOf({ hand: 'L', weapon: blade, offWeapon: gun }), gun);
  assert.equal(blowWeaponOf({ hand: 'R', weapon: blade, offWeapon: gun }), blade);
  const pieces = [{ slot: 'weapon', id: 'R' }, { slot: 'offweapon', id: 'L' }];
  assert.equal(muzzlePieceOf(pieces, 'L').id, 'L', 'L3-6: the left hand\'s own barrel');
  assert.equal(muzzlePieceOf(pieces, 'R').id, 'R');
  assert.equal(muzzlePieceOf([pieces[0]], 'L').id, 'R', 'no left piece bound: the right\'s');
});

test('AUDIT L3-2 / L3-8 / L3-9 THE ARM\'S CLOCK: a cast pressed in a blow\'s follow-through plays (the follow is cut, as the next blow cuts it); the left hand\'s shot plays at ITS weapon\'s record pace, never the right blade\'s; a weapon swapped into the hand mid-cast waits for the cast to end (mutants: the follow refusing the cast; the right\'s pace on the left blow; the swap cutting the cast)', async () => {
  const { a } = await arm();
  a.setHands({ mode: 'dual', lead: 'R' });
  assert.equal(await a.setOffWeapon(GUN), true);
  run(a, 0.3);
  assert.equal(a.attack('StrikeDown', { hand: 'L' }), 'shoot');
  for (let i = 0; i < 200 && a.status().upper !== UPPER_BODY.AttackEnd; i++) a.update(1 / 120);
  assert.equal(a.status().upper, UPPER_BODY.AttackEnd, 'the shot\'s follow-through');
  assert.equal(a.castSpell(2), true, 'a cast pressed now plays');
  assert.equal(a.castInFlight(), true);
  a.unload();
  // the left gun's wind-up on its own record (speed 1), the blade slowed to 0.5 beside it
  const slow = (await arm({ speed: 0.5 })).a;
  slow.setHands({ mode: 'dual', lead: 'R' });
  await slow.setOffWeapon(GUN);
  run(slow, 0.3);
  const fast = (await arm({ speed: 1 })).a;
  fast.setHands({ mode: 'dual', lead: 'R' });
  await fast.setOffWeapon(GUN);
  run(fast, 0.3);
  const windUp = (x) => { x.attack('StrikeDown', { hand: 'L' }); let t = 0; while (x.status().upper === UPPER_BODY.AttackWindUp && t < 5) { x.update(1 / 120); t += 1 / 120; } return t; };
  const ts = windUp(slow), tf = windUp(fast);
  assert.ok(Math.abs(ts - tf) < 0.02, `the left shot's pace is the gun's, whatever the blade's (${ts.toFixed(3)} beside a 0.5 blade, ${tf.toFixed(3)} beside a 1)`);
  slow.unload(); fast.unload();
  // a swap mid-cast waits for the cast's end
  const c = (await arm()).a;
  c.readySpell(true);
  run(c, 0.5);
  assert.equal(c.castSpell(2), true);
  assert.equal(c.setWeapon(GUN), false, 'mid-cast: the hand is not changed');
  assert.equal(c.castInFlight(), true, 'the cast plays on');
  for (let i = 0; i < 400 && c.castInFlight(); i++) c.update(0.02);
  assert.notEqual(c.setWeapon(GUN), false, 'the cast over: the swap goes');
  c.unload();
});

test('AUDIT L3-3 Z KEEPS THE SPELL ON THE ARM: the weapon put away with the spell kept unequips in its OWN group and leaves the hand (the stance waits for the unequip); drawn again with the spell hand up it comes up in its own stance - never the spellcast group\'s equip (mutants: the stance flipped mid-unequip; the draw blind to the spell hand)', async () => {
  const { a } = await arm();
  a.setSpellHand(true); a.readySpell(true);
  run(a, 0.3);
  assert.equal(a.status().weaponGroup, 'weapononehand', 'the spell in the free hand: the weapon\'s stance');
  // Z: the rig tells the arm the hand first (sheathed: no spell hand), then the sheathe, then the spell
  a.setSpellHand(false); a.setSheathed(true); a.readySpell(true);
  assert.equal(a.status().weaponGroup, 'weapononehand', 'the unequip in the weapon\'s own group');
  for (let i = 0; i < 400 && a.status().upper === UPPER_BODY.Unequipping; i++) { a.update(0.02); a.setSpellHand(false); a.readySpell(true); }
  assert.equal(a.status().upper, UPPER_BODY.None);
  assert.equal(a.status().weaponShown, false, 'the blade left the hand');
  run(a, 0.2, () => { a.setSpellHand(false); a.readySpell(true); });
  assert.equal(a.status().spellReady, true, 'sheathed: DFU\'s two-handed stance');
  // Z again: drawn with the spell hand up
  a.setSpellHand(true); a.setSheathed(false); a.readySpell(true);
  assert.equal(a.status().weaponGroup, 'weapononehand', 'the draw in the weapon\'s group, the Spell stance let go first');
  assert.equal(a.status().spellReady, false);
  a.unload();
});

test('AUDIT L3-7 / L3-10 A BLOW CUT SHORT, A FREE HAND EASED: a rebuild mid-shot hands the arm its own group back; a view switch resets the blow (its line); a lone gun\'s free hand eases out under a spell on the hold\'s own ease and the stance places it at that weight (mutants: the rebuild keeping the struck hand\'s group; the free hand switched whole; the weight unpassed)', async () => {
  const { a, deps } = await arm();
  a.setHands({ mode: 'dual', lead: 'R' });
  await a.setOffWeapon(GUN);
  run(a, 0.3);
  a.attack('StrikeDown', { hand: 'L' });
  assert.equal(a.status().weaponGroup, 'throwweapon');
  const res = await a.build({ race: 'fprace', weapon: { templateIndex: 120 }, deps });
  assert.ok(res.ok);
  a.setSheathed(false);
  for (let i = 0; i < 400 && a.status().upper !== UPPER_BODY.WeaponEquipped; i++) a.update(0.05);
  assert.equal(a.status().weaponGroup, 'weapononehand', 'rebuilt: the blade\'s group, the shot\'s gone with it');
  a.unload();
  assert.match(readFileSync(new URL('../../src/combat/fpArm.js', import.meta.url), 'utf8'), /viewMode = want;\n\s*actionState = null; actionSource = null; attackType = null; holdWindUp = false;\n\s*blowType = null; attackHand = null;/, 'the view switch resets the blow too');
  // the free hand's weight: 1 with no spell, easing to 0 under one (never a step), back on the hold's ease
  let s = { w: 1, ready: 0, since: Infinity };
  s = rifleStanceStep(s, { wanted: true, free: true, dt: 0.016 });
  assert.equal(s.free, 1, 'no spell: the free hand whole');
  s = rifleStanceStep(s, { wanted: true, free: false, dt: 0.016 });
  assert.ok(s.free > 0.5 && s.free < 1, `under a spell: eased, not switched (${s.free.toFixed(3)})`);
  for (let i = 0; i < 60; i++) s = rifleStanceStep(s, { wanted: true, free: false, dt: 0.016 });
  assert.ok(s.free < 0.01, 'and gone');
  assert.match(readFileSync(new URL('../../src/combat/fpArm.js', import.meta.url), 'utf8'), /only: g\.lone \? 'R' : g\.only, free: g\.lone \? \(rifle\.free \?\? 1\) : 0/, 'the hold places the free hand at that weight');
});

test('AUDIT L5-8 A BLOW THE ARM CANNOT PLAY LEAVES ITS GROUP AS IT WAS: a .kf whose thrown group has no "shoot start" (the never-traps law: a missing key degrades) refuses the left gun\'s shot, and the arm stays in the blade\'s group - never stuck in the gun\'s with no blow playing (mutant: the abort keeping the struck hand\'s group)', async () => {
  const { a } = await arm({ drop: /Shoot Start/ });
  a.setHands({ mode: 'dual', lead: 'R' });
  assert.equal(await a.setOffWeapon(GUN), true);
  run(a, 0.3);
  assert.equal(a.attack('StrikeDown', { hand: 'L' }), null, 'no wind-up to play: refused');
  assert.equal(a.status().weaponGroup, 'weapononehand', 'the blade\'s group');
  assert.equal(a.status().upper, UPPER_BODY.WeaponEquipped);
  run(a, 0.5);
  assert.equal(a.status().weaponGroup, 'weapononehand', 'and it stays');
  a.unload();
});

test('AUDIT L5-8 THE SHEET TAKES THE SPELL HAND\'S ARM: a map held open (MAP3\'s sheet) takes both hands from the spell hand\'s composition - the hands something else has are taken, as a pair\'s are (mutant: the spell arm composed over the sheet and the climb)', async () => {
  const { a } = await arm();
  a.setSpellHand(true); a.readySpell(true);
  run(a, 0.3);
  assert.equal(a.handsState().composed, 'spellhand:ready');
  let held = false;
  for (let i = 0; i < 5 && !held; i++) { held = a.holdPaper(); a.update(0.05); }
  assert.equal(held, true, 'the sheet in the hands');
  run(a, 0.3, () => { a.setSpellHand(true); a.readySpell(true); });
  assert.equal(a.handsState().composed, 'taken', 'the sheet\'s hands, never the spell\'s');
  a.unload();
});
