// BAL1-BAL4 - THE BALANCE ARC (2026-10-10; bible/05-Combat/Balance-Arc.md; Mac, 2026-10-09: "I also want to talk about
// general balance to bring up the difficulty without implementing a band aid fix", then, 2026-10-10: "Do everything and
// be extremely detailed").
//
// BAL1: the overhaul's sharp edge (a blade over 75% condition at x1.3 / x1.1, a piece of armour at 0.85 / 0.95) rides the
// mod's own wear module - the port ships it off, so the edge was every fight's; the worn bands stand whatever the wear.
// BAL2: one rule for every striker - a foe's weapon skill counts x1.5 to hit and its Critical Strike rolls, multiplies
// and aims as the player's; the armour term stays the mod's.
// BAL3: the place sets the threat - the veteran layer reads the loot ladder's grading of the place a foe stands in (a
// town's 4 nothing, a Dragon's Den's 18 the whole row), Master Skills' own layers kept beside it, the ladder's switch
// its gate.
// BAL4: the offline defaults - elites wherever the ladder stands, the Enhanced AI on (an unstamped shelf adopting it),
// and an offline Project Legacy rise paying the online respawn's tenth, stated on its death screen.
//
// Pinned by execution through the real blow (pcaaoAttackDamage), the stats card, the scaling and the open world's own
// spawn pool; the dungeon's seam by its source, beside the arena and the hosts' own pins of the same lines.

import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setPref, _resetForTests } from '../src/systems/uiPrefs.js';
import {
  pcaaoModules, pcaaoAttackDamage, pcaaoAlterDamageBasedOnWepCondition, pcaaoAlterArmorReducBasedOnItemCondition,
} from '../src/combat/pcaao.js';
import { computeCombatStats } from '../src/combat/combatStats.js';
import { makeEnemyEntity, applyProgressionScaling } from '../src/characters/enemyEntity.js';
import { ENEMY_BASICS } from '../src/characters/enemyBasics.js';
import { createWeapon } from '../src/combat/enemyEquipment.js';
import { mintCondition } from '../src/systems/itemTemplates.js';
import { EQUIP_SLOTS, equipTableOf, _wearScaleForTests } from '../src/systems/equip.js';
import { SKILLS } from '../src/systems/skills.js';
import {
  PLACE_THREAT, placeVeteran, wildernessThreat, progressionScaling, ENEMY_SCALING, DUNGEON_SHARE,
} from '../src/systems/skillSoftcap.js';
import { DUNGEON_RARITY_TIER, dungeonRarityTier } from '../src/systems/lootRarity.js';
import { elitesAllowed, isEliteFoe } from '../src/systems/eliteFoes.js';
import { createExteriorFoes } from '../src/scenes/exteriorFoes.js';
import { PREF_DEFAULTS, getPref } from '../src/systems/uiPrefs.js';
import { FEATURES } from '../src/systems/features.js';
import { tacticsSwitchOn } from '../src/ai/tactics.js';
import { coverSwitchOn } from '../src/ai/cover.js';
import { DeathScreen, riseHint } from '../src/ui/deathScreen.js';
import { deathKeys } from '../src/ui/enhancedDeath.js';
import { stateDeathLoss, statedDeathLoss, applyDeathPenalty } from '../src/systems/deathPenalty.js';

