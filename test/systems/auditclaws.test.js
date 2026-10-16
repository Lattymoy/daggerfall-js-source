// AUDIT CLAWS (2026-10-12; the owner: "Audit this"; bible/05-Combat/Balance-Arc.md section 12): BAL6-CLAWS and
// BAL6-GAUNTLETS read again before they merge - three cold lanes over the pull request's head (every place a claw blow
// is struck, refereed or shown; every gauntlet the game can put on and what it is made of; what the change says and
// pins), every finding reproduced before it was fixed. The fixes to the laws' own pins live in test/systems/bal6_curses.test.js;
// these are the fixes that reach past them - the refereed lanes' sheet, the load, a mod's gloves, a broken piece, the
// slot.
//
// Every producer is the game's own: the curse and the change (systems/lycanthropy.js), CreateArmor
// (combat/enemyEquipment.js armorOfMaterial), the equip table, the save's own snapshot and restore, the refereed lanes'
// own composition (scenes/world.js duelStrikeOut: the striker's sheet against a stand-in of itself), and Roleplay &
// Realism: Items as the boot installs it.
import '../modsOff.js';
import { modsOff } from '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLycanthropyCurse, morphSelf } from '../../src/systems/lycanthropy.js';
import { LYCANTHROPY_TYPES } from '../../src/systems/infection.js';
import { isFullMoonFromMinutes, MINUTES_PER_DAY, CLASSIC_GAME_START_TIME } from '../../src/systems/gameDate.js';
import { clawMetalDamage } from '../../src/combat/clawMetal.js';
import { duelAttackerOf, duelStub, resolveDuelStrike } from '../../src/combat/duelCombat.js';
import { equipItem, equipTableOf, rebuildEquipState, EQUIP_SLOTS } from '../../src/systems/equip.js';
import { armorOfMaterial } from '../../src/combat/enemyEquipment.js';
import { ARMOR_MATERIAL } from '../../src/systems/armorMaterials.js';
import { setItemFields, mintCondition } from '../../src/systems/item/itemTemplates.js';
import { snapshotPlayer, restorePlayer } from '../../src/systems/save/save.js';
import { setModSetting, _resetModSettings } from '../../src/systems/modSettings.js';
import { installRoleplayRealismItems } from '../../src/systems/roleplayRealismItems/rriInstall.js';

const QUIET = (() => {
  let m = CLASSIC_GAME_START_TIME;
  while (isFullMoonFromMinutes(m) || isFullMoonFromMinutes(m + MINUTES_PER_DAY * 4)) m += MINUTES_PER_DAY;
  return m;
})();
const P = (name = 'Hero') => ({
  name, isPlayer: true, level: 12, raceId: 1, activeEffects: [], items: [], spells: [], skillUses: new Array(35).fill(0),
  stats: { strength: 50, agility: 50, endurance: 50, speed: 50, willpower: 50, intelligence: 50, personality: 50, luck: 50 },
  skills: Array.from({ length: 35 }, () => 40), health: 60, maxHealth: 60, chargenDone: true,
  career: { weaponArmorShieldsBitfield: 0, abilityFlagsAndSpellPointsBitfield: 0, attackModifierFlags: 0 }, armorValues: new Array(7).fill(100), reflexes: 2, biographyAvoidHitMod: 0,
});
const GAUNTLETS = 103, CUIRASS = 102, BRIGANDINE_GLOVES = 524;   // Armor.Gauntlets, Armor.Cuirass; RRI's ItemGloves
const wear = (p, item) => { p.items.push(item); equipItem(p, item); return p; };
const gauntletsOf = (p, material) => wear(p, armorOfMaterial(GAUNTLETS, material));
const cursed = (material = null) => {
  const p = P();
  createLycanthropyCurse(p, LYCANTHROPY_TYPES.Werewolf, { now: QUIET });
  return material === null ? p : gauntletsOf(p, material);
};
const change = (p) => { morphSelf(p, { force: true, nowMinutes: QUIET + 2 }); return p; };
const beastIn = (material = null) => change(cursed(material));
const mulberry = (a) => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const { Daedric } = ARMOR_MATERIAL;

test('AUDIT CLAWS A1: the refereed lanes strike through the sheet, and the sheet carries the claws\' metal - a beast in Daedric gauntlets claims 6 more a landed blow in a duel, a siege, the Royal Tourney, a siege work and the wild zone, as it lands in the arena and in every fight with a foe; the stand-in it rolls against wears nothing of its own (mutants: the sheet without it; the stub dropping it; the law not reading it; the stub wearing the gauntlets)', () => {
  const [a, a0] = [duelAttackerOf(beastIn(Daedric)), duelAttackerOf(beastIn())];
  assert.deepEqual([a.cm, a0.cm, duelAttackerOf(gauntletsOf(P(), Daedric)).cm, duelAttackerOf(cursed(Daedric)).cm], [6, 0, 0, 0],
    'the beast in Daedric, the bare beast, a man and the man in human form in the same gauntlets');
  const { stub } = duelStub(a);
  assert.equal(clawMetalDamage(stub), 6, 'the stand-in carries the law\'s word');
  assert.deepEqual(stub.equipTable, {}, 'and wears nothing: the striker rolls against a stand-in of itself, which would wear them as armour');
  // the lanes' own composition: the striker's sheet against a stand-in of its own sheet, 2,000 seeded strikes - the same
  // blows land, each exactly 6 heavier (DFU's core: every mod off)
  const claims = (sheet) => {
    const rolls = mulberry(5);
    let hits = 0, sum = 0;
    for (let i = 0; i < 2000; i++) {
      const r = resolveDuelStrike({ by: 'melee', a: sheet }, duelStub(sheet).stub, { rolls });
      if (r.hit) hits++;
      sum += r.dmg;
    }
    return { hits, sum };
  };
  const [c, c0] = [claims(a), claims(a0)];
  assert.ok(c0.hits > 200, `the claws land (${c0.hits} of 2000)`);
  assert.equal(c.hits, c0.hits, 'the same blows land');
  assert.equal(c.sum - c0.sum, 6 * c0.hits, 'each 6 heavier');
});

