// WEREWOLF1 — BLOODMOON'S WEREWOLF, IMPORTED (2026-09-26).
//
// Mac, of SirMcMobdon's werewolf skin: "it's the 3d model", "Might need to grab OpenMW for this", "Well it needs to
// be imported if its not. It shouldnt be skipped". The Morrowind rig had scoped the werewolf out (fpArm.js, rule 6);
// this is the werewolf OpenMW draws, read off its source (apps/openmw/mwrender/npcanimation.cpp, actorutil.cpp,
// mwmechanics/mechanicsmanagerimp.cpp):
//
//   - the skeletons are [Models] wolfskin / wolfskin1st (meshes/wolf/skin.nif, skin.1st.nif), whatever the race or
//     sex, through rule 18's x-swap;
//   - ONE animation source, the wolf's own .kf - the base (xbase_anim) is never added for a werewolf;
//   - getBodyParts answers nothing, so the body is the CLOT "werewolfrobe" setWerewolf equips in the Robe slot - its
//     part references at the robe's priority, its reserves beside them - with WerewolfHead and WerewolfHair looked up
//     by id in third person; in first person the robe takes addPartGroup's ".1st" ladder;
//   - the wolf holds nothing (unequipAll): no weapon, no torch, no lantern, no holster;
//   - the body follows the curse: the rig rebuilds as the wolf, and back, the moment the form changes - for the
//     player and for a peer whose pose says `wb` 1. The wereboar has no Morrowind form.
//
// No Bloodmoon data is in this container: the fixtures stand in for its files, under its own paths, and the
// law under test is which files are asked for and how they are dressed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { countingRenderer, werewolfBodyDeps as wolfDeps } from './fixtures/mw/bodyRig.mjs';
import { buildFpArm, createFpArm, fpArm, fpSkeletonPath, tpSkeletonPath, fpWeaponKey, WOLFSKIN, WOLFSKIN_1ST, FP_CLIP_PATH } from '../src/combat/fpArm.js';
import { fpAnimSources, tpAnimSources, werewolfHeadRows, bodyParts, clothingRecords, extractArmRecords, ARM_RECORDS_VERSION } from '../src/formats/mwFirstPerson.js';
import { correctActorModelPath } from '../src/formats/mwTexture.js';
import { composeWornArmor, firstPersonPartGroup, werewolfRobeOf, WEREWOLF_ROBE_ID, RESERVES, ARMO_PART, mwClothingRecord, DF_CLOTHING_ROWS, DF_CLOTHING_DYE_RGB } from '../src/formats/mwItemMap.js';
import { isMwWerewolf, armBuildOptsOf, armIdentityOf, armsStandFor, createWeaponRig } from '../src/combat/weaponRig.js';
import { PeerBodies, peerBuildOpts, peerBodyKey, peerIsWolf, BODY_REBUILD_MS, BODY_RETRY_MS, BODY_LINGER_MS } from '../src/net/peerBodies.js';
import { WERECLAWS_ITEM } from '../src/systems/lycanthropy.js';
import { lookKey } from '../src/net/remotePlayers.js';
import { EQUIP_SLOTS } from '../src/systems/equip.js';
import { createPeerRiders } from '../src/net/peerRiders.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const flush = () => new Promise((r) => setTimeout(r, 0));
const settle = async (n = 40) => { for (let i = 0; i < n; i++) await flush(); };

const transformed = (type) => ({ race: 'Breton', gender: 'male', faceIndex: 0, items: [], activeEffects: [{ kind: 'racialOverride', racial: 'lycanthropy', isTransformed: true, infectionType: type }] });

// ── THE FILES ASKED FOR ─────────────────────────────────────────────

test('WEREWOLF1 paths: the wolf\'s two skeletons whatever the race or the sex (getActorSkeleton tests the werewolf first), x-swapped when the wolf\'s .kf is there, and ONE animation source each - the wolf\'s own, never the base (mutants: the base kept; the beast column asked first)', () => {
  assert.equal(WOLFSKIN, 'meshes/wolf/skin.nif', '[Models] wolfskin');
  assert.equal(WOLFSKIN_1ST, 'meshes/wolf/skin.1st.nif', '[Models] wolfskin1st');
  for (const o of [{}, { female: true }, { beast: true }, { female: true, beast: true }]) {
    assert.equal(fpSkeletonPath({ ...o, werewolf: true }), WOLFSKIN_1ST, JSON.stringify(o));
    assert.equal(tpSkeletonPath({ ...o, werewolf: true }), WOLFSKIN, JSON.stringify(o));
  }
  assert.equal(fpSkeletonPath({}), 'meshes/xbase_anim.1st.nif', 'a person keeps the table');
  const has = new Set(['meshes/wolf/xskin.kf', 'meshes/wolf/xskin.1st.kf', 'meshes/xbase_anim.kf', 'meshes/xbase_anim.1st.kf']);
  const exists = (p) => has.has(p);
  assert.equal(correctActorModelPath(WOLFSKIN, exists), 'meshes/wolf/xskin.nif', 'rule 18: the x-form, its .kf being there');
  assert.equal(correctActorModelPath(WOLFSKIN_1ST, exists), 'meshes/wolf/xskin.1st.nif');
  assert.deepEqual(tpAnimSources('meshes/wolf/xskin.nif', exists, { werewolf: true }), ['meshes/wolf/xskin.kf'], 'the wolf\'s own .kf alone - xbase_anim.kf is there and is not taken');
  assert.deepEqual(fpAnimSources('meshes/wolf/xskin.1st.nif', exists, { werewolf: true }), ['meshes/wolf/xskin.1st.kf']);
  assert.deepEqual(tpAnimSources('meshes/xbase_anim.nif', exists), ['meshes/xbase_anim.kf'], 'a person: the base, as before');
  assert.deepEqual(fpAnimSources('meshes/wolf/xskin.1st.nif', exists), ['meshes/xbase_anim.1st.kf', 'meshes/wolf/xskin.1st.kf'], '(the base is exactly what the flag takes away)');
});

