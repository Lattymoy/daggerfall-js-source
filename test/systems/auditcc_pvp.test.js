import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

import { duelAttackerOf, duelWeaponOf, duelStandIn, DUEL_STAND_IN, resolveDuelStrike } from '../../src/combat/duelCombat.js';
import { siegeSpellNumbers, siegeCastClamp } from '../../src/combat/siegeCombat.js';
import { installPcaao, uninstallPcaao } from '../../src/combat/pcaao.js';
import { playerEntity } from '../../src/characters/playerEntity.js';
import { createCharacter, STAT_KEYS_ORDER } from '../../src/systems/chargen.js';
import { assignStartingEquipment } from '../../src/systems/startingGear.js';
import { SKILLS, skillValue } from '../../src/systems/skills.js';
import { liveStat } from '../../src/systems/statMods.js';
import { newSurvival, survivalStatMods, applySurvivalMods } from '../../src/systems/survival/needs.js';
import { SURVIVAL_RULES } from '../../src/systems/survival/difficulty.js';
import { applySpell } from '../../src/systems/effects.js';
import { buildCustomSpell } from '../../src/systems/spell/spellMaker.js';

// ═══ AUDIT C&C, PvP (2026-10-12): H5 - THE STAND-IN EVERY BLOW BETWEEN PLAYERS IS ROLLED AGAINST ═══
//
// AUDIT C&C B1 kept Boons online on the reading that "every live buff rides the duel's sheet". It rode the STRIKER's
// sheet (duelAttackerOf reads liveStat), and since INT8 the striker's own machine rolls the blow - against a stand-in
// built from that same sheet (world.js duelStrikeOut, wildStrikeOut, siegeStrikeOut, siegeWorkHit: `duelStub(a).stub`;
// the spells' siegeSpellNumbers the same). Every attribute the striker brought cancelled itself, the combat overhaul
// charged it for the "target's" luck above 50 - its own (pcaao.js pcaaoStatDiffsToHit) - so Thriving LOWERED its
// owner's hit chance (60.59% bare to 59.62% over 200,000 seeded swings of the starting Shortsword; lens H's 60.6% to
// 59.8% for the +5 Luck alone), and its own race and willpower saved against its own spell. The stand-in is NEUTRAL now
// (combat/duelCombat.js duelStandIn): every attribute 50, and Thriving lands 61.62%.
//
// Driven through the real producers: a character chargen mints with the starting gear it is handed, its boons the
// entry the minute law writes (survival/needs.js survivalStatMods -> applySurvivalMods), a Fortify by the spell door
// (the spellmaker's own record), the sheet duelAttackerOf reads, the roll the hosts make. The numbers are LITERALS of
// seeded rolls (A PIN MUST FAIL).

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const lcg = (seed) => { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; };
const S = SKILLS;
/** A class sheet as CLASS*.CFG hands one (the data is the player's own ARENA2, so its fields are written out). */
const CAREER = Object.freeze({
  name: 'Pin', primarySkills: [S.LongBlade, S.CriticalStrike, S.Dodging], majorSkills: [S.Archery, S.Climbing, S.Running],
  minorSkills: [S.Swimming, S.Jumping, S.Medical, S.Stealth, S.Backstabbing, S.Mercantile],
  hitPointsPerLevel: 10, advancementMultiplier: 0.3, abilityFlagsAndSpellPointsBitfield: 0x1000,
  strength: 45, intelligence: 45, willpower: 45, agility: 45, endurance: 45, personality: 45, speed: 45, luck: 45,
});
/** THE PLAYER AS THE GAME MINTS ONE: the pre-chargen entity, chargen's createCharacter, the starting gear (a Breton, as
 *  the entity starts - its race resists Magic; a Shortsword). */
function mintPlayer() {
  const e = structuredClone(playerEntity);
  createCharacter(e, CAREER, 16, { rolls: () => 0.5 });
  e.items = []; e.equip = null; e.activeEffects = [];
  assignStartingEquipment(e, { classIndex: 0, rolls: () => 0.5 });
  return e;
}
/** The entry the minute law writes for a body holding `ids` (needs.js survivalMinute: survivalBoons, then
 *  applySurvivalMods over survivalStatMods), on the Boons tier. */
const earn = (e, ids) => applySurvivalMods(e, survivalStatMods({ ...newSurvival(0), boons: ids }, null, 0, { endurance: liveStat(e, 'endurance'), rules: SURVIVAL_RULES.boons }));
/** A Fortify of `stat` by `n`, the spellmaker's record cast on oneself through the one spell door (magnitude per 20
 *  levels: a level-1 caster's magnitude is the base alone). */
