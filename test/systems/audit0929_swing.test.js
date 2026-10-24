// AUDIT PRE-MERGE 0929 (2026-09-29, Mac: "Audit this") - SWING-LAW's half: one sprite swing a blow on the Eye of the
// Beholder body (the report's own werewolf clawed two and three times a claw blow, where every peer saw one), and the
// swing law's reader in every rig (it was a boot call, and a rig built without that boot swung with no weight). The
// record: bible/01-Overview/audits/Audit-PreMerge-0929.md and bible/05-Combat/Combat.md SWING-LAW.
//
// This file never imports scenes/shared.js: the reader it finds is the one combat/weapon/weaponRig.js's import registered.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createWeaponRig } from '../../src/combat/weapon/weaponRig.js';
import { readSwing } from '../../src/combat/swingLaw.js';
import { getMeleeWeaponAnimTime, SWING_HEFT_FREE_KG } from '../../src/characters/weaponStates.js';
import { setModSetting, _resetModSettings } from '../../src/systems/modSettings.js';
import { eotbBody } from '../../src/player/eyeOfTheBeholder/eotbBody.js';
import { eotbCamera } from '../../src/player/eyeOfTheBeholder/eotbCamera.js';
import { STRING } from '../../src/player/eyeOfTheBeholder/eotbBillboard.js';
import { mwViewFrame, setEotbBodyReady } from '../../src/player/mwView.js';
import { createLycanthropyCurse, lycanthropyMagicRound, morphSelf } from '../../src/systems/lycanthropy.js';
import { LYCANTHROPY_TYPES } from '../../src/systems/infection.js';
import { isFullMoonFromMinutes, MINUTES_PER_DAY, CLASSIC_GAME_START_TIME } from '../../src/systems/gameDate.js';
import { equipTableOf, EQUIP_SLOTS } from '../../src/systems/equip.js';
import { WEAPON_TYPES } from '../../src/combat/fpsWeapon.js';
import { WEAPONS } from '../../src/characters/weapons.js';
import { mintCondition, setItemFields } from '../../src/systems/item/itemTemplates.js';

const DT = 1 / 60;
const mint = (item) => mintCondition(setItemFields(item));
const QUIET = (() => { let m = CLASSIC_GAME_START_TIME; while (isFullMoonFromMinutes(m) || isFullMoonFromMinutes(m + MINUTES_PER_DAY * 3)) m += MINUTES_PER_DAY; return m; })();
const player = (transformed) => {
  const p = { isPlayer: true, level: 5, health: 60, maxHealth: 60, activeEffects: [], items: [], spells: [], skills: {}, stats: { strength: 55, intelligence: 50, willpower: 50, agility: 55, endurance: 55, personality: 50, speed: 55, luck: 50 } };
  if (transformed) {
    createLycanthropyCurse(p, LYCANTHROPY_TYPES.Werewolf, { now: QUIET });
    lycanthropyMagicRound(p, { nowMinutes: QUIET + 1 });
    morphSelf(p, { force: true, nowMinutes: QUIET + 2 });
  }
  return p;
};
const rigFor = (p) => createWeaponRig({
  renderer: { uploadTexture: () => null, drawScreenQuad: () => {} }, canvas: { width: 1280, height: 800, clientWidth: 1280, clientHeight: 800 },
  fetchBytes: () => { throw new Error('no art'); }, palette: null, audio: { playOneShot() {} }, entity: p,
  camera: () => ({ pos: [0, 0, 0], yaw: 0, pitch: 0, move: { baseSpeed: 3, grounded: true, standing: true } }),
});
/** Blows through the rig's own door (clickAttack: the strike and its count, fpAttack), each run to Idle; the body's
 *  clips of `table` counted per blow, as the third-person camera draws it. */
function clipsPerBlow(p, table, blows) {
  const rig = rigFor(p);
  rig.playerWeapon.sheathed = false; rig.frame(DT);
  const out = [];
  try {
    setEotbBodyReady(() => true); eotbCamera.toggleOffset(true);
    const view = { fpEye: [0, 1.6, 0], feet: [0, 0, 0], yaw: 0, pitch: 0, dt: DT };
    for (let i = 0; i < 12; i++) { rig.frame(DT); mwViewFrame(view); }
    for (let b = 0; b < blows; b++) {
      rig.clickAttack();
      assert.notEqual(rig.playerWeapon.machine.state, 'Idle', 'a blow began');
      let clips = 0, prev = -1, t = 0;
      while (rig.playerWeapon.machine.state !== 'Idle' && t < 10) {
        rig.frame(DT); mwViewFrame(view); t += DT;
        const c = eotbBody.state().clip; const i = c && c.table === table ? c.i : -1;
        if (i >= 0 && (prev < 0 || i < prev)) clips++; prev = i;
      }
      out.push(clips);
      for (let i = 0; i < 30; i++) { rig.frame(DT); mwViewFrame(view); }   // the clip's tail, and a breath
    }
  } finally { setEotbBodyReady(null); eotbCamera.toggleOffset(false); eotbBody.attach(null, null); }
  return out;
}