// ── THE BODY: THE ROBE, THE HEAD AND THE HAIR ───────────────────────

test('WEREWOLF1 the robe: "werewolfrobe" is found by id, the last .esm winning; composed as a garment handed in whole - its references at the robe\'s priority (24) and its eleven reserves - it IS the body; the head and hair are WerewolfHead and WerewolfHair by id alone (mutants: the robe\'s reserves dropped; the head filtered by race)', () => {
  const fx = wolfDeps();
  const parts = bodyParts(fx.esm);
  const clothes = clothingRecords(fx.esm);
  const robe = werewolfRobeOf(clothes);
  assert.equal(WEREWOLF_ROBE_ID, 'werewolfrobe');
  assert.equal(robe?.id, 'werewolfrobe', 'case-folded, as every record id');
  assert.deepEqual(robe.parts.map((p) => p.part), [6, 7, 13, 14, 3]);
  const later = { ...robe, parts: [] };
  assert.equal(werewolfRobeOf([robe, { id: 'other' }, later]), later, 'the last .esm to carry it wins');
  assert.equal(werewolfRobeOf([{ id: 'common_robe_01' }]), null);
  const worn = composeWornArmor({ pieces: [{ kind: 'record', record: robe, reserve: 'robe' }], armors: [], clothes: [], bodyPool: parts, female: false });
  assert.deepEqual(worn.adds.map((a) => [a.partName, a.model]), [
    ['cuirass', 'fixture/wolfchest.nif'], ['right hand', 'fixture/wolfhand.nif'], ['left hand', 'fixture/wolfhand.nif'],
    ['right upper arm', 'fixture/wolfarm.nif'], ['left upper arm', 'fixture/wolfarm.nif'],
  ], 'the robe\'s references, in slot order, third person: the plain records');
  for (const part of RESERVES.robe) assert.ok(worn.shadows.includes(ARMO_PART[part].shadows ?? '') || !ARMO_PART[part].shadows, `reserve ${ARMO_PART[part].name} hides its skin`);
  assert.ok(worn.shadows.includes('groin') && worn.shadows.includes('knee:right'), 'the robe\'s reserves hide what it does not name');
  assert.ok(!worn.shadows.includes('head') && !worn.shadows.includes('hair'), 'the head and hair are the wolf\'s own');
  assert.deepEqual(werewolfHeadRows(parts).map((r) => [r.slot, r.record?.model ?? null]), [['head', 'fixture/wolfhead.nif'], ['hair', 'fixture/wolfhair.nif']],
    'by id (the record says race "werewolf" and the actor is anybody)');
  assert.deepEqual(werewolfHeadRows([]).map((r) => r.record), [null, null], 'no Bloodmoon, no head');
});

test('WEREWOLF1 first person: addPartGroup\'s own ladder - a part\'s ".1st" record first, else the plain one only for a hand, wrist, forearm or upper arm, else the slot reserved empty; a woman\'s CNAM before the BNAM (mutants: the plain record taken for a chest; the .1st ignored)', () => {
  const fx = wolfDeps();
  const parts = bodyParts(fx.esm);
  const robe = werewolfRobeOf(clothingRecords(fx.esm));
  const fp = firstPersonPartGroup(robe, parts, false);
  assert.deepEqual(fp.adds.map((a) => [a.partName, a.model]), [
    ['right hand', 'fixture/wolfhand1st.nif'], ['left hand', 'fixture/wolfhand1st.nif'],
    ['right upper arm', 'fixture/wolfarm.nif'], ['left upper arm', 'fixture/wolfarm.nif'],
  ], 'the hand\'s .1st record; the upper arm\'s plain one (an arm part may fall back)');
  assert.deepEqual(fp.reserved, [3], 'the chest has no .1st record and is not an arm part: held, with nothing in it');
  const her = { id: 'x', parts: [{ part: 6, male: 'wolf_upperarm', female: 'wolf_hand' }] };
  assert.equal(firstPersonPartGroup(her, parts, true).adds[0].model, 'fixture/wolfhand1st.nif', 'a woman: her CNAM, its .1st');
  assert.equal(firstPersonPartGroup(her, parts, false).adds[0].model, 'fixture/wolfarm.nif', 'a man: the BNAM');
  assert.deepEqual(firstPersonPartGroup(null, parts).adds, [], 'no robe, nothing');
});

// ── THE BUILD ───────────────────────────────────────────────────────

