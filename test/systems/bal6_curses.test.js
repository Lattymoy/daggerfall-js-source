// BAL6 - THE CURSES (2026-10-12; bible/05-Combat/Balance-Arc.md section 12; the owner, asked: "Beast-only bonuses",
// "Hood only shields", "Beast claws count as silver"). Measured first: a lycanthrope with a sword in hand struck at
// x1.8-2.9 a plain character's damage a second without ever changing, every change healed it whole (twice a day, and
// without end under Hircine's Ring), and the beast's +30 Hand-to-Hand fist met a Lich's Mithril hide ungated; a hooded
// vampire stood +20 at every hour. BAL6-CLAWS (2026-10-12; the owner: "revert the material nerf on werewolf"): the
// claws' silver is taken back - the beast's fist meets a foe's metal ungated again, DFU's bare hand. BAL6-GAUNTLETS
// (the same day; the owner: "based on your equipped gauntlets it would affect your attacks as a wereboar/werewolf"):
// the plate gauntlets the beast wears add their metal's damage to its claws.
//
// Pinned by execution through the curse's own round and change (systems/lycanthropy.js), the stat and skill channels
// (liveStat, skillValue), both combat cores (the overhaul's pcaaoAttackDamage and DFU's calculateAttackDamage), the
// claws' metal (combat/clawMetal.js, armorMaterials.js plateMetal) on gauntlets CreateArmor mints and the equip table
// wears, the stats card's model (combat/combatStats.js) and the vampire's stat law (systems/vampirism.js
// vampireStatMod) on the sun's own seam.

import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createLycanthropyCurse, lycanthropyMagicRound, morphSelf, liveLycanthropy, morphHeals, lycanthropeAdvantages,
  LYCANTHROPE_STATS, LYCANTHROPE_SKILLS, LYCANTHROPE_STAT_MOD, LYCANTHROPE_SKILL_MOD,
} from '../../src/systems/lycanthropy.js';
import { LYCANTHROPY_TYPES } from '../../src/systems/infection.js';
import { isFullMoonFromMinutes, MINUTES_PER_DAY, CLASSIC_GAME_START_TIME } from '../../src/systems/gameDate.js';
import { liveStat } from '../../src/systems/statMods.js';
import { skillValue, SKILLS } from '../../src/systems/skills.js';
import { clampMarkersAheadOf } from '../../src/systems/save/save.js';
import { WEAPON_MATERIALS } from '../../src/characters/weapons.js';
import { pcaaoModules, pcaaoAttackDamage, pcaaoHandToHandAttackDamage } from '../../src/combat/pcaao.js';
import { calculateAttackDamage, handToHandAttackDamage } from '../../src/combat/formulas.js';
import { clawMetalDamage } from '../../src/combat/clawMetal.js';
import { computeCombatStats } from '../../src/combat/combatStats.js';
import { equipItem, equipTableOf, EQUIP_SLOTS } from '../../src/systems/equip.js';
import { armorOfMaterial } from '../../src/combat/enemyEquipment.js';
import { ARMOR_MATERIAL, plateMetal } from '../../src/systems/armorMaterials.js';
import { MATERIAL_INEFFECTIVE_TEXT } from '../../src/combat/formulas.js';
import { makeEnemyEntity } from '../../src/characters/enemy/enemyEntity.js';
import { ENEMY_BASICS } from '../../src/characters/enemy/enemyBasics.js';
import { vampireStatMod, VAMPIRE_STAT_MOD } from '../../src/systems/vampirism.js';
import { setPassiveSpecialsHost } from '../../src/systems/passiveSpecials.js';

const QUIET = (() => {
  let m = CLASSIC_GAME_START_TIME;
  while (isFullMoonFromMinutes(m) || isFullMoonFromMinutes(m + MINUTES_PER_DAY * 4)) m += MINUTES_PER_DAY;
  return m;
})();
const P = () => ({
  isPlayer: true, level: 12, raceId: 1, activeEffects: [], items: [], spells: [],
  stats: { strength: 50, agility: 50, endurance: 50, speed: 50, willpower: 50, intelligence: 50, personality: 50, luck: 50 },
  skills: Object.fromEntries(Array.from({ length: 35 }, (_, i) => [i, 40])), health: 60, maxHealth: 60,
  career: { weaponArmorShieldsBitfield: 0, abilityFlagsAndSpellPointsBitfield: 0 }, armorValues: new Array(7).fill(100), reflexes: 2, biographyAvoidHitMod: 0,
});
const bare = (p) => ({ ...p, activeEffects: [] });