const fortify = (e, stat, n) => applySpell(buildCustomSpell({
  slots: [{ type: 9, subType: STAT_KEYS_ORDER.indexOf(stat), settings: { magnitudeBaseLow: n, magnitudeBaseHigh: n, magnitudePerLevel: 20, durationBase: 60 } }],
  rangeType: 0, element: 4, name: 'Fortify',
}), 1, e, {}, () => 0.5, { entity: e });
/** `n` swings of the starting weapon, seeded, as the hosts roll one (world.js duelStrikeOut: the sheet, the weapon, the
 *  stand-in): [hits, damage]. */
function swings(e, n) {
  const weapon = e.items.find((i) => i.group === 'Weapons');
  const a = duelAttackerOf(e, weapon), w = duelWeaponOf(weapon), rolls = lcg(7);
  let hits = 0, dmg = 0;
  for (let i = 0; i < n; i++) {
    const r = resolveDuelStrike({ by: 'melee', a, ...(w ? { w } : {}) }, duelStandIn(), { rolls });
    if (r.hit) hits++;
    dmg += r.dmg;
  }
  return [hits, dmg];
}
/** A Damage Health at range in `element` (classic 0 Fire, 1 Frost, 4 Magic), 20 a cast at level 1. */
const bolt = (element) => buildCustomSpell({ slots: [{ type: 4, subType: 0, settings: { magnitudeBaseLow: 20, magnitudeBaseHigh: 20, magnitudePerLevel: 20 } }], rangeType: 2, element, name: 'Bolt' });
/** `n` casts of `sp` by `e` counted as the hosts count one (world.js duelSpellOut: the caster's level, the stand-in, the
 *  caster), seeded: each cast's harm. */
function casts(e, sp, n) {
  const rolls = lcg(11);
  return Array.from({ length: n }, () => siegeSpellNumbers(sp, Math.max(1, Math.trunc(e.level || 1)), duelStandIn(), e, { rolls }).harm);
}
const sum = (xs) => xs.reduce((n, x) => n + x, 0);
/** The arms: a bare body, Well fed alone, Quenched alone, Thriving (the four boons together - the minute law grants
 *  Thriving only with the other three), a Fortify Luck of 5 (the luck of Thriving, alone) and one of 15. */
const ARMS = [
  ['bare', () => {}],
  ['fed', (e) => earn(e, ['fed'])],
  ['quenched', (e) => earn(e, ['quenched'])],
  ['thriving', (e) => earn(e, ['fed', 'quenched', 'rested', 'thriving'])],
  ['luck +5', (e) => fortify(e, 'luck', 5)],
  ['luck +15', (e) => fortify(e, 'luck', 15)],
];

test('AUDIT C&C H5 THE NEUTRAL STAND-IN: every blow and spell between players is counted on one body - every attribute 50 (the middle of the wire\'s own clamp, where every `stat - 50` term of both cores reads nought), level 1, no race, no skill, no career bits, whole at the wire\'s vital ceiling, unarmoured, and minted fresh each time (mutants: an attribute off the middle; the level, the race, a skill, a career bit; the health; the armour table dropped)', () => {
  assert.deepEqual(DUEL_STAND_IN, { lv: 1, r: 0, st: [50, 50, 50, 50, 50, 50, 50, 50], sk: [0, 0, 0, 0], cf: [0, 0, 0], h: [99999, 99999] });
  const s = duelStandIn();
  assert.deepEqual(s, {
    isPlayer: true, peer: true, level: 1, raceId: 0,
    stats: { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 },
    skillOverrides: { 19: 0, 30: 0, 34: 0 },
    career: { attackModifierFlags: 0, weaponArmorShieldsBitfield: 0, abilityFlagsAndSpellPointsBitfield: 0 },
    health: 99999, maxHealth: 99999, activeEffects: [], items: [], equipTable: {},
    clawMetal: 0,   // AUDIT CLAWS A1's stub carries the claws' metal (its sheet's `cm`) - the stand-in has no claws
    armorValues: [100, 100, 100, 100, 100, 100, 100],
  });
  assert.deepEqual(STAT_KEYS_ORDER.map((k) => liveStat(s, k)), [50, 50, 50, 50, 50, 50, 50, 50], 'what the formula reads');
  assert.equal(skillValue(s, SKILLS.Dodging), 0, 'nothing dodges');
  // fresh each time: a spell's count writes on the one it is handed
  s.activeEffects.push({ kind: 'continuousDamage' }); s.stats.luck = 90; s.armorValues[0] = 0;
  const t = duelStandIn();
  assert.deepEqual([t.activeEffects, t.stats.luck, t.armorValues[0]], [[], 50, 100]);
});