test('WEREWOLF1 the build: the wolf\'s skeletons and .kf in both views, the robe\'s parts (first person through the .1st ladder), the head and hair by id, and nothing of the person - no race parts, no weapon, no torch, no lantern, no holster, no base animation (mutants: the race rows kept; the weapon kept; the base .kf added)', async () => {
  const fx = wolfDeps();
  const res = await buildFpArm({ race: 'fprace', werewolf: true, torch: true, hipLight: true, sheathing: true, deps: fx.deps });
  assert.equal(res.ok, true, `${res.stage}: ${res.error}`);
  assert.equal(res.werewolf, true);
  assert.equal(res.settingsSkeleton, WOLFSKIN_1ST);
  assert.equal(res.skeletonPath, 'meshes/wolf/xskin.1st.nif');
  assert.deepEqual(res.sources.map((s) => s.name), ['meshes/wolf/xskin.1st.kf'], 'one source, the wolf\'s');
  assert.equal(res.weapon, null, 'the wolf holds nothing');
  assert.equal(res.torch ?? null, null);
  const t = res.third;
  assert.equal(t?.ok, true, `the wolf in third person (${t?.stage}: ${t?.error})`);
  assert.equal(t.werewolf, true);
  assert.equal(t.skeletonPath, 'meshes/wolf/xskin.nif');
  assert.deepEqual(t.sourcePaths, ['meshes/wolf/xskin.kf']);
  assert.deepEqual(t.rows.map((r) => [r.slot, r.record?.id]), [['head', 'WerewolfHead'], ['hair', 'WerewolfHair']]);
  assert.equal(t.weapon, null); assert.equal(t.torch ?? null, null); assert.equal(t.hipLight ?? null, null); assert.equal(t.holster ?? null, null);
  assert.deepEqual(t.boneSources, [], 'no addons - the base model\'s are not the wolf\'s');
  assert.equal(t.hipLightTried, false, 'the lantern it was asked for was never asked of the wolf');
  assert.equal(t.sheathing, false, 'nor the holster');
  // what was READ says what was taken
  for (const p of ['meshes/wolf/xskin.1st.nif', 'meshes/wolf/xskin.nif', 'meshes/wolf/xskin.1st.kf', 'meshes/wolf/xskin.kf',
    'meshes/fixture/wolfhand1st.nif', 'meshes/fixture/wolfarm.nif', 'meshes/fixture/wolfhand.nif', 'meshes/fixture/wolfchest.nif',
    'meshes/fixture/wolfhead.nif', 'meshes/fixture/wolfhair.nif']) {
    assert.ok(fx.reads.has(p), `${p} was read`);
  }
  for (const p of ['meshes/fixture/humanhand.nif', 'meshes/fixture/humanarm.nif', 'meshes/xbase_anim.kf', FP_CLIP_PATH, 'meshes/xbase_anim.1st.nif', 'meshes/xbase_anim.nif',
    'meshes/fixture/humanneck1st.nif', 'animations/xbase_anim/pelvisaddon.nif']) {
    assert.ok(!fx.reads.has(p), `${p} is the person's, and was not read`);
  }
  // AUDIT C6: the head, the hair and the robe's chest BIND - the fixture's third-person skeleton has their bones now
  assert.deepEqual(t.arm.pieces.map((q) => q.slot), ['head', 'hair', 'cuirass (werewolfrobe)', 'right hand (werewolfrobe)', 'left hand (werewolfrobe)',
    'right upper arm (werewolfrobe)', 'left upper arm (werewolfrobe)'], 'WerewolfHead and WerewolfHair on the Head bone, the robe on the rest');
  assert.deepEqual(t.notes, [], 'nothing refused');
  // the person, from the same data, is untouched
  const man = await buildFpArm({ race: 'fprace', deps: wolfDeps().deps });
  assert.equal(man.ok, true); assert.equal(man.werewolf, false);
  assert.equal(man.skeletonPath, 'meshes/xbase_anim.1st.nif');
});

test('WEREWOLF1 without Bloodmoon: the wolf is refused at its skeleton, by name - the transformed player then stands as Eye Of The Beholder\'s lycanthrope and the classic claws, as before; a missing robe is a note, and the wolf\'s parts are its head alone (mutants: a person silently built in the wolf\'s place)', async () => {
  const none = await buildFpArm({ race: 'fprace', werewolf: true, deps: wolfDeps({ wolf: false }).deps });
  assert.equal(none.ok, false);
  assert.equal(none.stage, 'skeleton');
  assert.match(none.error, /meshes\/wolf\/skin\.1st\.nif is not in your archives/);
  const bare = await buildFpArm({ race: 'fprace', werewolf: true, deps: wolfDeps({ robe: false }).deps });
  assert.equal(bare.ok, false, 'no robe: no first-person mesh at all');
  assert.equal(bare.stage, 'parts');
  assert.match(bare.error, /werewolf/);
  assert.ok(bare.notes.some((n) => /werewolfrobe: no CLOT record carries it - Bloodmoon\.esm does, and it is not attached/.test(n)), bare.notes.join(' | '));
  // AUDIT C7: which of the two - Bloodmoon.esm attached and naming no robe (a mod's master) is its own note
  const named = await buildFpArm({ race: 'fprace', werewolf: true, deps: wolfDeps({ robe: false, esmNames: ['armfp.esm', 'Bloodmoon.esm'] }).deps });
  assert.ok(named.notes.some((n) => /werewolfrobe: Bloodmoon\.esm is attached and no CLOT record here names it/.test(n)), named.notes.join(' | '));
  // AUDIT C7: the wolf's skeleton standing and its .kf missing names the WOLF'S file - the base's is not the wolf's to take
  const nokf = await buildFpArm({ race: 'fprace', werewolf: true, deps: wolfDeps({ wolfKf: false }).deps });
  assert.equal(nokf.stage, 'clip');
  assert.equal(nokf.error, 'no werewolf animation file - meshes/wolf/skin.1st.kf is not in your archives');
});

test('WEREWOLF1 (AUDIT C2) a robe with no MODL: Clothing::load reads MODL as optional and "werewolfrobe" is a technical item, so a CLOT with part references and no ground mesh is KEPT - the wolf builds - and the derived record set is re-extracted (its version moved); a garment the item icon cannot draw is still never a Daggerfall item\'s (mutants: the MODL required again; the version left; the garment pool opened to it)', async () => {
  const fx = wolfDeps({ robeModel: false });
  const robe = werewolfRobeOf(clothingRecords(fx.esm));
  assert.equal(robe?.model, '', 'kept, with no ground mesh');
  assert.equal(robe.parts.length, 5);
  assert.deepEqual(extractArmRecords(fx.esm).clothes.map((c) => c.id), clothingRecords(fx.esm).map((c) => c.id), 'the derived set reads the same');
  assert.equal(ARM_RECORDS_VERSION, 3, 'a set extracted before is refused and extracted again');
  const res = await buildFpArm({ race: 'fprace', werewolf: true, deps: fx.deps });
  assert.equal(res.ok, true, `${res.stage}: ${res.error}`);
  assert.equal(res.third?.ok, true);
  const name = Object.keys(DF_CLOTHING_ROWS).find((n) => DF_CLOTHING_ROWS[n].reserve === 'robe' && DF_CLOTHING_ROWS[n].type === 4);
  assert.equal(mwClothingRecord([{ id: 'plainrobe', model: '', type: 4, enchanted: false, parts: [{ part: 3, male: 'x' }] }], name).record, null, 'no garment without a model');
});