_wearScaleForTests(1);   // the mod's wear verbatim (BALANCE1's scale is test/balance1.test.js's)

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const ladder = (on) => { _resetForTests(); setPref('lootRarity', on); };
const OVERHAUL = { Enabled: true, equipmentDamageEnhanced: false, fadingEnchantedItems: false, fixedStrengthDamageModifier: true, armorHitFormulaRedone: true, criticalStrikesIncreaseDamage: true, conditionBasedEffectiveness: true, softMaterialRequirements: true };
const modsOf = (over = {}) => pcaaoModules((k) => ({ ...OVERHAUL, ...over })[k], () => undefined);
const stats = (o = {}) => ({ strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50, ...o });
const skillsAll = (v, o = {}) => ({ ...Object.fromEntries(Array.from({ length: 35 }, (_, i) => [i, v])), ...o });
const mkPlayer = (o = {}) => ({ isPlayer: true, level: 12, raceId: 1, stats: stats({ strength: 70 }), skills: skillsAll(40, { [SKILLS.LongBlade]: 60 }), career: { weaponArmorShieldsBitfield: 0, abilityFlagsAndSpellPointsBitfield: 0 }, health: 500, maxHealth: 500, items: [], armorValues: new Array(7).fill(100), reflexes: 2, biographyAvoidHitMod: 0, ...o });
const career = stats({ attackModifierFlags: 0 });
const monster = (id, lvl = 12) => makeEnemyEntity(id, ENEMY_BASICS[id], career, lvl, () => 0.5);
const knight = (skill, crit = 0, o = {}) => { const e = makeEnemyEntity(128 + 9, ENEMY_BASICS[128 + 9], career, 5, () => 0.5); e.skills = skillsAll(skill, { [SKILLS.CriticalStrike]: crit }); return Object.assign(e, o); };
const at = (pct) => ({ maxCondition: 100, currentCondition: pct });
const fixed = (v) => () => v;
const mulberry = (a) => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

// ── BAL1 ──────────────────────────────────────────────────────────

test('BAL1 the bands: without the mod\'s wear a weapon at 76% and over strikes at its own damage and a piece reduces at its own factor; every band under 76 stands either way', () => {
  for (let pct = 0; pct <= 100; pct++) {
    for (const blunt of [false, true]) {
      const edge = pcaaoAlterDamageBasedOnWepCondition(100, blunt, at(pct), true);
      const none = pcaaoAlterDamageBasedOnWepCondition(100, blunt, at(pct), false);
      if (pct >= 76) assert.equal(none, 100, `${pct}% ${blunt ? 'blunt' : 'edged'}: the normal band`);
      else assert.equal(none, edge, `${pct}% ${blunt ? 'blunt' : 'edged'}: the worn band is the world's, whatever the wear`);
    }
    const armEdge = pcaaoAlterArmorReducBasedOnItemCondition(at(pct), true);
    const armNone = pcaaoAlterArmorReducBasedOnItemCondition(at(pct), false);
    if (pct >= 76) assert.equal(armNone, 1, `${pct}% armour: its own factor`);
    else assert.equal(armNone, armEdge, `${pct}% armour: the worn band stands`);
  }
  // the edge as the mod pays it, with its wear on (and the defaults: a caller that says nothing is the mod's own)
  assert.deepEqual([95, 80, 70].map((p) => pcaaoAlterDamageBasedOnWepCondition(100, false, at(p), true)), [130, 110, 100]);
  assert.deepEqual([95, 80].map((p) => pcaaoAlterDamageBasedOnWepCondition(100, true, at(p), true)), [110, 100]);
  assert.equal(pcaaoAlterDamageBasedOnWepCondition(100, false, at(95)), 130, 'the parameter\'s default is the mod\'s');
  assert.deepEqual([95, 80].map((p) => pcaaoAlterArmorReducBasedOnItemCondition(at(p), true)), [Math.fround(0.85), Math.fround(0.95)]);
  assert.equal(pcaaoAlterArmorReducBasedOnItemCondition(null, false), 1, 'no piece: 1');
  assert.equal(pcaaoAlterDamageBasedOnWepCondition(100, false, at(50), false), 85, 'a half-worn blade still loses 15%');
  assert.equal(pcaaoAlterArmorReducBasedOnItemCondition(at(10), false), Math.fround(1.35), 'a ruined piece still lets more through');
});