test('AUDIT C&C H5 A STRIKER\'S BUFFS HELP ITS BLOW AND NO LUCK HARMS IT: the live sheet a boon or a Fortify writes is the one the striker sends (duelAttackerOf reads liveStat), and against the neutral stand-in Quenched\'s Agility lands more blows and a +5 Luck as many as none - of 4,000 swings 2,318 bare and Well fed, 2,381 Quenched and Thriving, 2,318 at +5 Luck, 2,381 at +15 (against a stub of the striker\'s own sheet the Agility cancelled and every Luck landed FEWER: 2,318 Quenched, 2,284 Thriving and +5, 2,237 at +15); the overhaul\'s core, which online play is held to, and DFU\'s own read an unarmoured body (DFU\'s 2,201 bare - with no armour table the stand-in was an armour past any, and 128 landed) (mutants: the striker\'s sheet off its permanent stats; the roll against the striker\'s own stub; an attribute off the middle; the armour table dropped)', () => {
  const sheets = [], pcaao = [], stock = [];
  for (const [, put] of ARMS) {
    const e = mintPlayer();
    put(e);
    sheets.push(duelAttackerOf(e, e.items.find((i) => i.group === 'Weapons')).st.join('/'));
  }
  assert.deepEqual(sheets, [
    '52/52/51/51/51/51/51/51', '57/52/51/51/56/51/51/51', '52/52/51/56/51/51/56/51',
    '57/57/56/56/56/51/56/56', '52/52/51/51/51/51/51/56', '52/52/51/51/51/51/51/66',
  ], 'every live buff rides the striker\'s sheet');
  installPcaao();   // its shipped switches - online, the room's whole (systems/online/onlineLane.js ONLINE_WHOLE_MODS)
  try {
    for (const [, put] of ARMS) { const e = mintPlayer(); put(e); pcaao.push(swings(e, 4000)); }
  } finally { uninstallPcaao(); }
  for (const [, put] of ARMS) { const e = mintPlayer(); put(e); stock.push(swings(e, 4000)); }
  assert.deepEqual(pcaao, [[2318, 10769], [2318, 10769], [2381, 11055], [2381, 11055], [2318, 10769], [2381, 11055]], 'the overhaul\'s core: [hits, damage] of 4,000 swings');
  assert.deepEqual(stock, [[2201, 10067], [2196, 12198], [2201, 10067], [2196, 12198], [2201, 10067], [2233, 10195]], 'DFU\'s own core: an unarmoured body (a stand-in with no table read 0, an armour past any - 3 blows in 100 landed)');
});

test('AUDIT C&C H5 A SPELL\'S HARM IS COUNTED ON THE NEUTRAL STAND-IN: the caster\'s own race and willpower save against nothing of its own - a Breton\'s Magic bolt counts what its Fire and Frost bolts do, and a Fortify Willpower to 100 changes nothing (2,361 of 200 bolts each; against its own sheet 1,184 and 1,006 - its race\'s +30, its own willpower) - and a Disintegrate counts the body whole whatever the caster\'s own wounds (99,999, sent as a cast\'s most, 60, for the referee to clip; against its own sheet the caster\'s own 35, or 5 wounded) (mutants: the race; an attribute off the middle; the health)', () => {
  const e = mintPlayer();
  assert.deepEqual([e.raceId, e.level, e.health], [1, 1, 35], 'a level-1 Breton - its race resists Magic - whole at 35');
  const strong = mintPlayer();
  fortify(strong, 'willpower', 49);
  assert.equal(liveStat(strong, 'willpower'), 100);
  assert.deepEqual([sum(casts(e, bolt(4), 200)), sum(casts(e, bolt(0), 200)), sum(casts(e, bolt(1), 200)), sum(casts(strong, bolt(4), 200))], [2361, 2361, 2361, 2361], 'harm of 200 bolts each');
  const DISINTEGRATE = buildCustomSpell({ slots: [{ type: 5, subType: 255, settings: { chanceBase: 100 } }], rangeType: 1, element: 4, name: 'Disintegrate' });
  const hurt = mintPlayer();
  hurt.health = 5;
  const kills = casts(e, DISINTEGRATE, 8);
  assert.deepEqual(kills, [0, 0, 99999, 99999, 0, 0, 99999, 99999], 'a kill counts the body whole, or a save spares it');
  assert.deepEqual(casts(hurt, DISINTEGRATE, 8), kills, 'the caster\'s own wounds are not the count');
  assert.deepEqual(kills.map((n) => siegeCastClamp(n, false)), [0, 0, 60, 60, 0, 0, 60, 60], 'the number the hosts send: a cast\'s most');
});