test('WEREWOLF1 (AUDIT C4) the robe in third person takes addPartGroup\'s own ladder, as the first person does: a woman\'s CNAM falls back to the BNAM, a man never wears a CNAM, and a reference nothing answers HOLDS its slot empty - the robe\'s head held so, WerewolfHead and WerewolfHair are not drawn (mutants: the CNAM-only part on a man; a miss claiming nothing)', () => {
  const parts = bodyParts(wolfDeps().esm);
  const rec = { id: 'werewolfrobe', parts: [{ part: 3, male: 'wolf_chest', female: 'not_here' }, { part: 13, male: '', female: 'wolf_upperarm' }, { part: 0, male: 'no_such_head' }] };
  const her = composeWornArmor({ pieces: [{ kind: 'record', record: rec, reserve: 'robe' }], armors: [], clothes: [], bodyPool: parts, female: true });
  assert.deepEqual(her.adds.map((a) => [a.partName, a.model]), [['cuirass', 'fixture/wolfchest.nif'], ['right upper arm', 'fixture/wolfarm.nif']],
    'a woman: her CNAM missing, the BNAM; her CNAM there, it');
  const him = composeWornArmor({ pieces: [{ kind: 'record', record: rec, reserve: 'robe' }], armors: [], clothes: [], bodyPool: parts, female: false });
  assert.deepEqual(him.adds.map((a) => a.partName), ['cuirass'], 'a man never wears the CNAM-only upper arm...');
  assert.ok(him.shadows.includes('upperarm:right'), '...its slot is held empty');
  for (const w of [her, him]) {
    assert.ok(w.shadows.includes('head'), 'the head reference nothing answers holds the head');
    assert.ok(w.notes.some((n) => /head wants "no_such_head" and no BODY record answers it - the slot is held empty/.test(n)), w.notes.join(' | '));
  }
  // the first person reads the same ladder
  assert.deepEqual(firstPersonPartGroup(rec, parts, true).adds.map((a) => a.partName), ['right upper arm']);
  assert.deepEqual(firstPersonPartGroup(rec, parts, true).reserved, [3, 0]);
});

// ── THE RIG FOLLOWS THE CURSE ───────────────────────────────────────

test('WEREWOLF1 the rig: setWerewolf rebuilds as the wolf and back, once per change (a boolean compare otherwise); the wolf wears none of the worn table and holds no light - kept for the way back; a wolf refused can still turn back (mutants: the compare dropped; the table rebuilt on the wolf; the refusal a dead end)', async () => {
  const fx = wolfDeps();
  const arm = createFpArm();
  arm.attach(countingRenderer(), () => null);
  const first = await arm.build({ race: 'fprace', deps: fx.deps });
  assert.equal(first.ok, true, `${first.stage}: ${first.error}`);
  assert.equal(arm.builtFor().werewolf, false);
  const opened = fx.opened;
  assert.equal(arm.setWerewolf(false), false, 'no change, no build');
  const became = await arm.setWerewolf(true);
  assert.equal(became.ok, true, `${became.stage}: ${became.error}`);
  assert.equal(arm.builtFor().werewolf, true, 'the wolf stands');
  assert.equal(fx.opened, opened + 1, 'one build');
  assert.equal(arm.setWerewolf(true), false, 'the fast path');
  assert.equal(arm.setWorn([{ kind: 'clothing', templateIndex: 0 }]), false, 'the wolf wears none of it');
  assert.equal(fx.opened, opened + 1, 'and is not rebuilt for it');
  assert.equal(arm.setTorch(true), false, 'nor holds a torch');
  assert.equal(arm.setHipLight(true), false, 'nor hangs a lantern (AUDIT F8)');
  assert.equal(arm.setWeapon(WERECLAWS_ITEM), false, 'the claws are its bare hands - no swap (AUDIT D7)');
  assert.equal(arm.setWeapon({ templateIndex: 120, group: 'Weapons', material: 0 }), false, 'nor any weapon a door hands it');
  assert.equal(arm.readySpell(true), false, 'readies no spell - "Werewolfs can not cast spells" (AUDIT E6)');
  assert.equal(arm.castSpell(0), false, 'and casts none');
  assert.equal(arm.readySpell(false), false, 'nor latched a stance casting (the turn back is cast in beast form)');
  assert.equal(fx.opened, opened + 1, 'none of it rebuilt the wolf');
  const back = await arm.setWerewolf(false);
  assert.equal(back.ok, true);
  assert.equal(arm.builtFor().werewolf, false, 'the person again');
  // refused: no Bloodmoon - and still the way back
  const none = wolfDeps({ wolf: false });
  const lone = createFpArm();
  lone.attach(countingRenderer(), () => null);
  assert.equal((await lone.build({ race: 'fprace', deps: none.deps })).ok, true);
  const refused = await lone.setWerewolf(true);
  assert.equal(refused.ok, false, 'the wolf refused');
  assert.equal(lone.active(), false, 'nothing of Morrowind stands - the sprite and the claws do');
  assert.equal(lone.setWerewolf(true), false, 'and it is not asked again every frame');
  assert.equal((await lone.setWerewolf(false)).ok, true, 'the person comes back');
  assert.equal(fpWeaponKey(WERECLAWS_ITEM, false), fpWeaponKey(null, false), 'AUDIT D3: the claws key as the empty hand');
});