test('BAL6: the lycanthrope\'s +40/+30 are the BEAST\'S - none in human form, every one from the instant of the change in, gone at the instant of the change back (mutants: the advantages in both forms, DFU\'s; the change not writing them)', () => {
  const p = P();
  const entry = createLycanthropyCurse(p, LYCANTHROPY_TYPES.Werewolf, { now: QUIET });
  lycanthropyMagicRound(p, { nowMinutes: QUIET + 1 });
  for (const stat of LYCANTHROPE_STATS) assert.equal(liveStat(p, stat), 50, `${stat}: human form is the character's own`);
  for (const skill of LYCANTHROPE_SKILLS) assert.equal(skillValue(p, skill), skillValue(bare(p), skill), 'and its skills');
  assert.equal(p.minMetalToHit, WEAPON_MATERIALS.Iron, 'iron still finds the man (DFU)');
  // the change: the advantages from the change's own instant, before any round reads them
  morphSelf(p, { force: true, nowMinutes: QUIET + 2 });
  assert.equal(entry.isTransformed, true);
  for (const stat of LYCANTHROPE_STATS) assert.equal(liveStat(p, stat), 50 + LYCANTHROPE_STAT_MOD, `${stat}: the beast's +40`);
  for (const skill of LYCANTHROPE_SKILLS) assert.equal(skillValue(p, skill), skillValue(bare(p), skill) + LYCANTHROPE_SKILL_MOD, 'the beast\'s +30');
  lycanthropyMagicRound(p, { nowMinutes: QUIET + 3 });
  assert.equal(liveStat(p, 'strength'), 90, 'the round keeps the beast\'s');
  assert.equal(skillValue(p, SKILLS.HandToHand), skillValue(bare(p), SKILLS.HandToHand) + 30);
  // and back
  morphSelf(p, { nowMinutes: QUIET + 4 });
  assert.equal(entry.isTransformed, false);
  assert.equal(liveStat(p, 'strength'), 50, 'the change back takes them at once');
  lycanthropyMagicRound(p, { nowMinutes: QUIET + 5 });
  assert.deepEqual([entry.statMods, entry.skillMods], [{}, {}], 'and the round leaves the man his own');
  // a curse saved before BAL6 carries DFU's +40/+30 on the man: the first round takes them
  entry.statMods = { strength: LYCANTHROPE_STAT_MOD }; entry.skillMods = { [SKILLS.HandToHand]: LYCANTHROPE_SKILL_MOD };
  assert.equal(liveStat(p, 'strength'), 90, 'the old save\'s word');
  lycanthropyMagicRound(p, { nowMinutes: QUIET + 6 });
  assert.equal(liveStat(p, 'strength'), 50, 'the round rewrites the form\'s own');
  assert.equal(skillValue(p, SKILLS.HandToHand), skillValue(bare(p), SKILLS.HandToHand));
  // the helper alone: a transformed entry carries exactly DFU's four and seven
  const e = { isTransformed: true };
  lycanthropeAdvantages(e);
  assert.deepEqual(Object.keys(e.statMods), [...LYCANTHROPE_STATS]);
  assert.deepEqual(Object.keys(e.skillMods).map(Number).sort((a, b) => a - b), [...LYCANTHROPE_SKILLS].sort((a, b) => a - b));
  e.isTransformed = false;
  lycanthropeAdvantages(e);
  assert.deepEqual([e.statMods, e.skillMods], [{}, {}]);
});