test('AUDIT PRE-MERGE 0929 S1: the report\'s werewolf (base 55 + the curse\'s 40), transformed, in third person - the body claws ONCE a claw blow; it clawed two and three times (the IL\'s clip is a fixed 0.375 s and a SWING-LAW claw blow is 0.54 s at the least), where every peer saw one (mutants: the clip started on the attacking state alone; the blow count unread)', () => {
  for (const mods of [true, false]) {
    _resetModSettings();
    if (!mods) { setModSetting('roleplay-realism-items', 'weaponBalance', false); setModSetting('roleplay-realism', 'weaponSpeed', false); }
    setModSetting('eye-of-the-beholder', 'Graphics.AttackStrings', STRING.None);
    assert.deepEqual(clipsPerBlow(player(true), 'AttackMeleeLycan', 3), [1, 1, 1], `mods ${mods ? 'on' : 'off'}`);
  }
  _resetModSettings();
});

test('AUDIT PRE-MERGE 0929 S1: a sword blow is one body swing too - a clip\'s frame rounding ended it before the machine\'s blow, and a phantom second one began; and a new rig\'s first blow always swings (its count starts over)', () => {
  _resetModSettings();
  setModSetting('eye-of-the-beholder', 'Graphics.AttackStrings', STRING.None);
  const p = player(false);
  equipTableOf(p)[EQUIP_SLOTS.RightHand] = mint({ group: 'Weapons', templateIndex: WEAPONS.Longsword, material: 0 });
  assert.deepEqual(clipsPerBlow(p, 'AttackMelee', 3), [1, 1, 1]);
  assert.deepEqual(clipsPerBlow(p, 'AttackMelee', 1), [1], 'a second rig (another host) - its blow 1 is not the first rig\'s blow 1');
  assert.deepEqual(clipsPerBlow(p, 'AttackMelee', 1), [1], 'nor a third\'s blow 1 the second\'s - the count the body kept is the last rig\'s, not this one\'s');
  _resetModSettings();
});

test('AUDIT PRE-MERGE 0929 S5: a rig built without the game\'s boot reads the weapon in the hand - the reader was a boot call, and a rig without it swung a claymore as a dagger (mutants: the reader not registered as its module loads; the rig not importing it)', () => {
  _resetModSettings();
  setModSetting('roleplay-realism-items', 'weaponBalance', false);
  setModSetting('roleplay-realism', 'weaponSpeed', false);
  const p = player(false);
  rigFor(p);   // the rig module is loaded - and with it the reader
  const ctx = (templateIndex, type) => {
    equipTableOf(p)[EQUIP_SLOTS.RightHand] = mint({ group: 'Weapons', templateIndex, material: 0 });
    return { entity: p, weaponType: type, usingRightHand: true };
  };
  const light = getMeleeWeaponAnimTime(50, ctx(WEAPONS.Longsword, WEAPON_TYPES.LongBlade));
  const heavy = getMeleeWeaponAnimTime(50, ctx(WEAPONS.Claymore, WEAPON_TYPES.LongBlade));
  assert.ok(heavy > light * 1.1, `a claymore (7.5 kg, two hands) ${heavy.toFixed(4)} s a frame against a longsword's ${light.toFixed(4)}`);
  assert.ok(SWING_HEFT_FREE_KG < 7.5);
  _resetModSettings();
});

test('AUDIT PRE-MERGE 0929 S6: the reader reads and never writes - asked of a body with no equip table, it grows none, and a rig\'s unsheathe still draws its weapon with its sound (the reader asked through equipTableOf, which grows an empty table, and the rig\'s syncWorn read that table and emptied the hand: the draw went silent) (mutant: the reader grows the table)', () => {
  _resetModSettings();
  const body = { stats: { strength: 60 }, activeEffects: [] };
  const read = readSwing({ entity: body, weaponType: WEAPON_TYPES.LongBlade, usingRightHand: true });
  assert.equal(body.equip, undefined, 'no table grown');
  assert.deepEqual(read, { weaponType: WEAPON_TYPES.LongBlade, weight: 0, strength: 60, twoHanded: false, family: 'handToHand', shortBlade: false }, 'an empty hand weighs nothing');   // PIN MOVED (BAL10): the reader names the swing's family - an empty hand's the fist's
  const played = [];
  const rig = createWeaponRig({
    renderer: {}, canvas: { clientWidth: 1000, clientHeight: 800 }, fetchBytes: () => { throw new Error('no art'); }, palette: null,
    audio: { playOneShot(id) { played.push(id); } }, entity: { items: [] },
  });
  rig.frame(DT);
  rig.toggleSheath();
  assert.equal(rig.playerWeapon.sheathed, false);
  assert.ok(rig.playerWeapon.weapon, 'the weapon still in the hand');
  assert.equal(played.length, 1, 'the draw sounds');
  _resetModSettings();
});