test('WEREWOLF1 (AUDIT D4/D6) the form queues: asked during the FIRST build it waits for it (and is built after); asked while a door\'s build is queued it rides THAT build - the newer word (mutants: the form dropped before the first build; the queued build clearing the form)', async () => {
  const fx = wolfDeps();
  const arm = createFpArm();
  arm.attach(countingRenderer(), () => null);
  const first = arm.build({ race: 'fprace', deps: fx.deps });
  assert.equal(arm.setWerewolf(true), false, 'queued, not dropped');
  assert.equal((await first).ok, true);
  await settle();
  assert.equal(arm.builtFor()?.werewolf, true, 'the wolf, once the first build landed');
  // a door's build queued behind one in flight, then the turn back
  const inFlight = arm.build({ race: 'fprace', deps: fx.deps, werewolf: true });
  const door = arm.build({ race: 'fprace', deps: fx.deps, werewolf: true });
  assert.equal((await door).queued, true);
  arm.setWerewolf(false);
  await inFlight;
  await settle(80);
  assert.equal(arm.builtFor()?.werewolf, false, 'the door\'s build took the turn back');
});

test('WEREWOLF1 (AUDIT D1) the per-frame door, through a REFUSAL and back: without Bloodmoon the wolf is refused - no arm stands - and the frame still hands the rig the form, so the person comes back at the turn (mutants: the form under the ready() gate again)', async () => {
  const fx = wolfDeps({ wolf: false });
  const renderer = { ...countingRenderer(), uploadTexture: () => null, drawScreenQuad: () => {} };
  const entity = { race: 'Breton', gender: 'male', faceIndex: 0, items: [], stats: { speed: 50 }, equip: { slots: {} }, activeEffects: [] };
  const rig = createWeaponRig({ renderer, canvas: { width: 1280, height: 800, clientWidth: 1280, clientHeight: 800 }, fetchBytes: () => { throw new Error('no art'); },
    palette: null, audio: { playOneShot() {} }, entity, camera: () => ({ pos: [0, 0, 0], yaw: 0, pitch: 0, move: { baseSpeed: 3, grounded: true, standing: true } }) });
  try {
    rig.frame(1 / 60);
    assert.equal((await fpArm.build({ race: 'fprace', deps: fx.deps })).ok, true);
    const opened = fx.opened;
    entity.activeEffects = [{ kind: 'racialOverride', racial: 'lycanthropy', isTransformed: true, infectionType: 1 }];
    for (let i = 0; i < 6; i++) { rig.frame(1 / 60); await settle(5); }
    assert.equal(fpArm.ready(), false, 'the wolf refused: nothing of Morrowind stands');
    assert.equal(fx.opened, opened + 1, 'asked once, not every frame');
    entity.activeEffects = [];
    for (let i = 0; i < 6; i++) { rig.frame(1 / 60); await settle(5); }
    assert.equal(fpArm.ready(), true, 'the person again, at the turn');
    assert.equal(fpArm.builtFor()?.werewolf, false);
  } finally { fpArm.unload(); }
  const w = rd('src/combat/weaponRig.js');
  const door = w.indexOf('fpArm.setWerewolf(wolf, { skin: wolfSkin });');
  assert.ok(door > 0 && door < w.indexOf('if (!paralyzed && fpArm.ready()) {'), 'ahead of the ready() gate');
  assert.match(w, /if \(wolf !== wolfForm\) \{ wolfForm = wolf; wolfSkin = wolf \? ownWerewolfSkin\(\) : null; \}/, 'the skin read at the change (AUDIT D5)');
});

test('WEREWOLF1 x BEAST-SELF (the merge): the arm stands aside only while it is not the form the curse holds - the person while the wolf builds, the wolf left standing for a curse now the boar\'s, the wolf still standing while the person rebuilds, a wolf refused; the standing wolf IS the Morrowind lane, its arm and its body (mutants: the standing wolf stood aside; the wrong beast kept; the wolf kept for the person)', async () => {
  const fx = wolfDeps();
  const renderer = { ...countingRenderer(), uploadTexture: () => null, drawScreenQuad: () => {} };
  const entity = { race: 'Breton', gender: 'male', faceIndex: 0, items: [], stats: { speed: 50 }, equip: { slots: {} }, activeEffects: [] };
  const rig = createWeaponRig({ renderer, canvas: { width: 1280, height: 800, clientWidth: 1280, clientHeight: 800 }, fetchBytes: () => { throw new Error('no art'); },
    palette: null, audio: { playOneShot() {} }, entity, camera: () => ({ pos: [0, 0, 0], yaw: 0, pitch: 0, move: { baseSpeed: 3, grounded: true, standing: true } }) });
  const curse = (type) => [{ kind: 'racialOverride', racial: 'lycanthropy', isTransformed: true, infectionType: type }];
  const until = async (ok) => { for (let i = 0; i < 40 && !ok(); i++) { rig.frame(1 / 60); await settle(5); } rig.frame(1 / 60); };
  const was = fpArm.standingIn();
  try {
    rig.frame(1 / 60);
    assert.equal((await fpArm.build({ race: 'fprace', deps: fx.deps })).ok, true);
    rig.frame(1 / 60);
    assert.equal(fpArm.standingIn(), false, 'a person');
    entity.activeEffects = curse(1);
    rig.frame(1 / 60);
    assert.equal(fpArm.standingIn(), true, 'the change: the person stands aside while the wolf builds');
    await until(() => fpArm.wolfStanding());
    assert.equal(fpArm.wolfStanding(), true, 'the wolf built');
    assert.equal(fpArm.standingIn(), false, 'the standing wolf is not stood aside');
    assert.equal(fpArm.canThirdPerson(), true, 'and the wheel crosses into its body');
    entity.activeEffects = [];
    rig.frame(1 / 60);
    assert.equal(fpArm.standingIn(), true, 'the turn back: the wolf stands aside while the person rebuilds');
    await until(() => !fpArm.wolfStanding() && fpArm.ready());
    assert.equal(fpArm.standingIn(), false, 'the person again');
    entity.activeEffects = curse(1);
    await until(() => fpArm.wolfStanding());
    assert.equal(fpArm.standingIn(), false, 'the wolf again');
    entity.activeEffects = curse(2);
    rig.frame(1 / 60);
    assert.equal(fpArm.standingIn(), true, 'a wolf is no boar - Morrowind has none');
    await until(() => !fpArm.wolfStanding() && fpArm.ready());
    assert.equal(fpArm.standingIn(), true, 'nor is the person the boar rebuilt');
    fpArm.unload();
    const none = wolfDeps({ wolf: false });
    entity.activeEffects = [];
    rig.frame(1 / 60);
    assert.equal((await fpArm.build({ race: 'fprace', deps: none.deps })).ok, true);
    entity.activeEffects = curse(1);
    await until(() => !fpArm.ready());
    assert.equal(fpArm.standingIn(), true, 'a wolf refused: the sprite lane\'s beast, the view carried to it');
  } finally { fpArm.unload(); fpArm.setStandIn(was); }
  assert.match(rd('src/combat/weaponRig.js'), /fpArm\.setStandIn\?\.\(beast \? !\(wolf && isMwWerewolf\(entity\)\) : wolf\);/);
});

