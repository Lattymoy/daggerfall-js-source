// SWING-LAW (2026-09-28, Mac: "swing speed is insane", then "Do whatever is the most detailed. I dont care about departure,
// especially if we can do it better") - THE PLAYER'S SWING IS THE PORT'S OWN LAW.
//
// DFU's line (FormulaHelper.GetMeleeWeaponAnimTime, `3 * (115 - LiveSpeed) / 980` a frame, five frames a blow) is a
// hyperbola in the rate: a second a blow at Speed 50, four blows a second at 100. DISC28-D gave the rig the live Speed
// it had never read, and a werewolf's +40 put it on the cap (DISC29-G, test/systems/disc29_swing.test.js). The law
// (characters/weaponStates.js): DFU's frame at Speed 50 x TEMPO(Speed) x HEFT(weight, Strength) x HANDLING(weapon,
// hands), bounded; the reader of the weapon in the hand (combat/swingLaw.js); Roleplay & Realism's weaponSpeed and
// Items' weaponBalance answer through it (test/systems/rr1_realism.test.js, test/systems/rri2_realism.test.js). A wielder the port does
// not know (a foe's machine, a peer's walker, the viewers) keeps DFU's line.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  getMeleeWeaponAnimTime, machineAttack, registerMeleeWeaponAnimTime, CLASSIC_FRAME_UPDATE,
  SWING_BASE_FRAME, SWING_TEMPO_AT_0, SWING_TEMPO_AT_100, swingTempo, swingHeft, SWING_HEFT_FREE_KG, SWING_HEFT_PER_KG,
  SWING_HEFT_MAX, SWING_HANDLING, SWING_TWO_HANDED, swingHandling, SWING_FRAME_MIN, SWING_FRAME_MAX, swingFrameSeconds,
} from '../../src/characters/weaponStates.js';
import { installSwingLaw, readSwing } from '../../src/combat/swingLaw.js';
import { WEAPON_TYPES } from '../../src/combat/fpsWeapon.js';
import { createWeaponRig } from '../../src/combat/weapon/weaponRig.js';
import { EQUIP_SLOTS, equipTableOf } from '../../src/systems/equip.js';
import { mintCondition, setItemFields, templateByIndex } from '../../src/systems/item/itemTemplates.js';
import { WEAPONS } from '../../src/characters/weapons.js';
import { setModSetting, _resetModSettings } from '../../src/systems/modSettings.js';
import { installRoleplayRealismItems } from '../../src/systems/roleplayRealismItems/rriInstall.js';
import { installRoleplayRealism } from '../../src/systems/roleplayRealism/rrInstall.js';

const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const DT = 1 / 60;
const dfu = (s) => (3 * (115 - s)) / CLASSIC_FRAME_UPDATE;
const weapon = (templateIndex) => mintCondition(setItemFields({ group: 'Weapons', templateIndex, material: 0 }));
const fighter = (stats = {}, held = null, hand = EQUIP_SLOTS.RightHand) => {
  const e = { isPlayer: true, level: 10, health: 80, maxHealth: 80, activeEffects: [], items: [], spells: [], skills: {}, stats: { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50, ...stats } };
  if (held != null) { const w = weapon(held); e.items = [w]; equipTableOf(e)[hand] = w; }
  return e;
};
/** The real rig over the entity, a drawn weapon, stepped by its own frame (DISC29-G's harness), and one blow's time. */
function blowTime(entity) {
  const rig = createWeaponRig({
    renderer: { uploadTexture: () => null, drawScreenQuad: () => {} },
    canvas: { width: 1280, height: 800, clientWidth: 1280, clientHeight: 800 },
    fetchBytes: () => { throw new Error('no art in this pin'); }, palette: null, audio: { playOneShot() {} }, entity,
    camera: () => ({ pos: [0, 0, 0], yaw: 0, pitch: 0, move: { baseSpeed: 3, grounded: true, standing: true } }),
  });
  rig.playerWeapon.sheathed = false;
  rig.frame(DT);
  assert.ok(machineAttack(rig.playerWeapon.machine, 'StrikeDown'), 'a swing starts');
  let t = 0;
  while (rig.playerWeapon.machine.state !== 'Idle' && t < 10) { rig.frame(DT); t += DT; }
  return t;
}

