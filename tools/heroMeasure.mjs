#!/usr/bin/env node
// BAL11 (2026-10-17, bible/05-Combat/Balance-Arc.md section 17; the Discord's field report: "the game gets too easy ...
// starting around character level 10/renown 15ish"): THE HERO'S THREAT, MEASURED - what one kill costs a stated player of
// each level and Renown, against DFU's own encounter band at that level (systems/encounters.js chooseRandomEnemy's band, as
// weights over each table's twenty slots), through the real overhaul blow both ways (combat/pcaao.js pcaaoAttackDamage,
// PCAAO and Meaner Monsters on as they ship), seeded, so every figure the record quotes is a command away.
//
// A KILL'S COST: the share of the player's health a foe takes off them while they kill it - the swings it takes
// (its health over a swing's mean) times its attack's mean over the player's health, the two tempos taken equal. A
// table's cost is the band's weighted mean; a level's, the geometric mean over the nineteen dungeon kinds and the three
// temperate wilderness tables. It is not a death rate - a player rests, drinks, casts and kites - only a ratio that moves
// with the player's growth, which is what the threat answers.
//
// THE STATED PLAYER (the Balance arc's section 2 builds at levels 12 and 20, extended on their slopes to 1 and 30): the
// attributes, health and skills interpolated; a longsword and seven pieces of plate (chain under level 8) of the metal
// stated for the level; ONLINE, the layer Renown brings (src/net/renown.js: 3 health a level; the Firmament's 2 stars a
// level - a melee build's blow channels to their 30% cap first, then the guard channels (blowTaken, evade, health) to
// theirs, as the tree's own routes reach them; a Rare sigil's middle carried by half); THE KIT (the ladder's bands'
// middles): a weapon line +8% from level 8, +17% from 15, +25% from 20, +30% from 25, and the guards 0.95 / 0.85 / 0.8 of a
// blow from 15 / 20 / 25.
//
//   node tools/heroMeasure.mjs              # the record's run: 1,500 foes a cell, seed 1
//   node tools/heroMeasure.mjs --n 400      # a quicker sample
import { isMain } from './lib/isMain.mjs';
import { pcaaoModules, pcaaoAttackDamage } from '../src/combat/pcaao.js';
import { makeEnemyEntity, applyProgressionScaling } from '../src/characters/enemy/enemyEntity.js';
import { ENEMY_BASICS } from '../src/characters/enemy/enemyBasics.js';
import { assignEnemyEquipment } from '../src/combat/enemyEquipment.js';
import { mintCondition } from '../src/systems/item/itemTemplates.js';
import { EQUIP_SLOTS, equipTableOf } from '../src/systems/equip.js';
import { SKILLS } from '../src/systems/skills.js';
import { ENCOUNTER_TABLES } from '../src/systems/encounters.js';
import { progressionScaling } from '../src/systems/skillSoftcap.js';
import { heroThreat } from '../src/systems/heroThreat.js';

const OVERHAUL = { Enabled: true, equipmentDamageEnhanced: false, fadingEnchantedItems: false, fixedStrengthDamageModifier: true, armorHitFormulaRedone: true, criticalStrikesIncreaseDamage: true, conditionBasedEffectiveness: true, softMaterialRequirements: true };
const MODS = pcaaoModules((k) => OVERHAUL[k], () => undefined);
/** A mulberry32 source - the measure's own, seeded. @param {number} a */
export const mulberry = (a) => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const stats = (o) => ({ strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50, ...o });
const skillsAll = (v, o = {}) => ({ ...Object.fromEntries(Array.from({ length: 35 }, (_, i) => [i, v])), ...o });

// [level, STR, AGI, END, SPD, LUC, WIL, health, Long Blade, Critical Strike, Dodging, every other skill]
const ANCHORS = [
  [1, 55, 50, 50, 45, 50, 45, 40, 30, 15, 20, 25], [5, 60, 55, 55, 50, 50, 45, 70, 42, 25, 30, 32], [8, 65, 60, 60, 55, 52, 48, 100, 52, 32, 38, 36],
  [12, 70, 65, 65, 60, 55, 50, 130, 60, 40, 45, 40], [20, 80, 75, 75, 70, 60, 55, 210, 85, 65, 65, 50], [30, 90, 85, 85, 80, 70, 60, 310, 100, 85, 85, 60],
];
// [from level, metal]: Iron 0, Steel 1, Elven 3, Dwarven 4, Mithril 5, Ebony 7, Daedric 9; plate -1 is chain
const WEAPON_METAL = [[1, 0], [3, 1], [9, 3], [12, 4], [15, 5], [18, 7], [28, 9]];
const PLATE_METAL = [[1, -1], [8, 0], [10, 1], [14, 4], [17, 5], [20, 7], [28, 9]];
const metalAt = (t, L) => t.reduce((m, [from, v]) => (L >= from ? v : m), t[0][1]);