test('BAL1 through the blow: a fresh blade strikes a third harder only with the mod\'s wear on, and fresh armour reduces better only then; the stats card reads the same edge', () => {
  const swordOf = () => mintCondition({ group: 'Weapons', templateIndex: 120, material: 1, flags: 0, name: 'Longsword' });
  const swing = (wear, seed) => {
    const p = mkPlayer(); const w = swordOf(); equipTableOf(p)[EQUIP_SLOTS.RightHand] = w; p.items.push(w);
    const rolls = mulberry(seed);
    return pcaaoAttackDamage(p, monster(24), { weapon: w, rolls, dfRand: () => Math.floor(rolls() * 32768), modules: modsOf({ equipmentDamageEnhanced: wear }) });
  };
  let off = 0, on = 0, landed = 0;
  for (let s = 1; s <= 400; s++) {
    const a = swing(false, s), b = swing(true, s);
    if (a > 0) { landed++; off += a; on += b; assert.ok(b >= a, `seed ${s}: the edge never takes damage away (${b} < ${a})`); }
  }
  assert.ok(landed > 100, `enough blows landed (${landed})`);
  assert.ok(on / off > 1.25 && on / off < 1.35, `a fresh blade x1.3 with the wear on, x1 without (${(on / off).toFixed(3)})`);

  // a foe's blow on a player in fresh plate: more gets through without the wear's edge
  const ARMOR = [[102, 'ChestArmor'], [103, 'Gloves'], [104, 'LegsArmor'], [105, 'LeftArm'], [106, 'RightArm'], [107, 'Head'], [108, 'Feet']];
  const taken = (wear) => {
    let sum = 0;
    for (let s = 1; s <= 600; s++) {
      const p = mkPlayer(); const t = equipTableOf(p);
      for (const [ti, slot] of ARMOR) { const it = mintCondition({ group: 'Armor', templateIndex: ti, material: 0x0201, name: `a${ti}` }); t[EQUIP_SLOTS[slot]] = it; p.items.push(it); }
      const rolls = mulberry(5000 + s);
      sum += pcaaoAttackDamage(monster(24), p, { weapon: null, rolls, dfRand: () => Math.floor(rolls() * 32768), modules: modsOf({ equipmentDamageEnhanced: wear }), playerReflexes: 2 });
    }
    return sum;
  };
  const tOff = taken(false), tOn = taken(true);
  assert.ok(tOff > tOn * 1.08, `fresh armour's 0.85 is the wear's: ${tOff} taken without it, ${tOn} with`);

  // the card: the headline swing on the armoured reference foe
  const p = mkPlayer(); const w = { ...swordOf(), maxCondition: 1e9, currentCondition: 1e9 };
  const card = (wear) => computeCombatStats(p, { core: 'overhaul', weapon: w, modules: modsOf({ equipmentDamageEnhanced: wear, criticalStrikesIncreaseDamage: false }) }).head.byFoe[1].dmg.avg;
  const ratio = card(true) / card(false);
  assert.ok(ratio > 1.25 && ratio < 1.35, `the card's edge rides the same switch (${ratio.toFixed(3)})`);
});

// ── BAL2 ──────────────────────────────────────────────────────────