test('WEREWOLF1 the weapon rig: the werewolf is a transformed lycanthrope whose curse is the wolf\'s (the wereboar has no Morrowind form); it rides the build options and the identity, and every frame hands the rig the form ahead of the worn table (mutants: the wereboar taken for a wolf; the per-frame door dropped)', () => {
  assert.equal(isMwWerewolf(transformed(1)), true);
  assert.equal(isMwWerewolf(transformed(2)), false, 'the wereboar');
  assert.equal(isMwWerewolf({ ...transformed(1), activeEffects: [{ kind: 'racialOverride', racial: 'lycanthropy', isTransformed: false, infectionType: 1 }] }), false, 'cursed, not transformed');
  assert.equal(isMwWerewolf(null), false);
  assert.equal(armBuildOptsOf(transformed(1)).werewolf, true, 'a save loaded mid-transformation builds the wolf at the door');
  assert.equal(armIdentityOf(transformed(1)).werewolf, true);
  const want = armIdentityOf(transformed(1));
  assert.equal(armsStandFor(transformed(1), { ready: () => true, builtFor: () => ({ ...want, werewolf: false }) }), false, 'the person standing is not the wolf\'s arm');
  assert.equal(armsStandFor(transformed(1), { ready: () => true, builtFor: () => want }), true);
  const rig = rd('src/combat/weaponRig.js');
  const at = (t) => { const i = rig.indexOf(t); assert.ok(i > 0, t); return i; };
  assert.ok(at('fpArm.setWerewolf(wolf, { skin: wolfSkin });') < at('fpArm.setWeapon(playerWeapon.weapon,') && at('fpArm.setWeapon(playerWeapon.weapon,') < at('if (entity) fpArm.setWorn('),
    'every frame, ahead of the hand and the worn table (AUDIT D3: their queue waits on the form\'s build)');
});

// ── THE PEERS ───────────────────────────────────────────────────────

const LOOK = { race: 'Breton', gender: 'male', faceIndex: 0, items: [{ templateIndex: 120, group: 'Weapons', material: 0, equipSlot: EQUIP_SLOTS.RightHand }] };   // a sword in the person's hand
const pose = (over = {}) => ({ x: 0, y: 0, z: 0, yaw: 0, mv: 0, ...over });

test('WEREWOLF1 a peer: the pose\'s `wb` 1 builds the wolf (holding nothing), keyed apart from the person so the form change rebuilds AT ONCE and a wolf refused is waited out as a wolf; the wereboar is the person\'s key, and never a wolf (mutants: the form change held for BODY_REBUILD_MS; the wereboar built as a wolf)', async () => {
  assert.equal(peerIsWolf({ wb: 1 }), true); assert.equal(peerIsWolf({ wb: 2 }), false); assert.equal(peerIsWolf(null), false);
  const o = peerBuildOpts(LOOK, { wb: 1 });
  assert.equal(o.werewolf, true); assert.equal(o.weapon, null, 'the sword in the look is not the wolf\'s');
  assert.equal(peerBuildOpts(LOOK, { wb: 0 }).weapon?.templateIndex, 120, 'the person holds it');
  assert.equal('werewolf' in peerBuildOpts(LOOK, { wb: 2 }), false, 'the wereboar: the person\'s opts, unchanged');
  assert.equal(peerBodyKey(LOOK, { wb: 0 }), lookKey(LOOK), 'a person\'s key is the look\'s own');
  assert.notEqual(peerBodyKey(LOOK, { wb: 1 }), lookKey(LOOK));
  assert.equal(peerBodyKey(LOOK, { wb: 2 }), lookKey(LOOK));
  // the body layer, with a fake rig
  const built = [];
  let now = 1000;
  const rigs = [];
  const createRig = () => {
    const r = { opts: null, attach() {}, async build(opts) { r.opts = opts; built.push(opts); await flush(); return { ok: true }; },
      canThirdPerson: () => true, setViewMode: () => true, update() {}, thirdActive: () => true, drawThird: () => true, unload() { r.unloaded = true; },
      raceHeightScale: () => 1, setSheathed() {}, setWeapon(w) { r.weapon = w; return true; }, readySpell(s) { r.spell = s; }, setHipLight(l) { r.hip = l; }, release() {}, upperBodyReady: () => true };
    rigs.push(r); return r;
  };
  const pb = new PeerBodies({ renderer: {}, createRig, now: () => now });
  const peer = (wb) => ({ id: 'wolf', name: 'SirMcMobdon', look: LOOK, shown: pose(wb ? { wb, wd: 1, lh: 0, sr: 1, hl: 1 } : {}), glyphs: ['shadowfang'] });
  pb.sync([peer(0)], (p) => [p.x, p.y, p.z], 0.016, [0, 0, 0]);
  await settle();
  assert.equal(built.at(-1).werewolf, undefined, 'the person first');
  now += 50;   // well inside BODY_REBUILD_MS
  pb.sync([peer(1)], (p) => [p.x, p.y, p.z], 0.016, [0, 0, 0]);
  pb.sync([peer(1)], (p) => [p.x, p.y, p.z], 0.016, [0, 0, 0]);
  await settle();
  assert.ok(50 < BODY_REBUILD_MS);
  assert.equal(built.at(-1).werewolf, true, 'the wolf, at once - not after BODY_REBUILD_MS');
  assert.equal(built.at(-1).weapon, null);
  const wolfRig = rigs.at(-1);
  pb.sync([peer(1)], (p) => [p.x, p.y, p.z], 0.016, [0, 0, 0]);
  assert.equal(wolfRig.weapon ?? null, null, 'the wolf\'s hands are claws');
  assert.equal(wolfRig.spell, false, 'it readies no spell');
  assert.equal(wolfRig.hip, false, 'and hangs no lantern');
});