test('BAL6: one change a day heals - the change in heals, the change back inside the day does not, Hircine\'s Ring frees the change but never the heal, a day and a minute later the change heals again (mutants: every change heals, DFU\'s; the heal on the cast\'s stamp, which the Ring never reads)', () => {
  const p = P();
  const entry = createLycanthropyCurse(p, LYCANTHROPY_TYPES.Wereboar, { now: QUIET });
  const t0 = QUIET + MINUTES_PER_DAY + 1;
  p.health = 10;
  assert.equal(morphSelf(p, { nowMinutes: t0 }).ok, true);
  assert.equal(p.health, 60, 'the change in heals (none has yet)');
  assert.equal(entry.lastMorphHeal, t0);
  p.health = 10;
  assert.equal(morphSelf(p, { nowMinutes: t0 + 1 }).ok, true, 'the change back is ungated (DFU)');
  assert.equal(p.health, 10, 'but it does not heal: the day\'s heal is spent');
  // the Ring: the change is free, the heal is not
  entry.wearingHircineRing = true;
  assert.equal(morphSelf(p, { nowMinutes: t0 + 2 }).ok, true, 'the Ring lifts the once-a-day gate');
  assert.equal(p.health, 10, 'and no heal rides it');
  morphSelf(p, { nowMinutes: t0 + 3 });
  assert.equal(p.health, 10);
  // a whole day after the last heal, STRICTLY more than 1440 minutes, as the gate's own day
  morphSelf(p, { nowMinutes: t0 + MINUTES_PER_DAY });
  assert.equal(p.health, 10, 'exactly a day: not yet');
  morphSelf(p, { nowMinutes: t0 + MINUTES_PER_DAY + 1 });
  assert.equal(p.health, 60, 'a day and a minute: the heal is back');
  assert.equal(morphHeals({ lastMorphHeal: 100 }, 100 + MINUTES_PER_DAY), false);
  assert.equal(morphHeals({ lastMorphHeal: 100 }, 101 + MINUTES_PER_DAY), true);
  assert.equal(morphHeals({}, 0), true, 'a curse from before BAL6 carries no stamp: its next change heals');
  // the stamp is a curse clock's marker: a save written ahead of its own clock brings it back (save.js)
  const ahead = { activeEffects: [{ kind: 'racialOverride', lastMorphHeal: 5000 }] };
  assert.equal(clampMarkersAheadOf(ahead, 4000), 1);
  assert.equal(ahead.activeEffects[0].lastMorphHeal, 4000);
});

const OVERHAUL = { Enabled: true, equipmentDamageEnhanced: false, fadingEnchantedItems: false, fixedStrengthDamageModifier: true, armorHitFormulaRedone: true, criticalStrikesIncreaseDamage: true, conditionBasedEffectiveness: true, softMaterialRequirements: true };
const modsOf = (over = {}) => pcaaoModules((k) => ({ ...OVERHAUL, ...over })[k], () => undefined);
const career = { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50, attackModifierFlags: 0 };
const lich = (metal) => { const e = makeEnemyEntity(32, ENEMY_BASICS[32], career, 12, () => 0.5); e.minMetalToHit = metal; return e; };
const mulberry = (a) => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const swings = (attacker, target, modules, n = 2000) => {
  const rolls = mulberry(7);
  let sum = 0;
  for (let i = 0; i < n; i++) sum += pcaaoAttackDamage(attacker, target, { weapon: null, rolls, dfRand: () => Math.floor(rolls() * 32768), modules });
  return sum;
};

test('BAL6-CLAWS: the beast\'s claws meet no metal - DFU\'s bare hand, ungated at a Lich\'s Mithril in both cores, the soft rule on or off, as a man\'s fist is (mutants: the claws as silver in either core, BAL6\'s; the claws refused with DFU\'s line under the overhaul, soft rule off; every fist gated)', () => {
  const M = modsOf();
  const strong = () => { const q = P(); q.stats.strength = 90; q.skills[SKILLS.HandToHand] = 70; q.skills[SKILLS.CriticalStrike] = 70; return q; };   // the level-12 beast's own numbers
  const beast = { ...strong(), isInBeastForm: true };
  const man = strong();
  assert.equal(lich(-1).minMetalToHit, -1);
  assert.equal(ENEMY_BASICS[32].minMetalToHit, WEAPON_MATERIALS.Mithril, 'the fixture is the real Lich\'s Mithril');
  const open = swings(beast, lich(-1), M);
  assert.ok(open > 2000, `the claws land (${open})`);
  assert.equal(swings(beast, lich(WEAPON_MATERIALS.Mithril), M), open, 'the overhaul\'s soft rule: the claws at Mithril whole');
  assert.equal(swings(man, lich(WEAPON_MATERIALS.Mithril), M), swings(man, lich(-1), M), 'a man\'s fist: DFU\'s, no gate');
  // without the soft rule: no refusal, nothing said
  const hard = modsOf({ softMaterialRequirements: false });
  assert.equal(swings(beast, lich(WEAPON_MATERIALS.Mithril), hard), swings(beast, lich(-1), hard), 'DFU\'s gate asks a weapon alone');
  const said = [];
  const notes = {};
  pcaaoAttackDamage(beast, lich(WEAPON_MATERIALS.Mithril), { weapon: null, rolls: () => 0.01, dfRand: () => 0, modules: hard, say: (t) => said.push(t), notes });
  assert.deepEqual([notes.ineffective, said], [undefined, []], 'no "ineffective" line for the claws');
  // and DFU's own core (every mod off): the claws and a man's fist land at Mithril as at no metal, seed for seed, and
  // nothing is said (AUDIT CLAWS C6: the overhaul's half above said so; DFU's had no ear)
  const dfuSaid = [];
  const dfu = (who, metal, seed) => {
    const rolls = mulberry(seed);
    let sum = 0;
    for (let i = 0; i < 300; i++) sum += calculateAttackDamage(who, lich(metal), { rolls, dfRand: () => Math.floor(rolls() * 32768), say: (t) => dfuSaid.push(t) });
    return sum;
  };
  const dfuBeast = dfu(beast, -1, 3);
  assert.ok(dfuBeast > 0, `DFU's core: the claws land (${dfuBeast})`);
  assert.equal(dfu(beast, WEAPON_MATERIALS.Mithril, 3), dfuBeast, 'DFU\'s core: the claws at Mithril whole');
  assert.equal(dfu(man, WEAPON_MATERIALS.Mithril, 3), dfu(man, -1, 3), 'DFU\'s core: a man\'s fist whole');
  assert.equal(dfuSaid.includes(MATERIAL_INEFFECTIVE_TEXT), false, 'DFU\'s core: no "ineffective" line for the claws');
});