test('BAL2 one rule for every striker: a foe\'s weapon skill counts x1.5 to hit, its crit doubles a blow as the player\'s does; the armour term is the mod\'s', () => {
  const sword = createWeapon(120, 1);
  const player = mkPlayer();
  const M = modsOf();
  // a hundred evenly spaced rolls: how many land is the chance (no crit: Critical Strike 0)
  const landed = (skill) => {
    let n = 0;
    for (let i = 0; i < 100; i++) {
      const notes = { hit: false };
      pcaaoAttackDamage(knight(skill), player, { weapon: sword, rolls: fixed(i / 100 + 0.001), dfRand: () => 0, modules: M, notes });
      if (notes.hit) n++;
    }
    return n;
  };
  assert.equal(landed(20), 62, 'Long Blade 20: ceil(20 x 1.5) = 30 to hit, on the bare player\'s flat 100');
  assert.equal(landed(30) - landed(20), 15, 'ten more skill is fifteen more to hit, as the player\'s (it was ten)');
  assert.equal(landed(60), 97, 'the clamp still holds both ways (DISC19-D)');
  // the crit: Critical Strike 100 at Luck 50 lands one blow in four (100 / 4), x2.0 and +25 to hit
  const blow = (crit, v) => {
    const notes = { hit: false, critical: false };
    const d = pcaaoAttackDamage(knight(60, crit, { stats: stats({ strength: 100 }) }), player, { weapon: createWeapon(121, 1), rolls: fixed(v), dfRand: () => 0, modules: M, notes });
    return [d, notes.critical];
  };
  assert.deepEqual(blow(0, 0.15), [10, false]);
  assert.deepEqual(blow(100, 0.15), [20, true], 'a foe\'s crit multiplies by 1 + 20 x 0.05 = 2, the player\'s own (it was 1.5)');
  assert.deepEqual(blow(100, 0.24), [2 * blow(0, 0.24)[0], true], 'crit / (4 - 0) = 25%: 0.24 crits, and doubles');
  assert.equal(blow(100, 0.25)[1], false, 'and 0.25 does not (a foe\'s was crit / 5)');
  // and a landed crit's aim: on a player who dodges at 100, Long Blade 0 lands at the 3% floor - a crit's +25 lands every
  // one of the quarter of rolls that crit (it was +10: twelve)
  const dodger = mkPlayer({ skills: skillsAll(40, { [SKILLS.Dodging]: 100 }) });
  const landedOn = (crit) => {
    let n = 0;
    for (let i = 0; i < 100; i++) {
      const notes = { hit: false };
      pcaaoAttackDamage(knight(0, crit), dodger, { weapon: sword, rolls: fixed(i / 100 + 0.001), dfRand: () => 0, modules: M, notes });
      if (notes.hit) n++;
    }
    return n;
  };
  assert.equal(landedOn(0), 3, 'the floor');
  assert.equal(landedOn(100), 25, 'crit / 4 = +25 to hit on every crit');
  // the source: one line for the hit, none of the old arms left
  const src = rd('src/combat/pcaao.js');
  assert.match(src, /^ {2}chanceToHitMod = Math\.ceil\(F\(skill\(attacker, skillID\) \* F\(1\.5\)\)\);$/m);
  assert.doesNotMatch(src, /^\s*critDamMulti = F\(F\(int\(crit \/ 5\) \* F\(0\.025\)\)|^\s*critHitAddi = int\(crit \/ 10\)|return dice100\(int\(crit \/ \(5 - luckTerm\)\)|isPlayer\(attacker\) \? Math\.ceil/m, 'the foe\'s lesser arms are gone');
  assert.match(src, /if \(isPlayer\(target\)\) result = 100 - entityEnchantArmorMod\(target\) - entityArmorPoints\(target, struckBodyPart\);/, 'the armour term is the mod\'s: the player reads 100');
  assert.match(src, /else if \(isClassEnemy\(target\)\) result = 60;/, 'and a class foe its flat 60');
});

// ── BAL3 ──────────────────────────────────────────────────────────

test('BAL3 the place\'s veteran: nothing at a town\'s 4, the whole row at a Dragon\'s Den\'s 18, linear between; the wilds at 5 by day and 7 at night; every dungeon kind at its ladder tier', () => {
  assert.deepEqual({ ...PLACE_THREAT, wilderness: { ...PLACE_THREAT.wilderness } }, { from: 4, full: 18, wilderness: { day: 5, night: 7 } });
  assert.ok(Object.isFrozen(PLACE_THREAT) && Object.isFrozen(PLACE_THREAT.wilderness));
  assert.deepEqual([0, 3, 4, 11, 18, 21].map(placeVeteran), [0, 0, 0, 0.5, 1, 1]);
  assert.equal(placeVeteran(5), 1 / 14);
  assert.deepEqual([undefined, null, NaN, 'x'].map(placeVeteran), [0, 0, 0, 0], 'no tier, no threat');
  assert.deepEqual([wildernessThreat(false), wildernessThreat(true)], [5, 7]);
  // the design page's table (section 5), at a full-share foe and a player with no Master Skills
  const row = (tier) => { const s = progressionScaling({ veteran: 0, edge: 0 }, 0, 1, placeVeteran(tier)); return s && [+s.healthMult.toFixed(2), +s.damageMult.toFixed(2), +s.skillGain.toFixed(1)]; };
  assert.equal(row(4), null, 'a town: DFU\'s own foe');
  assert.deepEqual([5, 7, 9, 11, 14, 15, 18].map(row), [
    [1.07, 1.02, 0.7], [1.21, 1.05, 2.1], [1.36, 1.09, 3.6], [1.5, 1.13, 5], [1.71, 1.18, 7.1], [1.79, 1.2, 7.9], [2, 1.25, 10],
  ]);
  // every dungeon kind reads its own ladder tier - the grading the loot already reads
  const DEN = 14, CEMETERY = 18, MINE = 5, CRYPT = 0;
  assert.equal(placeVeteran(dungeonRarityTier(DEN)), 1, 'a Dragon\'s Den: the whole row');
  assert.equal(placeVeteran(dungeonRarityTier(CEMETERY)), 0, 'a Cemetery (3): none');
  assert.equal(placeVeteran(dungeonRarityTier(MINE)), 0, 'a mine (4): none');
  assert.equal(placeVeteran(dungeonRarityTier(CRYPT)), 5 / 14, 'a Crypt (9)');
  assert.equal(placeVeteran(dungeonRarityTier(undefined)), 0, 'no dungeon');
  assert.equal(DUNGEON_RARITY_TIER.length, DUNGEON_SHARE.length, 'one grade per kind, both tables');
  assert.equal(Math.max(...DUNGEON_RARITY_TIER), PLACE_THREAT.full, 'the deepest kind is the full row');
});

test('BAL3 progressionScaling: the place\'s veteran times the foe\'s share, or the player\'s veteran in this kind of place, whichever is more; the overcap the climb\'s alone; three arguments SOFTCAP2\'s own', () => {
  const V = ENEMY_SCALING.veteran, O = ENEMY_SCALING.overcap;
  const none = { veteran: 0, edge: 0 };
  // a rat stays a rat: the foe's share scales the place
  assert.equal(progressionScaling(none, 0, 0, 1), null, 'a share-0 foe in a Dragon\'s Den: none');
  const half = progressionScaling(none, 0, 0.5, 1);
  assert.deepEqual([half.healthMult, half.damageMult, half.skillGain, half.challengeLevels], [1 + V.health / 2, 1 + V.damage / 2, V.skill / 2, 3]);
  assert.equal(half.place, 1); assert.equal(half.share, 0, 'the Master Skills share is its own');
  assert.equal(progressionScaling(none, 0, 1, 3).healthMult, 1 + V.health, 'a place past whole reads whole');
  assert.equal(progressionScaling(none, 0, 1, -1), null, 'and under none, none');
  // Master Skills' veteran a floor beside the place: whichever is more
  const vet = { veteran: 1, edge: 0 };
  assert.equal(progressionScaling(vet, 1, 1, 0.5).healthMult, 1 + V.health, 'the player\'s veteran over a lesser place');
  assert.equal(progressionScaling(vet, 0.22, 1, 0.5).healthMult, 1 + V.health * 0.5, 'the place over a lesser veteran');
  assert.equal(progressionScaling(vet, 0.22, 1, 0).healthMult, 1 + V.health * 0.22, 'no place: SOFTCAP2 exactly');
  // the overcap adds on top, at the Master Skills share
  const climb = progressionScaling({ veteran: 0, edge: 40 }, 0.5, 1, 1);
  assert.equal(climb.skillGain, V.skill + O.skill * 0.5);
  assert.equal(climb.healthMult, 1 + V.health + O.health * 0.5);
  assert.equal(climb.damageMult, 1 + V.damage + O.damage * 0.5);
  // three arguments: SOFTCAP2's numbers, unmoved
  const old = progressionScaling({ veteran: 0.5, edge: 20 }, 0.88, 1);
  assert.equal(old.healthMult, 1 + 0.88 * (V.health * 0.5 + O.health * 0.5));
  assert.equal(old.place, 0);
  assert.equal(progressionScaling({ veteran: 1, edge: 40 }, 0, 1), null, 'no share, no place: none');
  // the one writer records the place beside the player's
  const e = monster(24);
  const hp = e.maxHealth;
  applyProgressionScaling(e, progressionScaling(none, 0, 1, placeVeteran(18)));
  assert.equal(e.maxHealth, Math.max(1, Math.round(hp * 2)));
  assert.equal(e.progression.place, 1);
});

// the open world's pool, on a crafted MONSTER.BSA (test/world6bii.test.js's rig): an Orc Warlord (base level 16, a
// full share) spawned in the wilds - `inLocation` false - at midnight
function craftCfg() {
  const b = new Uint8Array(74); const v = new DataView(b.buffer);
  b[10] = 0x08; v.setUint16(52, 4, true);
  [40, 50, 50, 85, 50, 50, 90, 55].forEach((a, i) => v.setUint16(58 + i * 2, a, true));
  return b;
}
function craftMonsterBsa(records) {
  const NAME_FIELD = 14, ENTRY = 18;
  const out = new Uint8Array(4 + records.reduce((a, [, b]) => a + b.length, 0) + ENTRY * records.length); const v = new DataView(out.buffer);
  v.setInt16(0, records.length, true); v.setUint16(2, 0x0100, true);
  let pos = 4;
  for (const [, bytes] of records) { out.set(bytes, pos); pos += bytes.length; }
  for (const [name, bytes] of records) { for (let i = 0; i < name.length; i++) out[pos + i] = name.charCodeAt(i); v.setInt32(pos + NAME_FIELD, bytes.length, true); pos += ENTRY; }
  return out;
}
const BSA = craftMonsterBsa([['ENEMY024.CFG', craftCfg()]]);
const stubTex = { getSize: () => ({ width: 64, height: 100 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 8, getFrameCount: () => 1 };
const wildsPool = (inLocation = () => false) => createExteriorFoes({
  renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {}, textures: new Map() },
  collider: { raycast: () => Infinity, heightAt: () => 0, raycastHit: () => ({ dist: Infinity, normal: null }), sphereOverlaps: () => false, capsuleCast: () => ({ dist: Infinity, key: null }), sphereCast: () => ({ dist: Infinity, key: null }), move: (f) => f },
  fetchBytes: async (n) => { if (n === 'MONSTER.BSA') return BSA; throw new Error(`no ${n} in this pin`); },
  getTexture: async () => stubTex, uploadRecordFrame: () => {},
  currentMinute: () => 0, currentPixelKey: () => '3,12',
  playerEntity: { level: 12, reflexes: 2, health: 50, maxHealth: 50, skills: new Array(40).fill(20), skillUses: new Array(40).fill(0), items: [], activeEffects: [], stats: stats() },
  audio: null, onPlayerHurt: () => {}, rolls: () => 0.01, rand: () => 0.01,
  inLocation,
});
const withRandom = async (v, fn) => { const old = Math.random; Math.random = () => v; try { return await fn(); } finally { Math.random = old; } };

test('BAL3 the wilds by execution: a full-share foe spawned in the open at night stands at the harpy nest\'s 7 while the ladder does; the ladder off, or on a location\'s ground, DFU\'s own', async () => {
  const spawn = async (on, inLocation) => { ladder(on); const f = await withRandom(0.5, () => wildsPool(inLocation).spawnFoe(24, [10, 0, 10], { feetGiven: true, eliteFoe: false, champion: null })); return f.entity; };   // no elite, no champion: the place alone (the hit points' roll is Math.random's)
  const plain = await spawn(false);
  assert.equal(plain.progression, undefined, 'the ladder off: no scaling offline (Master Skills off)');
  const wild = await spawn(true);
  const p = placeVeteran(wildernessThreat(true));
  assert.equal(wild.progression.place, p, 'night: tier 7');
  assert.equal(wild.maxHealth, Math.max(1, Math.round(plain.maxHealth * (1 + ENEMY_SCALING.veteran.health * p))));
  assert.equal(wild.damageScale, (Number.isFinite(plain.damageScale) ? plain.damageScale : 1) * (1 + ENEMY_SCALING.veteran.damage * p));
  const town = await spawn(true, () => true);
  assert.equal(town.progression, undefined, 'a location\'s ground never scales');
  assert.equal(town.maxHealth, plain.maxHealth);
  ladder(true);
});

test('BAL3 the dungeon\'s seam by source: the dungeon\'s ladder tier read once at the build, the ladder\'s switch at every spawn, the place handed to the one scaling; the four hosts', () => {
  const dc = rd('src/scenes/dungeonContext.js');
  const build = dc.indexOf('const _placeVeteran = placeVeteran(dungeonRarityTier(dfLocation.mapTableData?.dungeonType));');
  const fn = dc.indexOf('function applyProgressionScalingTo(entity, basics) {');
  assert.ok(build > 0 && fn > build, 'the tier at the build, before the seam');
  const body = dc.slice(fn, dc.indexOf('\n  }\n', fn));
  assert.match(body, /const place = lootRarityOn\(\) \? _placeVeteran : 0;/, 'the ladder\'s switch at each spawn');
  assert.match(body, /if \(!\(_dungeonShare > 0\) && !\(place > 0\)\) return;/, 'no share and no place: nothing');
  assert.match(body, /progressionScaling\(combatStanding\(foeDeps\.playerEntity\), _dungeonShare, foeShare\(basics\?\.level \?\? entity\.level, entity\.isClass\), place\);/);
  assert.match(dc, /import \{ combatStanding, dungeonShare, foeShare, progressionScaling, placeVeteran \} from '\.\.\/systems\/skillSoftcap\.js';/);
  assert.match(dc, /dungeonRarityTier, dungeonFamily, stampWonWeapons, lootRarityOn \} from '\.\.\/systems\/lootRarity\.js';/);
  // the wilds' seam (executed above) - one call, the ladder's gate in it
  const xf = rd('src/scenes/exteriorFoes.js');
  assert.match(xf, /foeShare\(basics\?\.level \?\? entity\.level, isClass\), lootRarityOn\(\) \? placeVeteran\(wildernessThreat\(night\)\) : 0\)\);/);
  // THE FOUR HOSTS: world.js's wilds pass the location rect; exterior.js's fixed city and worldModes.js's interiors pass
  // none (the pool's default is "on a location's ground"), so neither scales - a town's tier
  assert.match(rd('src/scenes/world.js'), /inLocation: \(\) => _musicInLocationRect\(\),/);
  const pools = (src) => src.split('createExteriorFoes({').slice(1).map((s) => s.slice(0, s.indexOf('});')));
  for (const host of ['src/scenes/exterior.js', 'src/scenes/worldModes.js']) {
    const ps = pools(rd(host));
    assert.ok(ps.length >= 1, host);
    for (const p of ps) assert.doesNotMatch(p, /inLocation:/, `${host}: a town's ground`);
  }
});