test('WEREWOLF1 the host: a werewolf on foot goes to the bodies (so its wolf builds while the rider layer\'s lycanthrope stands for it); the rider layer DEFERS it and settles it after the bodies have stood (AUDIT E4: a skip read before them was the last frame\'s answer); a mounted beast and the wereboar stay the rider layer\'s (mutants: the settle dropped; the wolf kept out of the bodies; the boar deferred)', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /peerRiders\.sync\(seen, onlineToScene, \{ eye: cam\.pos, right: \[Math\.cos\(cam\.yaw\), 0, -Math\.sin\(cam\.yaw\)\], dt, defer: \(d\) => peerIsWolf\(d\.shown\), conceal: veilOf \}\);/);   // INVIS-NET (the merge): the drawn, not the whole list
  assert.match(w, /const afoot = seen\.filter\(\(d\) => !peerRiders\.isRiding\(d\.id\) && !d\.shown\?\.wb \|\| \(peerIsWolf\(d\.shown\) && !d\.shown\.rd\)\);/);
  const order = ['peerRiders.sync(seen', 'peerBodies.sync(afoot', 'peerRiders.settle((id) => peerBodies.wolfStands(id));', 'remotePlayers.sync(drawable'].map((t) => w.indexOf(t));
  assert.ok(order.every((i, k) => i > 0 && (k === 0 || i > order[k - 1])), `riders, bodies, the settle, then whatever reads the riders (${order})`);
  // the rider layer's own doors
  const riders = createPeerRiders({ renderer: {}, urlFor: () => null, decode: async () => null, art: null });
  const peers = [{ id: 'wolf', shown: pose({ wb: 1 }) }, { id: 'boar', shown: pose({ wb: 2 }) }, { id: 'rider', shown: pose({ wb: 1, rd: 1 }) }];
  const toScene = (p) => [p.x, p.y, p.z];
  riders.sync(peers, toScene, { defer: (d) => peerIsWolf(d.shown) });
  assert.equal(riders.riders.has('wolf'), false, 'the wolf on foot is held for the settle');
  assert.equal(riders.riders.has('rider'), true, 'a mounted beast is not deferred - the defer is for a beast on foot');
  assert.equal(riders.riders.has('boar'), true, 'nor the wereboar, whose body never stands');
  riders.settle(() => false);
  assert.equal(riders.riders.has('wolf'), true, 'no wolf standing: the lycanthrope, this frame');
  riders.sync(peers, toScene, { defer: (d) => peerIsWolf(d.shown) });
  assert.equal(riders.riders.has('wolf'), true, 'kept through the sync (the sweep does not take a deferred figure)');
  riders.settle((id) => id === 'wolf');
  assert.equal(riders.riders.has('wolf'), false, 'its wolf stands: the figure let go, this frame');
});

test('WEREWOLF1 (AUDIT E4) one drawer a frame, WITH the bodies: the frame a peer transforms out of a standing person, the lycanthrope stands (the person\'s body was a skip read the frame before); the frame its wolf first stands, the sprite goes (mutants: the settle asking any standing body; the settle before the bodies)', async () => {
  let now = 1000;
  const createRig = () => ({ attach() {}, async build() { await flush(); return { ok: true }; }, canThirdPerson: () => true, setViewMode: () => true,
    update() {}, thirdActive: () => true, drawThird: () => true, unload() {}, raceHeightScale: () => 1, setSheathed() {}, setWeapon() { return true; },
    readySpell() {}, setHipLight() {}, release() {}, upperBodyReady: () => true, castSpell() {} });
  const pb = new PeerBodies({ renderer: {}, createRig, now: () => now });
  const riders = createPeerRiders({ renderer: {}, urlFor: () => null, decode: async () => null, art: null });
  const toScene = (p) => [p.x, p.y, p.z];
  const frame = (wb) => {
    const peers = [{ id: 'p', look: LOOK, shown: pose(wb ? { wb } : {}), glyphs: [] }];
    riders.sync(peers, toScene, { defer: (d) => peerIsWolf(d.shown) });
    pb.sync(peers.filter((d) => !d.shown.wb || peerIsWolf(d.shown)), toScene, 0.016, [0, 0, 0]);
    riders.settle((id) => pb.wolfStands(id));
    return { body: pb.has('p'), sprite: riders.riders.has('p') };
  };
  frame(0); await settle(); now += 20000;
  assert.deepEqual(frame(0), { body: true, sprite: false }, 'the person stands');
  assert.deepEqual(frame(1), { body: false, sprite: true }, 'the transformation\'s frame: the lycanthrope, once');
  await settle();
  assert.deepEqual(frame(1), { body: true, sprite: false }, 'the wolf\'s first frame: the wolf, once');
  assert.equal(pb.wolfStands('p'), true);
});