test('AUDIT C&C H5 THE HOSTS BY SOURCE - ONE CONSTRUCTION SEAM: every blow a host rolls between players (a duel\'s, a siege\'s, a siege work\'s, the open zone\'s) and every spell it counts (a duel\'s, a siege\'s, a side-mate\'s gift, the zone\'s) takes the one stand-in, swept over every source file; no stub of the striker\'s own sheet stands in anywhere (mutants: each of the eight sites back on a stub of my own sheet)', () => {
  const files = readdirSync(new URL('../../src/', import.meta.url), { recursive: true }).filter((f) => f.endsWith('.js')).map((f) => f.split('\\').join('/'));
  const rolls = [], counts = [], stubs = [];
  for (const f of files) {
    if (f === 'combat/duelCombat.js' || f === 'combat/siegeCombat.js') continue;   // the producers' own definitions
    for (const line of read(`src/${f}`).split('\n')) {
      if (line.includes('resolveDuelStrike(')) rolls.push([f, line.trim().endsWith(', duelStandIn());')]);
      if (line.includes('siegeSpellNumbers(')) counts.push([f, /, duelStandIn\(\), playerEntity\)\)?;/.test(line)]);   // FIRM1: a count at a player may be read with the sky off (withoutFirmament(playerEntity, () => ...))
      if (line.includes('duelStub(')) stubs.push(f);
    }
  }
  assert.deepEqual(rolls, [['scenes/world.js', true], ['scenes/world.js', true], ['scenes/world.js', true], ['scenes/world.js', true]], 'four rolls, each against the stand-in');
  assert.deepEqual(counts, [['scenes/world.js', true], ['scenes/world.js', true], ['scenes/world.js', true], ['scenes/world.js', true]], 'four counts, each on the stand-in');
  assert.deepEqual(stubs, [], 'no stub of my own sheet stands in');
  // each by its own function: the duel's, the siege work's, the siege's and the zone's roll; the four counts
  const w = read('src/scenes/world.js');
  const body = (decl) => { const i = w.indexOf(decl); assert.ok(i >= 0, decl); return w.slice(i, w.indexOf('\n  };\n', i)); };
  assert.ok(body('const duelStrikeOut = (').includes('const r = resolveDuelStrike({ by, a, ...(w ? { w } : {}), ...(sw ? { sw } : {}), ...at, ...(off ? { off } : {}) }, duelStandIn());'));   // PIN MOVED (TWO-HANDS AUDIT): and the off hand's terms
  assert.ok(body('const siegeWorkHit = (').includes("const r = resolveDuelStrike({ by: 'melee', a, ...(w ? { w } : {}), ...(sw ? { sw } : {}), ...(weaponRig.playerWeapon.offStrike ? { off: true } : {}) }, duelStandIn());"));   // PIN MOVED (TWO-HANDS AUDIT)
  assert.ok(body('const siegeStrikeOut = (').includes('const r = resolveDuelStrike({ by, a, ...(w ? { w } : {}), ...(sw ? { sw } : {}), ...(drawMs > 0 ? { at: Math.min(60000, Math.trunc(drawMs)) } : {}), ...(off ? { off } : {}) }, duelStandIn());'));   // PIN MOVED (TWO-HANDS AUDIT)
  assert.ok(body('const wildStrikeOut = (').includes('const r = resolveDuelStrike({ by, a, ...(w ? { w } : {}), ...(sw ? { sw } : {}), ...at, ...(off ? { off } : {}) }, duelStandIn());'));   // PIN MOVED (TWO-HANDS AUDIT)
  for (const decl of ['const duelSpellOut = (', 'const siegeSpellOut = (', 'const wildSpellOut = (']) {
    assert.ok(body(decl).includes('const { harm } = withoutFirmament(playerEntity, () => siegeSpellNumbers(sp, Math.max(1, Math.trunc(playerEntity.level || 1)), duelStandIn(), playerEntity));'), decl);   // FIRM1: with the sky off
  }
  assert.ok(body('const siegeHealOut = (').includes('const { heal } = siegeSpellNumbers(frame?.spell, Math.max(1, Math.trunc(frame?.level || 1)), duelStandIn(), playerEntity);'));
});