// ── BAL4 ──────────────────────────────────────────────────────────

test('BAL4 elites offline: wherever the loot ladder stands - online always, offline with the ladder, never with it off; the wilds\' own roll by execution', async () => {
  ladder(true);
  assert.equal(elitesAllowed(), true, 'offline, the ladder on (its default)');
  assert.equal(elitesAllowed({ onlinePage: true }), true); assert.equal(elitesAllowed({ inRoom: true }), true);
  ladder(false);
  assert.equal(elitesAllowed(), false, 'the ladder off: DFU\'s lane, no elite');
  assert.equal(elitesAllowed({ onlinePage: true }), true, 'online stands whatever the shelf says');
  assert.equal(elitesAllowed({ inRoom: true }), true);
  // the open world's one-in-twenty, off Math.random (the encounter's own dice unmoved)
  const spawn = async (on, r) => { ladder(on); return (await withRandom(r, () => wildsPool().spawnFoe(24, [10, 0, 10], { feetGiven: true, champion: null }))).entity; };
  assert.equal(isEliteFoe(await spawn(true, 0.01)), true, 'offline, the ladder on: 0.01 < 0.05 stands as an elite');
  assert.equal(isEliteFoe(await spawn(true, 0.06)), false, 'and 0.06 does not');
  assert.equal(isEliteFoe(await spawn(false, 0.01)), false, 'the ladder off: never');
  ladder(true);
});