// BAL6-GAUNTLETS: a lycanthrope as the curse makes one, its gauntlets minted by CreateArmor (enemyEquipment.js
// armorOfMaterial - AUDIT CLAWS C8: a hand-built literal was minted here) and put on in human form through the equip
// table (the pack is refused to the beast), then the change
const GAUNTLETS = 103;   // Armor.Gauntlets (ItemTemplates.txt)
const gauntletsOf = (p, material) => { const g = armorOfMaterial(GAUNTLETS, material); p.items.push(g); equipItem(p, g); return p; };
const cursed = (material = null) => {
  const p = P();
  createLycanthropyCurse(p, LYCANTHROPY_TYPES.Werewolf, { now: QUIET });
  return material === null ? p : gauntletsOf(p, material);
};
const beastIn = (material = null) => { const p = cursed(material); morphSelf(p, { force: true, nowMinutes: QUIET + 2 }); return p; };
const ARMOUR_METALS = ['Leather', 'Chain', 'Chain2', 'Iron', 'Steel', 'Silver', 'Elven', 'Dwarven', 'Mithril', 'Adamantium', 'Ebony', 'Orcish', 'Daedric'];

test('BAL6-GAUNTLETS: the beast\'s claws take the metal of the gauntlets it wears - GetWeaponMaterialModifier\'s damage, never below bare; leather, chain, bare claws, human form, the change back and a man nothing (mutants: every fist\'s; iron\'s -1 taken; leather or chain a metal; a metal past Daedric; the wrong slot)', () => {
  // DFU's plate encoding: 0x0200 + WeaponMaterialTypes (FormulaHelper.RandomArmorMaterial)
  assert.deepEqual(ARMOUR_METALS.map((k) => plateMetal(ARMOR_MATERIAL[k])), [null, null, null, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.equal(plateMetal(ARMOR_MATERIAL.Daedric + 1), null, 'nothing past Daedric');
  assert.equal(plateMetal(undefined), null, 'an empty slot');
  // through the curse, the equip table and the change: Elven +1 to Daedric +6, the points DFU's core adds to a blade of
  // that metal; iron's -1 not taken
  assert.deepEqual(ARMOUR_METALS.map((k) => clawMetalDamage(beastIn(ARMOR_MATERIAL[k]))), [0, 0, 0, 0, 0, 0, 1, 2, 3, 3, 4, 5, 6]);
  const p = cursed(ARMOR_MATERIAL.Daedric);
  assert.equal(clawMetalDamage(p), 0, 'human form: the man\'s bare hand');
  morphSelf(p, { force: true, nowMinutes: QUIET + 2 });
  assert.equal(equipTableOf(p)[EQUIP_SLOTS.Gloves]?.material, ARMOR_MATERIAL.Daedric, 'MorphSelf empties the hands, never the gauntlets');
  assert.equal(clawMetalDamage(p), 6, 'the beast in Daedric');
  morphSelf(p, { nowMinutes: QUIET + 4 });
  assert.equal(p.isInBeastForm, false);
  assert.equal(clawMetalDamage(p), 0, 'the change back takes it away');
  assert.equal(clawMetalDamage(beastIn()), 0, 'bare claws');
  assert.equal(clawMetalDamage(gauntletsOf(P(), ARMOR_MATERIAL.Daedric)), 0, 'a man\'s fist in Daedric gauntlets: DFU\'s bare hand');
});

test('BAL6-GAUNTLETS through both cores and the stats card: Daedric gauntlets add 6 to every claw hit where a weapon\'s metal stands - after Strength, before the overhaul\'s floor, inside a backstab\'s treble - the hit chance as it was; a man\'s fist and the man in human form in the same gauntlets untouched (mutants: either core without it; the metal as to-hit in either core or on the card; the metal past the floor or the enemy-type term; the metal outside the backstab; the card without it)', () => {
  const daedric = beastIn(ARMOR_MATERIAL.Daedric);
  const bareBeast = beastIn();
  const lichOpen = lich(-1);
  const warlord = () => makeEnemyEntity(24, ENEMY_BASICS[24], career, 12, () => 0.5);   // the Orc Warlord: a foe the claws hit in the open, never at a clamp
  // the blow's own damage, one fixed roll: where a weapon's material modifier stands, in both cores
  const at = (who) => [pcaaoHandToHandAttackDamage(who, lichOpen, 0, true, () => 0.5), handToHandAttackDamage(who, lichOpen, 0, true, () => 0.5)];
  const [pcBare, dfuBare] = at(bareBeast);
  assert.deepEqual(at(daedric), [pcBare + 6, dfuBare + 6], 'the overhaul\'s and DFU\'s claws, +6 each');
  const man = gauntletsOf(P(), ARMOR_MATERIAL.Daedric);
  assert.deepEqual(at(man), at(P()), 'a man\'s fist in the same gauntlets: DFU\'s');
  assert.deepEqual(at(cursed(ARMOR_MATERIAL.Daedric)), at(cursed()), 'the man in human form: the same');
  // AUDIT CLAWS C3: BEFORE the overhaul's floor, after its Strength - a blow the swing's -15 takes under 1 floors to 0
  // bare and lands 3 in Daedric (past the floor it would land the whole 6)
  assert.deepEqual([pcaaoHandToHandAttackDamage(bareBeast, lichOpen, -15, true, () => 0), pcaaoHandToHandAttackDamage(daedric, lichOpen, -15, true, () => 0)], [0, 3]);
  // AUDIT CLAWS C7: inside the blow a backstab trebles, in both cores: 6 x 3 (the overhaul's critical off, so its
  // multiplier does not stand between)
  const stab = (who) => [
    calculateAttackDamage(who, warlord(), { backstabChance: 100, rolls: () => 0.01, dfRand: () => 0 }),
    pcaaoAttackDamage(who, warlord(), { weapon: null, backstabChance: 100, rolls: () => 0.01, dfRand: () => 0, modules: modsOf({ criticalStrikesIncreaseDamage: false }) }),
  ];
  const [sB, sD] = [stab(bareBeast), stab(daedric)];
  assert.deepEqual([sD[0] - sB[0], sD[1] - sB[1]], [18, 18], `a backstab trebles the metal (${sB} -> ${sD})`);
  // 2,000 seeded swings through each whole core: the same blows land - no to-hit rides the metal - and every one is
  // heavier, DFU's core by exactly 6 a landed blow. The overhaul at a Lich's Mithril (the claws ungated, BAL6-CLAWS);
  // DFU's at the Orc Warlord (AUDIT CLAWS C2: at a Lich DFU's claws sit on the 3% floor, where +6 to hit lands nothing
  // more and the count could not see it)
  const run = (who, core) => {
    const rolls = mulberry(11);
    let hits = 0, sum = 0;
    for (let i = 0; i < 2000; i++) {
      const notes = {};
      const d = core === 'overhaul'
        ? pcaaoAttackDamage(who, lich(WEAPON_MATERIALS.Mithril), { weapon: null, rolls, dfRand: () => Math.floor(rolls() * 32768), modules: modsOf(), notes })
        : calculateAttackDamage(who, warlord(), { rolls, dfRand: () => Math.floor(rolls() * 32768) });
      if (core === 'overhaul' ? notes.hit : d > 0) hits++;
      sum += d;
    }
    return { hits, sum };
  };
  const pc = [run(bareBeast, 'overhaul'), run(daedric, 'overhaul')];
  assert.ok(pc[0].hits > 200, `the claws land (${pc[0].hits})`);
  assert.equal(pc[1].hits, pc[0].hits, 'the overhaul: the same blows land');
  assert.ok(pc[1].sum > pc[0].sum, `and heavier (${pc[0].sum} -> ${pc[1].sum})`);
  const df = [run(bareBeast, 'dfu'), run(daedric, 'dfu')];
  assert.ok(df[0].hits > 400 && df[0].hits < 1600, `DFU's core: the claws land in the open (${df[0].hits} of 2000)`);
  assert.equal(df[1].hits, df[0].hits, 'DFU\'s core: the same blows land');
  assert.equal(df[1].sum - df[0].sum, 6 * df[0].hits, 'DFU\'s core: 6 more a landed blow');
  // the stats card's model, both cores (the card itself is not open to a beast - the pack is refused - but it models the
  // cores for whatever entity it is handed): the claws' span 6 higher, the metal its own part, the hit chance at every
  // reference foe the same (AUDIT CLAWS C5)
  for (const core of ['overhaul', 'classic']) {
    const card = (who) => computeCombatStats(who, { core }).swings[0].byFoe;
    const [b, d] = [card(bareBeast), card(daedric)];
    assert.deepEqual([d[0].dmg.min, d[0].dmg.max, d[0].dmg.parts.matMod], [b[0].dmg.min + 6, b[0].dmg.max + 6, 6], `${core}: the card`);
    assert.equal(b[0].dmg.parts.matMod, 0);
    assert.deepEqual(d.map((f) => f.hit), b.map((f) => f.hit), `${core}: the card's hit chance, every foe`);
  }
  // AUDIT CLAWS C3: the card's metal where the cores' stands, before the overhaul's floor - a beast whose Strength a
  // drain took to 5 (the beast's +40 leaves 45, -1 a blow) thrusting (the swing's -4) at its least roll strikes -1:
  // the overhaul floors it to 0 bare and lands 5 in Daedric (6 with the metal past the floor); DFU's core has no floor
  const thrust = (material, core) => {
    const p = cursed(material);
    p.stats.strength = 5;
    p.skills[SKILLS.HandToHand] = 0;
    morphSelf(p, { force: true, nowMinutes: QUIET + 2 });
    return computeCombatStats(p, { core }).swings.find((w) => w.key === 'StrikeUp').byFoe[0].dmg.min;
  };
  assert.deepEqual([thrust(null, 'overhaul'), thrust(ARMOR_MATERIAL.Daedric, 'overhaul'), thrust(null, 'classic'), thrust(ARMOR_MATERIAL.Daedric, 'classic')], [0, 5, -1, 5]);
});

test('BAL6: the hood shields, it does not make it night - bare in the street\'s sun -20, hooded there 0, out of the sun +20 hooded or not (mutants: the hood the night\'s +20, HOOD-SUN\'s; the hood shielding nothing)', () => {
  const day = Math.floor(CLASSIC_GAME_START_TIME / MINUTES_PER_DAY) * MINUTES_PER_DAY;
  const noon = day + 12 * 60, midnight = day + 23 * 60;
  let inside = false;
  const prev = setPassiveSpecialsHost({ isInside: () => inside, inPrison: () => false });
  try {
    assert.equal(vampireStatMod(noon, true), -VAMPIRE_STAT_MOD, 'bare-headed at noon in the street: the sun\'s -20');
    assert.equal(vampireStatMod(noon, false), 0, 'hooded at noon in the street: shielded, no bonus');
    assert.equal(vampireStatMod(midnight, true), VAMPIRE_STAT_MOD, 'by night: DFU\'s +20');
    assert.equal(vampireStatMod(midnight, false), VAMPIRE_STAT_MOD, 'hooded by night: the same');
    inside = true;
    assert.equal(vampireStatMod(noon, true), VAMPIRE_STAT_MOD, 'under a roof at noon: DFU\'s +20 (VAMP-SUN, Mac\'s)');
    assert.equal(vampireStatMod(noon, false), VAMPIRE_STAT_MOD, 'and hooded under it');
  } finally { setPassiveSpecialsHost(prev); }
});