test('SWING-LAW: the tempo - Speed 50 is DFU\'s own frame, 100 swings 1.67 times as often, 0 takes 1.4 times as long; a straight line, held to 0..100, never 0', () => {
  assert.equal(SWING_BASE_FRAME, dfu(50), 'the middle is the swing every player had before DISC28-D');
  assert.equal(SWING_TEMPO_AT_0, 1.4); assert.equal(SWING_TEMPO_AT_100, 0.6);
  assert.equal(swingTempo(50), 1);
  assert.ok(Math.abs(swingTempo(100) - 0.6) < 1e-12 && Math.abs(swingTempo(0) - 1.4) < 1e-12);
  assert.ok(Math.abs(swingTempo(75) - 0.8) < 1e-12, 'a straight line: 0.8% of the swing a point of Speed');
  assert.equal(swingTempo(150), swingTempo(100), 'held at 100 (a mod or a spell past the cap is still the cap)');
  assert.equal(swingTempo(-40), swingTempo(0));
  assert.equal(swingTempo(NaN), 1, 'no number reads as 50');
  assert.equal(swingFrameSeconds(50), dfu(50));
  assert.ok(Math.abs(swingFrameSeconds(100) / swingFrameSeconds(50) - 0.6) < 1e-12);
  for (let s = -50; s <= 200; s += 5) {
    assert.ok(swingFrameSeconds(s) > 0, `Speed ${s}: a frame is never 0 (DFU's line was 0 at 115 and the machine's loop never ended)`);
    if (s > 0 && s <= 100) assert.ok(swingFrameSeconds(s) < swingFrameSeconds(s - 5), `Speed ${s}: quicker than ${s - 5}`);
  }
  assert.ok(5 * dfu(100) < 0.25 && 5 * swingFrameSeconds(100) > 0.55, 'DFU\'s four blows a second at the cap; the law\'s under two');
});

test('SWING-LAW: the heft - a weapon\'s base weight as the arm feels it, (150 - Strength)% of it, costs 4.5% a kilogram past the 2.5 any arm carries lightly, to at most 35%', () => {
  assert.equal(SWING_HEFT_FREE_KG, 2.5); assert.equal(SWING_HEFT_PER_KG, 0.045); assert.equal(SWING_HEFT_MAX, 0.35);
  assert.equal(swingHeft(templateByIndex(WEAPONS.Dagger).baseWeight, 50), 1, 'a dagger weighs nothing to the swing');
  assert.equal(swingHeft(templateByIndex(WEAPONS.Shortsword).baseWeight, 50), 1, 'nor a shortsword to an average arm');
  assert.equal(templateByIndex(WEAPONS.Claymore).baseWeight, 7.5);
  assert.ok(Math.abs(swingHeft(7.5, 50) - (1 + 5 * 0.045)) < 1e-12, 'a claymore, a fifth and more at Strength 50');
  assert.ok(Math.abs(swingHeft(7.5, 90) - (1 + 2 * 0.045)) < 1e-12, 'and less than a tenth at 90 (60% of 7.5 is 4.5)');
  assert.ok(swingHeft(7.5, 20) > swingHeft(7.5, 50) && swingHeft(7.5, 50) > swingHeft(7.5, 90), 'the stronger the arm, the lighter the blade');
  assert.equal(swingHeft(40, 0), 1 + SWING_HEFT_MAX, 'at most 35%, whatever the load');
  assert.equal(swingHeft(7.5, 150), swingHeft(7.5, 100), 'Strength held to 0..100');
  assert.equal(swingHeft(NaN, 50), 1, 'no weight weighs nothing');
});

test('SWING-LAW: the handling - by DFU\'s WeaponTypes (pinned equal to combat/fpsWeapon.js; the law is a leaf): a dagger, bare hands and claws quick, a sword the measure, the heavy kinds a little slower; both hands 6% more; the bow and the gun keep their own clocks', () => {
  const T = WEAPON_TYPES;
  const kinds = [T.LongBlade, T.LongBlade_Magic, T.Staff, T.Staff_Magic, T.Dagger, T.Dagger_Magic, T.Mace, T.Mace_Magic, T.Flail, T.Flail_Magic, T.Warhammer, T.Warhammer_Magic, T.Battleaxe, T.Battleaxe_Magic, T.Melee, T.Werecreature];
  assert.deepEqual(Object.keys(SWING_HANDLING).map(Number).sort((a, b) => a - b), [...kinds].sort((a, b) => a - b), 'every melee kind, and only they');
  assert.equal(SWING_HANDLING[T.LongBlade], 1, 'a sword is the measure');
  assert.ok(SWING_HANDLING[T.Dagger] < 1 && SWING_HANDLING[T.Melee] < 1 && SWING_HANDLING[T.Werecreature] < 1);
  for (const k of [T.Mace, T.Flail, T.Warhammer, T.Battleaxe]) assert.ok(SWING_HANDLING[k] > 1, `kind ${k} comes round slower`);
  for (let k = 0; k < 14; k += 2) assert.equal(SWING_HANDLING[k], SWING_HANDLING[k + 1], `a magic ${k} handles as its plain one`);
  assert.equal(SWING_TWO_HANDED, 1.06);
  assert.ok(Math.abs(swingHandling(T.LongBlade, true) - 1.06) < 1e-12);
  assert.equal(swingHandling(T.Bow), 1); assert.equal(swingHandling(T.Thunderlock), 1); assert.equal(swingHandling(undefined), 1);
  assert.equal(swingFrameSeconds(100, { handling: 0.1 }), SWING_FRAME_MIN, 'no frame under the floor, whatever a handling says');
  assert.equal(swingFrameSeconds(0, { heft: 1 + SWING_HEFT_MAX, handling: swingHandling(T.Warhammer, true) }), SWING_FRAME_MAX, 'nor over the ceiling: two seconds a blow at the most');
});