test('BAL4 the Enhanced AI ships On: the row, the shelf\'s default, the brain and the cover read it at once; Off is one press, the classic motor whole', () => {
  _resetForTests();
  const row = FEATURES.find((f) => f.id === 'enhanced-ai');
  assert.equal(row.control.initial, true);
  assert.equal(row.control.online, true, 'and forced on online, as it always was');
  assert.equal(PREF_DEFAULTS.enhancedAI, true);
  assert.equal(getPref('enhancedAI'), true, 'a fresh shelf');
  assert.equal(tacticsSwitchOn(), true, 'the tactics brain');
  assert.equal(coverSwitchOn(), true, 'the cover');
  setPref('enhancedAI', false);
  assert.equal(tacticsSwitchOn(), false, 'Off: the classic motor');
  assert.equal(coverSwitchOn(), false);
  _resetForTests();
  assert.match(rd('src/systems/uiPrefs.js'), /const PREF1_ADOPT_NEW_DEFAULT = Object\.freeze\(\['lootRarity', 'enhancedAI'\]\);/, 'an unstamped shelf\'s materialised Off adopts it (test/pref1_shelf.test.js runs it)');
});

test('BAL4 a real cost for dying offline: a death Project Legacy will raise states and takes the online respawn\'s tenth, says Rise where it said End the journey; a death with no rise takes nothing', () => {
  const who = () => ({ goldPieces: 345, raceId: 1, gender: 0 });
  // a rise offline: the host hands `rises`, the screen states a tenth of the purse
  stateDeathLoss(null);
  const me = who();
  const rising = new DeathScreen({ eyeHeight: 1.6, capsuleHeight: 1.8, entity: me, online: false, rises: () => true });
  assert.equal(rising.rises, true);
  assert.equal(rising.goldLoss, 34, 'a tenth of 345, rounded down');
  assert.equal(statedDeathLoss(), 34, 'stated for the respawn');
  assert.equal(rising.hint, 'ENTER end   F11 load', 'the host\'s hint is kept');
  assert.equal(riseHint(rising.hint), 'ENTER rise   F11 load', 'and the classic face draws Enter as the rise');
  me.goldPieces = 400;   // whatever the purse did while the player lay dead
  assert.equal(applyDeathPenalty(me), 34, 'the respawn takes what the screen said');
  assert.equal(me.goldPieces, 366);
  // no rise (Legacy off, Bloodline's fall, the fixed city): the run ends, nothing is said or taken
  for (const rises of [null, () => false]) {
    stateDeathLoss(null);
    const ends = new DeathScreen({ eyeHeight: 1.6, capsuleHeight: 1.8, entity: who(), online: false, rises });
    assert.equal(ends.rises, false);
    assert.equal(ends.goldLoss, 0);
    assert.equal(statedDeathLoss(), null, 'nothing stated');
  }
  // online the rise is the room's respawn - `rises` is offline's word alone, the loss the same tenth
  stateDeathLoss(null);
  const room = new DeathScreen({ eyeHeight: 1.6, capsuleHeight: 1.8, entity: who(), online: true, rises: () => true });
  assert.equal(room.rises, false, 'online: the respawn countdown, never the Legacy word');
  assert.equal(room.goldLoss, 34);
  stateDeathLoss(null);
  // the enhanced face's plates
  assert.deepEqual(deathKeys('ENTER end   F11 load', false, true).map((k) => k.word), ['Rise', 'Load last save']);
  assert.deepEqual(deathKeys('ENTER end   F11 load', false, false).map((k) => k.word), ['End the journey', 'Load last save']);
  assert.deepEqual(deathKeys('ENTER end', false, true).map((k) => k.word), ['Rise'], 'no F11 where there is no quickload');
  assert.deepEqual(deathKeys('ENTER end   F11 load', true, true).map((k) => k.word), ['Rise now']);
  assert.match(rd('src/ui/enhancedDeath.js'), /lossLine \|\| \(online \|\| screen\.rises\n\s*\? 'Your body falls\. The Bay is not done with you yet\.'/, 'and the line is the rise\'s, not "your tale ends here"');
  // the street's rise takes it: the offline arm keeps only the revenant's theft online's
  const w = rd('src/scenes/world.js');
  const reset = w.slice(w.indexOf('function legacyDeathReset() {'), w.indexOf('function openLegacySuccession('));
  assert.match(reset, /if \(!\(_deathWasOnline \?\? _onlineWorldSession\(\)\)\) forgetLastSlew\(\);\n\s*respawnOnlinePlayer\(\);/);
  assert.doesNotMatch(reset, /stateDeathLoss\(0\)/, 'no word of "none" over the screen\'s');
  // the dungeon the mode machine builds is handed the same word its screen reads (dungeonContext's `rises: opts.legacyWillRise`)
  assert.match(rd('src/scenes/worldModes.js'), /legacyWillRise: \(\) => host\.legacyWillRise\?\.\(\) \?\? false,/);
});