/** The stated player at level `L`. */
export function buildAt(L) {
  let i = 0; while (i < ANCHORS.length - 2 && ANCHORS[i + 1][0] < L) i++;
  const a = ANCHORS[i], b = ANCHORS[i + 1], t = Math.max(0, Math.min(1, (L - a[0]) / (b[0] - a[0])));
  const v = (k) => Math.round(a[k] + (b[k] - a[k]) * t);
  return { level: L, STR: v(1), AGI: v(2), END: v(3), SPD: v(4), LUC: v(5), WIL: v(6), hp: v(7), LB: v(8), crit: v(9), dodge: v(10), other: v(11), wmat: metalAt(WEAPON_METAL, L), pmat: metalAt(PLATE_METAL, L) };
}
const ARMOR = [[102, 'ChestArmor'], [103, 'Gloves'], [104, 'LegsArmor'], [105, 'LeftArm'], [106, 'RightArm'], [107, 'Head'], [108, 'Feet']];
function mkPlayer(B) {
  const p = { isPlayer: true, level: B.level, raceId: 1, stats: stats({ strength: B.STR, agility: B.AGI, endurance: B.END, speed: B.SPD, luck: B.LUC, willpower: B.WIL }),
    skills: skillsAll(B.other, { [SKILLS.LongBlade]: B.LB, [SKILLS.CriticalStrike]: B.crit, [SKILLS.Dodging]: B.dodge }),
    career: { weaponArmorShieldsBitfield: 0, abilityFlagsAndSpellPointsBitfield: 0 }, health: 1e6, maxHealth: 1e6, items: [], armorValues: new Array(7).fill(100), reflexes: 2, biographyAvoidHitMod: 0 };
  const table = equipTableOf(p);
  const material = B.pmat < 0 ? 0x0100 : 0x0200 + B.pmat;
  for (const [ti, slot] of ARMOR) { const it = mintCondition({ group: 'Armor', templateIndex: ti, material, name: `a${ti}` }); it.currentCondition = it.maxCondition; table[EQUIP_SLOTS[slot]] = it; p.items.push(it); }
  const w = mintCondition({ group: 'Weapons', templateIndex: 120, material: B.wmat, flags: 0, name: 'Longsword' });
  w.maxCondition = 1e9; w.currentCondition = 1e9; table[EQUIP_SLOTS.RightHand] = w; p.items.push(w);
  return { p, w };
}
const career = stats({ attackModifierFlags: 0 });

/** One foe kind at one level: a swing's mean dealt, a foe attack's mean taken (its damageScale at the formula's tail),
 *  the foe's mean health - `hero` the threat stood on it through the real writer, or null. */
export function duel(L, id, { n = 1500, seed = 1, hero = null } = {}) {
  const B = buildAt(L);
  let dealt = 0, taken = 0, hp = 0;
  for (let s = 0; s < n; s++) {
    const r = mulberry(seed * 100003 + id * 7919 + s);
    const { p, w } = mkPlayer(B);
    const e = makeEnemyEntity(id, ENEMY_BASICS[id], id >= 128 ? { ...career, hitPointsPerLevel: 12, name: 'foe' } : career, L, r);
    let weapon = null;
    if (id >= 128) { const eq = assignEnemyEquipment(e, 0, L, r); e.armorValues = eq.armorValues; weapon = eq.rightHand ? { ...eq.rightHand, maxCondition: 1e9, currentCondition: 1e9 } : null; }
    if (hero) applyProgressionScaling(e, progressionScaling(null, 0, 0, 0, hero));
    hp += e.maxHealth;
    dealt += pcaaoAttackDamage(p, e, { weapon: w, rolls: r, dfRand: () => Math.floor(r() * 32768), modules: MODS });
    const t = pcaaoAttackDamage(e, p, { weapon, rolls: r, dfRand: () => Math.floor(r() * 32768), modules: MODS, playerReflexes: 2 });
    taken += t > 0 && Number.isFinite(e.damageScale) && e.damageScale !== 1 ? Math.max(1, Math.round(t * e.damageScale)) : t;   // combat/formulas.js calculateAttackDamage's tail
  }
  return { dealt: dealt / n, taken: taken / n, foeHp: hp / n, playerHp: B.hp };
}

/** DFU's level band (systems/encounters.js chooseRandomEnemy) as weights over a table's twenty slots. */
export function bandWeights(level) {
  const w = new Array(20).fill(0);
  const add = (min, max, share) => { if (min < 0) { min = 0; max = 5; } if (max > 19) { min = 14; max = 19; } for (let i = min; i <= max; i++) w[i] += share / (max - min + 1); };
  if (level <= 5) add(0, level + 2, 0.05); else add(0, 19, 0.05);
  add(0, level + 1, 0.15);
  add(level - 3, level + 3, 0.80);
  return w;
}