test('SWING-LAW: the reader - the item in the swinging hand, its template\'s weight, both hands or one, the live Strength; bare hands and claws weigh nothing; no wielder, nothing', () => {
  const e = fighter({ strength: 70 }, WEAPONS.Claymore);
  assert.deepEqual(readSwing({ entity: e, weaponType: WEAPON_TYPES.LongBlade, usingRightHand: true }), { weaponType: WEAPON_TYPES.LongBlade, weight: 7.5, strength: 70, twoHanded: true, family: 'longBlade', shortBlade: false });   // PIN MOVED (BAL10): the reader names the swing's family
  const left = fighter({}, WEAPONS.Dagger, EQUIP_SLOTS.LeftHand);
  equipTableOf(left)[EQUIP_SLOTS.RightHand] = weapon(WEAPONS.Claymore);
  assert.equal(readSwing({ entity: left, weaponType: WEAPON_TYPES.Dagger, usingRightHand: false }).weight, 0.5, 'the left hand\'s blade when the left hand swings');
  assert.equal(readSwing({ entity: left, weaponType: WEAPON_TYPES.Dagger, usingRightHand: false }).twoHanded, false);
  const wolf = fighter({ strength: 90 }, WEAPONS.Claymore);
  assert.deepEqual(readSwing({ entity: wolf, weaponType: WEAPON_TYPES.Werecreature, usingRightHand: true }), { weaponType: WEAPON_TYPES.Werecreature, weight: 0, strength: 90, twoHanded: false, family: null, shortBlade: false }, 'a beast\'s claws weigh nothing - and are no family');   // PIN MOVED (BAL10)
  assert.equal(readSwing({ entity: fighter(), weaponType: WEAPON_TYPES.Melee, usingRightHand: true }).weight, 0, 'nor bare hands');
  assert.equal(readSwing({ entity: null, weaponType: 0 }), null);
  assert.equal(readSwing(null), null);
});

test('SWING-LAW: GetMeleeWeaponAnimTime - a wielder the port knows swings on the law; a foe\'s machine, a peer and the viewers keep DFU\'s line; a registered override still answers first', () => {
  installSwingLaw();
  _resetModSettings();
  setModSetting('roleplay-realism-items', 'weaponBalance', false);
  setModSetting('roleplay-realism', 'weaponSpeed', false);
  try {
    const e = fighter({ strength: 50 }, WEAPONS.Claymore);
    const ctx = { entity: e, weaponType: WEAPON_TYPES.LongBlade, usingRightHand: true };
    assert.equal(getMeleeWeaponAnimTime(80, ctx), swingFrameSeconds(80, { heft: swingHeft(7.5, 50), handling: swingHandling(WEAPON_TYPES.LongBlade, true) }), 'the player: the law, the claymore read in the hand');
    assert.equal(getMeleeWeaponAnimTime(80), dfu(80), 'no ctx (a foe\'s machine, a peer\'s walker, the viewers): DFU\'s line');
    assert.equal(getMeleeWeaponAnimTime(80, { entity: null, weaponType: 0, usingRightHand: true }), dfu(80), 'a ctx with no wielder: DFU\'s line');
    registerMeleeWeaponAnimTime(() => 0.25);
    assert.equal(getMeleeWeaponAnimTime(80, ctx), 0.25, 'an override answers first, as TryGetOverride does');
  } finally {
    registerMeleeWeaponAnimTime(null);
    installRoleplayRealismItems({ fetchBytes: () => { throw new Error('no art in this pin'); } });
    installRoleplayRealism();
    _resetModSettings();
  }
});