test('WEREWOLF1 (AUDIT E1/E2/E3) a peer\'s wolf: keyed on what its build reads - race, sex, skin - never the person\'s gear (the transformation unequips and the look is said again); where this data has no werewolf, wolves are not the bodies\' at all - one refusal, one warning, the person\'s body LINGERING - until the data changes; and a form flipped back within BODY_REBUILD_MS of a form\'s body waits the rest out (mutants: the look in the wolf\'s key; the refusal retried; the flip unthrottled)', async () => {
  const bare = { ...LOOK, items: [] };
  assert.equal(peerBodyKey(bare, { wb: 1 }, []), peerBodyKey(LOOK, { wb: 1 }, []), 'the sword gone from the look is the same wolf');
  assert.notEqual(peerBodyKey({ ...LOOK, gender: 'female' }, { wb: 1 }, []), peerBodyKey(LOOK, { wb: 1 }, []), 'a she-wolf is another');
  assert.notEqual(peerBodyKey({ ...LOOK, race: 'Nord' }, { wb: 1 }, []), peerBodyKey(LOOK, { wb: 1 }, []), 'and another race\'s scale');
  // no Bloodmoon: the refusal
  let now = 1000, gen = 1;
  const warned = [];
  const built = [];
  const createRig = () => ({ attach() {}, async build(o) { built.push(o); await flush(); return o.werewolf ? { ok: false, stage: 'skeleton', error: 'meshes/wolf/skin.1st.nif is not in your archives' } : { ok: true }; },
    canThirdPerson: () => true, setViewMode: () => true, update() {}, thirdActive: () => true, drawThird: () => true, unload() {}, raceHeightScale: () => 1,
    setSheathed() {}, setWeapon() { return true; }, readySpell() {}, setHipLight() {}, release() {}, upperBodyReady: () => true, castSpell() {} });
  const pb = new PeerBodies({ renderer: {}, createRig, now: () => now, generation: () => gen, warn: (m) => warned.push(m) });
  const toScene = (p) => [p.x, p.y, p.z];
  const peers = (wb) => [{ id: 'p', look: LOOK, shown: pose(wb ? { wb } : {}), glyphs: [] }];
  pb.sync(peers(0), toScene, 0.016, [0, 0, 0]); await settle();
  now += 60000;
  pb.sync(peers(1), toScene, 0.016, [0, 0, 0]); await settle();
  assert.equal(built.filter((o) => o.werewolf).length, 1, 'the wolf asked once');
  assert.equal(pb.failureOf(LOOK, { wb: 1 }), 'skeleton: meshes/wolf/skin.1st.nif is not in your archives', 'and said why (AUDIT E7)');
  for (let i = 0; i < 20; i++) { now += BODY_RETRY_MS / 2; pb.sync(peers(1), toScene, 0.016, [0, 0, 0]); await settle(2); }
  assert.equal(built.filter((o) => o.werewolf).length, 1, 'never again on this data - no rig, no eviction, no build');
  assert.equal(warned.length, 1, 'one warning');
  // the person's body lingers through a transformation on such data
  now += 60000;
  pb.sync(peers(0), toScene, 0.016, [0, 0, 0]); await settle();
  const persons = built.filter((o) => !o.werewolf).length;
  now += 1000; pb.sync(peers(1), toScene, 0.016, [0, 0, 0]);
  now += BODY_LINGER_MS / 2; pb.sync(peers(0), toScene, 0.016, [0, 0, 0]); await settle();
  assert.equal(built.filter((o) => !o.werewolf).length, persons, 'turned back inside the linger: the same body, no rebuild');
  assert.equal(pb.has('p'), true);
  gen = 2;   // new data - perhaps Bloodmoon attached now
  now += 1000; pb.sync(peers(1), toScene, 0.016, [0, 0, 0]); await settle();
  assert.equal(built.filter((o) => o.werewolf).length, 2, 'a new generation asks again');
  // AUDIT E3: the flip throttle
  const flips = [];
  const fast = new PeerBodies({ renderer: {}, createRig: () => ({ ...createRig(), async build(o) { flips.push(o.werewolf ? 'wolf' : 'person'); await flush(); return { ok: true }; } }), now: () => now });
  fast.sync(peers(0), toScene, 0.016, [0, 0, 0]); await settle();
  now += 60000;
  for (let i = 0; i < 300; i++) { now += 100; fast.sync(peers(i % 2 ? 0 : 1), toScene, 0.016, [0, 0, 0]); await flush(); }
  await settle();
  assert.equal(flips[1], 'wolf', 'the transformation itself: at once');
  assert.ok(flips.length <= 6, `thirty seconds of a flip every pose: ${flips.length} builds (one a BODY_REBUILD_MS), not three hundred`);
});

test('WEREWOLF1 the robe is not a garment: a Daggerfall robe never resolves to "werewolfrobe", whatever its dye measures - its parts are the wolf\'s body (mutant: the pool left open)', () => {
  const robe = { id: 'werewolfrobe', model: 'c/c_werewolf.nif', type: 4, enchanted: false, parts: [] };
  const common = { id: 'common_robe_01', model: 'c/c_m_robe_common_01.nif', type: 4, enchanted: false, parts: [] };
  const name = Object.keys(DF_CLOTHING_ROWS).find((n) => DF_CLOTHING_ROWS[n].reserve === 'robe' && DF_CLOTHING_ROWS[n].type === 4);
  assert.ok(name, 'a Daggerfall robe row');
  assert.equal(mwClothingRecord([robe], name).record, null, 'the wolf\'s robe alone: no garment');
  assert.equal(mwClothingRecord([robe, common], name, { dye: 0, colourOf: (c) => (c.id === 'werewolfrobe' ? DF_CLOTHING_DYE_RGB[0] : [255, 255, 255]) }).record, common, 'even measured exactly the dye\'s colour');
});