/** The layer Renown `R` brings online (R 1 or null: none). */
export function onlineAt(R) {
  const S = 2 * (Math.max(1, R ?? 1) - 1);
  const blow = Math.min(30, (S * 30) / 13);
  const s2 = Math.max(0, Math.min(19, S - 13)), s3 = Math.max(0, Math.min(38, S - 32));
  const guard = (9 * s2) / 19 + (6 * s3) / 38, evade = (10 * s3) / 38;
  const hp = 12 * Math.min(1, S / 13) + (24 * s2) / 19 + (39 * s3) / 38, hpPct = (7 * s2) / 19 + (8 * s3) / 38;
  const share = R >= 40 ? 1 : R >= 30 ? 0.8 : R >= 20 ? 0.6 : R >= 10 ? 0.4 : 0.2;
  return { dealt: (1 + blow / 100) * (1 + (6 * share * 0.5) / 100), taken: (1 - guard / 100) * (1 - evade / 100), hpAdd: 3 * (Math.max(1, R ?? 1) - 1) + hp, hpPct };
}
/** The stated kit at level `L`. */
export function kitAt(L) {
  const line = L >= 25 ? 30 : L >= 20 ? 25 : L >= 15 ? 17 : L >= 8 ? 8 : 0;
  return { dealt: 1 + line / 100, taken: L >= 25 ? 0.8 : L >= 20 ? 0.85 : L >= 15 ? 0.95 : 1 };
}

const TABLES = [...Array(19).keys(), 32, 33, 34];
/** What one kill costs the stated player at level `L` and Renown `R` (null offline), with the hero's threat or without. */
export function costAt(L, R = null, { n = 1500, threat = false, cache = new Map() } = {}) {
  const w = bandWeights(L), o = onlineAt(R), k = kitAt(L);
  const hero = threat ? heroThreat(L, R) : null;
  const d = (id) => { const key = `${L}:${id}:${threat ? R : '-'}`; if (!cache.has(key)) cache.set(key, duel(L, id, { n, hero })); return cache.get(key); };
  let logSum = 0;
  for (const ti of TABLES) {
    let cost = 0;
    for (let i = 0; i < 20; i++) {
      if (!w[i]) continue;
      const r = d(ENCOUNTER_TABLES[ti][i]);
      const hp = (r.playerHp + o.hpAdd) * (1 + o.hpPct / 100);
      cost += (w[i] * (r.foeHp / Math.max(0.01, r.dealt * o.dealt * k.dealt)) * r.taken * o.taken * k.taken) / hp;
    }
    logSum += Math.log(cost);
  }
  return Math.exp(logSum / TABLES.length);
}

if (isMain(import.meta.url)) {
  const arg = (name, dflt) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? Number(process.argv[i + 1]) : dflt; };
  const n = arg('n', 1500), cache = new Map();
  const pct = (v) => `${(100 * v).toFixed(1)}%`;
  console.log(`THE GROWTH (${n} foes a cell): a kill's cost, offline, the stated kit - and how many times cheaper than at level 10`);
  const c10 = costAt(10, null, { n, cache });
  for (const L of [10, 12, 14, 16, 18, 20, 22, 25, 28, 30, 35, 40]) { const c = costAt(L, null, { n, cache }); console.log(`  level ${L}: ${pct(c)}  x${(c10 / c).toFixed(2)}`); }
  console.log('RENOWN at a fixed level: how many times cheaper than at Renown 15');
  for (const L of [12, 20, 30]) {
    const b = costAt(L, 15, { n, cache });
    console.log(`  level ${L}: ${[1, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50].map((R) => `R${R} x${(b / costAt(L, R, { n, cache })).toFixed(2)}`).join(' ')}`);
  }
  console.log('THE THREAT: a kill\'s cost before and after, and the edge the hero keeps over level 10 (Renown 15 online)');
  const base = costAt(10, 15, { n, cache });
  for (const [L, R] of [[10, 15], [12, 18], [15, 22], [18, 27], [20, 30], [25, 38], [30, 45], [30, 50], [10, null], [20, null], [30, null]]) {
    const t = heroThreat(L, R), before = costAt(L, R, { n, cache }), after = costAt(L, R, { n, cache, threat: true });
    const b0 = R == null ? c10 : base;
    console.log(`  level ${L} Renown ${R ?? '-'}: x${t.damage.toFixed(2)} blows x${t.health.toFixed(2)} health | ${pct(before)} -> ${pct(after)} | the edge x${(b0 / before).toFixed(2)} -> x${(b0 / after).toFixed(2)}`);
  }
}