test('AUDIT CLAWS A2: a load sets the beast-form flag from the curse it restores - a man\'s save loaded over a transformed werewolf strikes with a man\'s fist, a transformed save on a fresh entity is the beast at once, and the same lycanthrope\'s human-form save over its beast is the man at once (mutants: the restore leaving the flag; the flag ignoring the change)', () => {
  const snapOf = (p) => snapshotPlayer(p, { classicMinutes: QUIET + 10 });
  const live = beastIn(Daedric);
  restorePlayer(live, snapOf(gauntletsOf(P('Man'), Daedric)), null);
  assert.deepEqual([live.isInBeastForm, clawMetalDamage(live)], [false, 0], 'a man loaded over the beast: no curse, no beast');
  const fresh = P('Fresh');
  restorePlayer(fresh, snapOf(beastIn(Daedric)), null);
  assert.deepEqual([fresh.isInBeastForm, clawMetalDamage(fresh)], [true, 6], 'a transformed save: the beast from the load, not a round later');
  const wolf = cursed(Daedric);
  const human = snapOf(wolf);
  change(wolf);
  assert.equal(clawMetalDamage(wolf), 6);
  restorePlayer(wolf, human, null);
  assert.deepEqual([wolf.isInBeastForm, clawMetalDamage(wolf)], [false, 0], 'the same curse saved in human form: the man');
});

test('AUDIT CLAWS B3, B4: only gauntlets the equip rules seat in the Gloves slot, and never a broken pair - a Daedric pair rusted to 0 condition and a Daedric cuirass a save left in the Gloves slot add nothing (mutants: a broken piece counted; whatever sits in the slot)', () => {
  // survival's rust writes a worn piece's condition straight down and leaves it on (systems/survival/needs.js); a
  // classic import keeps a worn 0-condition piece worn (AUDIT 63 F23)
  const rusted = beastIn(Daedric);
  equipTableOf(rusted)[EQUIP_SLOTS.Gloves].currentCondition = 0;
  assert.equal(clawMetalDamage(rusted), 0, 'a broken pair');
  assert.equal(clawMetalDamage(beastIn(Daedric)), 6, 'a whole one');
  // a load reseats every item at its saved slot (equip.js rebuildEquipState), and trusts the slot
  const q = beastIn();
  const cuirass = armorOfMaterial(CUIRASS, Daedric);
  cuirass.equipSlot = EQUIP_SLOTS.Gloves;
  q.items.push(cuirass);
  rebuildEquipState(q);
  assert.equal(equipTableOf(q)[EQUIP_SLOTS.Gloves], cuirass, 'the load seats it there');
  assert.equal(clawMetalDamage(q), 0, 'a cuirass is no gauntlet');
});

test('AUDIT CLAWS B1, B4: Roleplay & Realism\'s Brigandine Gloves are leather by their class whatever metal they name, as the class answers every other "is it metal" (the forbidden-armour test, Better Ambience, Immersive Footsteps) - no claw metal, and none when the mod is off and they are left in the slot (mutants: the raw material read; whatever sits in the slot)', () => {
  _resetModSettings();   // the shipped defaults: Roleplay & Realism: Items on, its new armour with it
  installRoleplayRealismItems({ fetchBytes: async () => { throw new Error('no art in this pin'); } });   // the boot's install (scenes/shared.js)
  try {
    const brig = mintCondition(setItemFields({ group: 'Armor', templateIndex: BRIGANDINE_GLOVES, material: Daedric }));
    const p = change(wear(cursed(), brig));
    assert.equal(equipTableOf(p)[EQUIP_SLOTS.Gloves], brig, `the mod seats its ${brig.name} in the Gloves slot`);
    assert.equal(clawMetalDamage(p), 0, 'leather by its class');
    assert.equal(clawMetalDamage(beastIn(Daedric)), 6, 'the classic Gauntlets of the same metal, under the same mods');
    setModSetting('roleplay-realism-items', 'newArmor', false);
    rebuildEquipState(p);
    assert.equal(equipTableOf(p)[EQUIP_SLOTS.Gloves], brig, 'the mod off: the load still seats them where they were');
    assert.equal(clawMetalDamage(p), 0, 'and they are no gauntlets');
  } finally {
    modsOff();
  }
});