test('SWING-LAW: the real rig - an average fighter about a second a blow, the quickest under two a second, a claymore slower than a dagger and a strong arm quicker with it; the mods on or off', () => {
  installSwingLaw();
  installRoleplayRealismItems({ fetchBytes: () => { throw new Error('no art in this pin'); } });
  installRoleplayRealism();
  for (const mods of [false, true]) {
    _resetModSettings();
    setModSetting('roleplay-realism-items', 'weaponBalance', mods);
    setModSetting('roleplay-realism', 'weaponSpeed', mods);
    try {
      const avg = blowTime(fighter({}, WEAPONS.Longsword));
      assert.ok(avg > 0.9 && avg < 1.3, `mods ${mods ? 'on' : 'off'}: an average fighter's longsword, ${avg.toFixed(3)}s a blow`);
      const quick = blowTime(fighter({ speed: 100, strength: 100 }, WEAPONS.Dagger));
      assert.ok(1 / quick < 2 && 1 / quick > 1.4, `mods ${mods ? 'on' : 'off'}: the quickest, ${(1 / quick).toFixed(2)} a second (DFU's line: 4)`);
      const dagger = blowTime(fighter({ speed: 70, strength: 50 }, WEAPONS.Dagger));
      const claymore = blowTime(fighter({ speed: 70, strength: 50 }, WEAPONS.Claymore));
      assert.ok(claymore > dagger * 1.2, `mods ${mods ? 'on' : 'off'}: a claymore (${claymore.toFixed(3)}s) is slower than a dagger (${dagger.toFixed(3)}s)`);
      const strong = blowTime(fighter({ speed: 70, strength: 95 }, WEAPONS.Claymore));
      assert.ok(strong < claymore, `mods ${mods ? 'on' : 'off'}: a strong arm swings it quicker (${strong.toFixed(3)}s)`);
      const slow = blowTime(fighter({ speed: 20, strength: 50 }, WEAPONS.Longsword));
      assert.ok(slow > avg * 1.15 && slow <= 5 * SWING_FRAME_MAX + 5 * DT, `mods ${mods ? 'on' : 'off'}: a slow fighter is slower (${slow.toFixed(3)}s), never past two seconds`);
    } finally { _resetModSettings(); }
  }
});

test('SWING-LAW: one law, every clock that times the player\'s swing - the leaf stays a leaf; the reader is registered as its module loads, and the rig imports it (AUDIT PRE-MERGE 0929 S5: it was a boot call, and a rig built without that boot swung with no weight); both mods answer through the curve', () => {
  const leaf = rd('src/characters/weaponStates.js');
  assert.doesNotMatch(leaf, /^import /m, 'weaponStates.js imports nothing (tools/neutral/build-viewer.mjs pastes its source)');
  assert.match(rd('src/combat/swingLaw.js'), /^installSwingLaw\(\);$/m, 'registered as the module loads - called, not a comment');
  assert.match(rd('src/combat/weapon/weaponRig.js'), /^import '\.\.\/swingLaw\.js';/m, 'the one maker of a swing\'s ctx imports it');
  assert.doesNotMatch(rd('src/scenes/shared.js'), /installSwingLaw/, 'no second home at boot');
  assert.match(rd('src/systems/roleplayRealism/rrRealism.js'), /return swingFrameSeconds\(blend, \{ heft: swingHeft\(weight, liveStrength\), handling: swingHandling\(weaponType, hands === 'Both', shortBlade\) \}\);/, 'AUDIT PRE-MERGE 0929 S3: RR\'s blend has no weight - the heft is the port\'s');
  assert.match(rd('src/systems/roleplayRealismItems/rriRealism.js'), /return swingFrameSeconds\(adjustedSpeed, \{ handling: swingHandling\(weaponType, twoHanded, shortBlade\) \}\);/);   // PIN MOVED (BAL10): both arms hand the short blade's handling on
  for (const [f, re] of [
    ['src/characters/weaponStates.js', /getMeleeWeaponAnimTime\(liveSpeed, animCtx\)/],   // the machine
    ['src/combat/weapon/weaponWidget.js', /getMeleeWeaponAnimTime\(liveSpeed, ctx\)/],          // the Weapon Widget's clone
    ['src/player/eyeOfTheBeholder/eotbBody.js', /getMeleeWeaponAnimTime\(last\.liveSpeed, last\.animCtx\)/],   // the third-person body
  ]) assert.match(rd(f), re, `${f} asks the one law with the wielder`);
});
